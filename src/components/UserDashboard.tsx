import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS, Task, Project } from '@/types';
import TaskCard from '@/components/TaskCard';
import CompletedTaskCard from '@/components/CompletedTaskCard';
import IdeasPanel from '@/components/IdeasPanel';
import ProjectReadOnlyView from '@/components/ProjectReadOnlyView';
import MultiPartyNotesPanel from '@/components/MultiPartyNotesPanel';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2, Circle, LogOut, Menu, X, AlertTriangle, Lightbulb,
  Clock, Lock, ChevronRight, FolderOpen, ArrowRight, TrendingUp,
  Video, CalendarClock, MessageSquare, Film, Star, Pencil,
  XCircle, Bookmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';

type SidebarItem =
  | { type: 'task'; taskId: string }
  | { type: 'ideas'; campaignId: string };

type DashView = 'tasks' | 'projects' | 'filming' | 'queue';

// --- Time helpers ---

function formatTimeRemaining(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function getTaskTimeInfo(task: Task, project: Project | undefined) {
  if (task.deadlineDate) {
    const ms = new Date(task.deadlineDate).getTime() - Date.now();
    return { label: formatTimeRemaining(ms), isOverdue: ms < 0 };
  }
  if (task.assignedAt && project?.slaHours) {
    const ms = new Date(task.assignedAt).getTime() + project.slaHours * 3600000 - Date.now();
    return { label: formatTimeRemaining(ms), isOverdue: ms < 0 };
  }
  return null;
}

const UserDashboard = () => {
  const { currentUser, setCurrentUser, tasks, projects, ideas, campaigns, clients, completeTask, updatePartyNote } = useApp();
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<DashView>('tasks');
  const [taskSubTab, setTaskSubTab] = useState<'todo' | 'done'>('todo');
  const [reviewedIdeasExpanded, setReviewedIdeasExpanded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedQueueProjectId, setSelectedQueueProjectId] = useState<string | null>(null);
  const [frameioInputs, setFrameioInputs] = useState<Record<string, string>>({});

  // ── Filming day bulk confirmation state (kierownik_planu) ─────────────────
  const [filmingInputs, setFilmingInputs] = useState<Record<string, { recordingNumber: string; notes: string }>>({});
  const [filmingErrors, setFilmingErrors] = useState<Record<string, string>>({});

  if (!currentUser) return null;

  // ── Projects visible to this user — STRICT per-role filter ────────────────
  const myProjects = projects.filter(p => {
    if (p.status !== 'active') return false;
    switch (currentUser.role) {
      case 'influencer':    return p.assignedInfluencerId === currentUser.id;
      case 'montazysta':    return p.assignedEditorId === currentUser.id;
      case 'klient': {
        if (!currentUser.clientId || p.clientId !== currentUser.clientId) return false;
        // Project explicitly assigned to me
        if (p.assignedClientId === currentUser.id) return true;
        // No reviewer assigned → any klient from this company sees it
        if (p.assignedClientId == null) return true;
        // Assigned reviewer no longer exists → fall back to any klient from this company
        const assignee = users.find(u => u.id === p.assignedClientId);
        if (!assignee) return true;
        return false;
      }
      case 'kierownik_planu': return p.assignedKierownikId === currentUser.id;
      case 'operator':      return p.assignedOperatorId === currentUser.id;
      case 'publikator':    return p.assignedPublikatorId === currentUser.id;
      default:              return false; // admin uses AdminDashboard
    }
  });

  const activeProjectIds = myProjects.map(p => p.id);

  // ── ONLY currently actionable tasks (not locked, not done) ────────────────
  const myActionableTasks = tasks.filter(t => {
    if (!activeProjectIds.includes(t.projectId)) return false;
    if (!t.assignedRoles.includes(currentUser.role)) return false;
    if (t.status === 'done') return false;
    // Terminal statuses — no action possible, don't show as actionable
    if (t.status === 'rejected_final' || t.status === 'deferred') return false;
    if (t.assignedRoles.length > 1 && t.roleCompletions[currentUser.role]) return false;

    // Special: influencer can access "Brief dla montażysty" early as soon as
    // at least one party has submitted notes to "Wnieś uwagi przed montażem"
    if (t.status === 'locked' && t.title === 'Brief dla montażysty' && currentUser.role === 'influencer') {
      const notesTask = tasks.find(nt => nt.projectId === t.projectId && nt.title === 'Wnieś uwagi przed montażem');
      const hasAnyRealNotes = notesTask
        ? Object.keys(notesTask.roleCompletions).filter(r => r !== 'influencer').length > 0
        : false;
      return hasAnyRealNotes;
    }

    if (t.status === 'locked') return false;
    return true;
  });

  // ── Reviewed ideas (rejected or saved_for_later) — feedback for influencer ──
  const myReviewedIdeas = currentUser.role === 'influencer'
    ? ideas.filter(i =>
        i.createdByUserId === currentUser.id &&
        (i.status === 'rejected' || i.status === 'saved_for_later')
      )
    : [];

  // ── Done tasks the current user can review or correct ──────────────────────
  const myDoneUrlTasks = tasks.filter(t => {
    if (!activeProjectIds.includes(t.projectId) || t.status !== 'done') return false;
    if (currentUser.role === 'influencer') {
      return t.assignedRoles.includes('influencer') && (t.inputType === 'url' || t.inputType === 'actor_assignment');
    }
    if (currentUser.role === 'klient') {
      return t.assignedRoles.includes('klient') && t.inputType === 'script_review';
    }
    return false;
  });

  // Projects blocked by a terminal (rejected_final / deferred) task — locked tasks after them will never unlock
  const stuckProjectIds = new Set(
    tasks
      .filter(t => activeProjectIds.includes(t.projectId) && (t.status === 'rejected_final' || t.status === 'deferred'))
      .map(t => t.projectId)
  );

  const myUpcomingCount = tasks.filter(t => {
    if (!activeProjectIds.includes(t.projectId)) return false;
    if (stuckProjectIds.has(t.projectId)) return false; // don't count phantom locked tasks
    if (!t.assignedRoles.includes(currentUser.role)) return false;
    return t.status === 'locked';
  }).length;

  const getProject = (projectId: string) => projects.find(p => p.id === projectId);

  const selectedTask = selectedItem?.type === 'task'
    ? tasks.find(t => t.id === selectedItem.taskId)
    : null;

  const selectItem = (item: SidebarItem) => {
    setSelectedItem(item);
    setSidebarOpen(false);
  };

  // ── Campaigns (influencer / klient) ────────────────────────────────────────
  const showIdeasSection = currentUser.role === 'influencer' || currentUser.role === 'klient';

  const getPendingIdeasCount = (campaignId: string) =>
    ideas.filter(i => i.campaignId === campaignId && i.status === 'pending').length;

  const getTotalIdeasCount = (campaignId: string) =>
    ideas.filter(i => i.campaignId === campaignId).length;

  const ideasCampaigns = showIdeasSection
    ? campaigns.filter(c => {
        if (c.status === 'completed' || c.status === 'cancelled') return false;
        if (currentUser.role === 'influencer') {
          if (c.assignedInfluencerId !== currentUser.id) return false;
          const total = getTotalIdeasCount(c.id);
          const pending = getPendingIdeasCount(c.id);
          if (total >= c.targetIdeaCount) return false;
          return true;
        }
        if (currentUser.role === 'klient') {
          if (c.assignedClientUserId !== currentUser.id) return false;
          return getPendingIdeasCount(c.id) > 0;
        }
        return false;
      })
    : [];

  const taskIcon = (status: string) => {
    if (status === 'needs_influencer_revision') return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />;
    if (status === 'pending_client_approval') return <Circle className="h-4 w-4 shrink-0 text-warning" />;
    return <Circle className="h-4 w-4 shrink-0 text-primary" />;
  };

  const hasCampaigns = ideasCampaigns.length > 0;
  const hasActiveTasks = myActionableTasks.length > 0;
  const isWaiting = !hasActiveTasks && !hasCampaigns && myUpcomingCount > 0;
  const isTrulyDone = !hasActiveTasks && !hasCampaigns && myUpcomingCount === 0;

  // ── Filming day helpers (kierownik_planu) ──────────────────────────────────
  const filmingDayProjects = currentUser.role === 'kierownik_planu'
    ? myProjects.filter(p => {
        const filmingDateTask = tasks.find(t => t.projectId === p.id && t.title === 'Ustaw termin planu zdjęciowego' && t.status === 'done' && t.value);
        if (!filmingDateTask?.value) return false;
        try {
          return isSameDay(new Date(filmingDateTask.value), new Date());
        } catch { return false; }
      }).filter(p => {
        const confirmTask = tasks.find(t => t.projectId === p.id && t.title === 'Potwierdź nagranie');
        return confirmTask?.status === 'todo';
      })
    : [];

  const filmingDayCount = filmingDayProjects.length;

  const handleFilmingConfirm = (projectId: string, taskId: string) => {
    const input = filmingInputs[projectId] ?? { recordingNumber: '', notes: '' };
    if (!input.recordingNumber.trim()) {
      setFilmingErrors(prev => ({ ...prev, [projectId]: 'Podaj numer nagrania' }));
      return;
    }
    setFilmingErrors(prev => { const n = { ...prev }; delete n[projectId]; return n; });
    completeTask(taskId, JSON.stringify({ recordingNumber: input.recordingNumber.trim(), notes: input.notes.trim() }), 'kierownik_planu');
    setFilmingInputs(prev => { const n = { ...prev }; delete n[projectId]; return n; });
  };

  const renderFilmingDayView = () => {
    if (filmingDayProjects.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Video className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Brak nagrań na dziś</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Żaden pomysł nie ma zaplanowanego planu zdjęciowego na dzisiaj ({format(new Date(), 'dd.MM.yyyy', { locale: pl })}).
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Dzień nagraniowy</h2>
            <Badge className="bg-primary/10 text-primary border-0 text-[11px]">
              {format(new Date(), 'dd.MM.yyyy', { locale: pl })}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Odhaczyj pomysły, które zostały nagrane. Podaj numer nagrania dla każdego pomysłu.
          </p>

          {filmingDayProjects.map(project => {
            const client = clients.find(c => c.id === project.clientId);
            const confirmTask = tasks.find(t => t.projectId === project.id && t.title === 'Potwierdź nagranie');
            if (!confirmTask) return null;
            const input = filmingInputs[project.id] ?? { recordingNumber: '', notes: '' };
            const err = filmingErrors[project.id];

            return (
              <div key={project.id} className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">
                      {project.name}
                    </span>
                    {client && (
                      <span className="text-xs text-muted-foreground">{client.companyName} · {client.contactName}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Numer nagrania *</label>
                    <Input
                      placeholder="np. 001"
                      value={input.recordingNumber}
                      onChange={e => {
                        setFilmingInputs(prev => ({ ...prev, [project.id]: { ...input, recordingNumber: e.target.value } }));
                        setFilmingErrors(prev => { const n = { ...prev }; delete n[project.id]; return n; });
                      }}
                      className="font-mono h-8 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Notatka (opcjonalnie)</label>
                  <Textarea
                    placeholder="Opis przebiegu nagrania, uwagi..."
                    value={input.notes}
                    onChange={e => setFilmingInputs(prev => ({ ...prev, [project.id]: { ...input, notes: e.target.value } }))}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                {err && (
                  <p className="text-xs text-destructive">{err}</p>
                )}

                <Button
                  onClick={() => handleFilmingConfirm(project.id, confirmTask.id)}
                  className="w-full"
                  size="sm"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Potwierdź nagranie pomysłu
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Editor queue (montazysta) ──────────────────────────────────────────────
  const PRIO_CFG = {
    high:   { label: 'Wysoki', days: '1–2 dni', maxDays: 2, barBg: 'bg-destructive/65', slotBg: 'bg-destructive/12', text: 'text-destructive', badge: 'bg-destructive/10 text-destructive border-destructive/20' },
    medium: { label: 'Średni', days: '3–4 dni', maxDays: 4, barBg: 'bg-warning/65',     slotBg: 'bg-warning/12',     text: 'text-warning',     badge: 'bg-warning/10 text-warning border-warning/20' },
    low:    { label: 'Niski',  days: '5–7 dni', maxDays: 7, barBg: 'bg-success/65',     slotBg: 'bg-success/12',     text: 'text-success',     badge: 'bg-success/10 text-success border-success/20' },
  } as const;
  type Prio = keyof typeof PRIO_CFG;

  const editorQueueProjects = currentUser.role === 'montazysta'
    ? myProjects.filter(p => {
        const t = tasks.find(t2 => t2.projectId === p.id && t2.title === 'Wgraj zmontowany film');
        return t && t.status !== 'done';
      }).sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.priority ?? 'low'] ?? 2) - (order[b.priority ?? 'low'] ?? 2);
      })
    : [];

  const renderEditorWorkboard = (projectId: string) => {
    const project = myProjects.find(p => p.id === projectId);
    if (!project) return null;
    const client = clients.find(c => c.id === project.clientId);
    const prio = (project.priority ?? 'low') as Prio;
    const cfg = PRIO_CFG[prio];

    const projectTasks = tasks.filter(t => t.projectId === projectId);
    const briefTask = projectTasks.find(t => t.title === 'Brief dla montażysty');
    const notesTask = projectTasks.find(t => t.title === 'Wnieś uwagi przed montażem');
    const uploadTask = projectTasks.find(t => t.title === 'Wgraj zmontowany film');
    const poprawkiTask = projectTasks.find(t => t.title === 'Wgraj poprawki');

    // The active editing task (whichever is currently todo)
    const activeEditTask = [uploadTask, poprawkiTask].find(t => t && t.status === 'todo');
    const frameioUrl = frameioInputs[projectId] ?? '';

    const handleSubmitFilm = () => {
      if (!activeEditTask || !frameioUrl.trim()) return;
      completeTask(activeEditTask.id, frameioUrl.trim(), 'montazysta');
      setFrameioInputs(prev => { const n = { ...prev }; delete n[projectId]; return n; });
      setSelectedQueueProjectId(null);
    };

    return (
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Back + header */}
          <div>
            <button
              onClick={() => setSelectedQueueProjectId(null)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowRight className="h-3 w-3 rotate-180" /> Wróć do kolejki
            </button>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{project.name}</h2>
                {client && <p className="text-sm text-muted-foreground">{client.companyName} · {client.contactName}</p>}
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shrink-0 ${cfg.badge}`}>
                <Star className="h-3 w-3" />
                {cfg.label} · {cfg.days}
              </span>
            </div>
          </div>

          {/* Brief from influencer */}
          {briefTask && briefTask.status === 'done' && briefTask.value && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-3.5 w-3.5" />
                Brief od influencera
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{briefTask.value}</p>
            </div>
          )}
          {briefTask && briefTask.status !== 'done' && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              Brief od influencera nie jest jeszcze gotowy.
            </div>
          )}

          {/* Pre-montage notes (all parties, read-only for montazysta) */}
          {notesTask && notesTask.status !== 'locked' && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-3.5 w-3.5" />
                Uwagi przed montażem
              </div>
              <MultiPartyNotesPanel
                task={notesTask}
                role="montazysta"
                onSubmit={() => {}}
                onUpdate={() => {}}
              />
            </div>
          )}

          {/* Upload task */}
          {activeEditTask ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Film className="h-4 w-4 text-primary" />
                {activeEditTask.title === 'Wgraj poprawki' ? 'Wgraj poprawki po uwagach' : 'Wgraj zmontowany film'}
              </div>
              <p className="text-xs text-muted-foreground">
                Wgraj gotowy materiał na frame.io i wklej link poniżej. Klient dostanie go do oceny.
              </p>
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="https://app.frame.io/..."
                  value={frameioUrl}
                  onChange={e => setFrameioInputs(prev => ({ ...prev, [projectId]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button
                  className="w-full"
                  disabled={!frameioUrl.trim()}
                  onClick={handleSubmitFilm}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {activeEditTask.title === 'Wgraj poprawki' ? 'Wyślij poprawki do oceny' : 'Wyślij film do oceny klienta'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Film wysłany — czekasz na ocenę</p>
                <p className="text-xs text-muted-foreground">Klient ocenia film we frame.io. Dostaniesz zadanie jeśli będą potrzebne poprawki.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEditorQueueView = () => {
    // Workboard for selected project
    if (selectedQueueProjectId) return renderEditorWorkboard(selectedQueueProjectId);

    // Gantt: all projects start from TODAY, bar width = priority SLA
    // Slots: 4 columns × 2 days each = 8 days covers high(1-2) / medium(3-4) / low(5-7)
    const GANTT_SLOTS = 4;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // high→1 slot, medium→2 slots, low→4 slots (all start at slot 0)
    const PRIO_SLOTS: Record<Prio, number> = { high: 1, medium: 2, low: 4 };

    const timeline = editorQueueProjects.map(p => {
      const prio = (p.priority ?? 'low') as Prio;
      const cfg = PRIO_CFG[prio];
      const startDate = today;
      const endDate = addDays(today, cfg.maxDays - 1);
      const slotSpan = PRIO_SLOTS[prio];
      const editTask = tasks.find(t => t.projectId === p.id && t.title === 'Wgraj zmontowany film');
      return { p, prio, cfg, startSlot: 0, slotSpan, startDate, endDate, editTask };
    });

    const slotHeaders = Array.from({ length: GANTT_SLOTS }, (_, i) => {
      const d = addDays(today, i * 2);
      return format(d, 'dd.MM EEE', { locale: pl });
    });

    if (editorQueueProjects.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Film className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Brak pomysłów w kolejce</h2>
            <p className="mt-2 text-sm text-muted-foreground">Nie masz teraz żadnych pomysłów do zmontowania. Świetnie!</p>
          </div>
        </div>
      );
    }

    const counts = { high: 0, medium: 0, low: 0 };
    editorQueueProjects.forEach(p => { const pr = (p.priority ?? 'low') as Prio; counts[pr]++; });

    return (
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Header + stats */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Film className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Kolejka montażu</h2>
              <span className="text-sm text-muted-foreground">({editorQueueProjects.length} pomysłów)</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(counts) as Prio[]).filter(k => counts[k] > 0).map(k => (
                <span key={k} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIO_CFG[k].badge}`}>
                  <Star className="h-3 w-3" />
                  {counts[k]}× {PRIO_CFG[k].label} · {PRIO_CFG[k].days}
                </span>
              ))}
            </div>
          </div>

          {/* Project list */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/40 border-b border-border px-4 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Pomysł</span>
              <span>Priorytet</span>
              <span>Termin (szac.)</span>
              <span>Akcja</span>
            </div>
            {timeline.map(({ p, prio, cfg, startDate, endDate, editTask }, idx) => {
              const client = clients.find(c => c.id === p.clientId);
              const myTask = myActionableTasks.find(t => t.projectId === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedQueueProjectId(p.id)}
                  className={`px-4 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center border-b border-border last:border-0 cursor-pointer hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground w-4 shrink-0">#{idx + 1}</span>
                      <span className="font-semibold text-foreground truncate">{p.name}</span>
                      {myTask && (
                        <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wide shrink-0">Twoja kolej</span>
                      )}
                    </div>
                    {client && <p className="text-xs text-muted-foreground ml-5">{client.companyName}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${PRIO_CFG[prio].badge}`}>
                    <Star className="h-2.5 w-2.5" />
                    {cfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {format(startDate, 'dd.MM', { locale: pl })}–{format(endDate, 'dd.MM', { locale: pl })}
                    <span className="ml-1 text-[10px] text-muted-foreground/60">({cfg.days})</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </div>
              );
            })}
          </div>

          {/* Gantt */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Okna SLA od dziś (wg priorytetu)
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Header row */}
              <div className="bg-muted/40 border-b border-border flex">
                <div className="w-44 shrink-0 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Pomysł</div>
                {slotHeaders.map((h, i) => (
                  <div key={i} className="flex-1 px-1 py-2 text-[9px] text-muted-foreground text-center border-l border-border leading-tight">{h}</div>
                ))}
              </div>
              {/* Project rows */}
              {timeline.map(({ p, prio, cfg, startSlot, slotSpan }) => (
                <div key={p.id} className="flex items-center border-b border-border last:border-0" style={{ minHeight: 36 }}>
                  <div className="w-44 shrink-0 px-3 text-xs font-medium text-foreground truncate">{p.name}</div>
                  {/* Gantt bar area */}
                  <div className="flex-1 relative h-9">
                    {/* Slot grid lines */}
                    {Array.from({ length: GANTT_SLOTS }).map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-l border-border" style={{ left: `${i / GANTT_SLOTS * 100}%`, width: `${1 / GANTT_SLOTS * 100}%` }} />
                    ))}
                    {/* Bar */}
                    {startSlot < GANTT_SLOTS && (
                      <div
                        className={`absolute top-1.5 bottom-1.5 rounded flex items-center px-2 ${cfg.barBg}`}
                        style={{
                          left: `${startSlot / GANTT_SLOTS * 100}%`,
                          width: `${Math.min(slotSpan, GANTT_SLOTS - startSlot) / GANTT_SLOTS * 100}%`,
                        }}
                      >
                        <span className="text-[9px] font-bold text-white truncate">{cfg.label}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // ── Project list helpers ───────────────────────────────────────────────────
  const getProjectStages = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId);

  const getActiveStageLabel = (projectId: string) => {
    const pts = getProjectStages(projectId);
    const active = pts.find(t => t.status === 'todo' || t.status === 'pending_client_approval' || t.status === 'needs_influencer_revision');
    return active?.title ?? 'Zakończony';
  };

  const getMyNextTask = (projectId: string) =>
    myActionableTasks.find(t => t.projectId === projectId) ?? null;

  // ── Render: project list view (main content) ───────────────────────────────
  const renderProjectsView = () => {
    // Detail view — full read-only pipeline
    if (selectedProjectId) {
      const project = myProjects.find(p => p.id === selectedProjectId);
      if (project) {
        const client = clients.find(c => c.id === project.clientId) ?? null;
        return (
          <ProjectReadOnlyView
            project={project}
            tasks={tasks}
            client={client}
            currentUserRole={currentUser.role}
            onBack={() => setSelectedProjectId(null)}
          />
        );
      }
    }

    // List view
    if (myProjects.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Brak przypisanych pomysłów</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Nie masz jeszcze żadnych aktywnych pomysłów. Czekaj na przypisanie przez administratora.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Moje pomysły ({myProjects.length})
          </h2>

          {myProjects.map(project => {
            const client = clients.find(c => c.id === project.clientId);
            const stages = getProjectStages(project.id);
            const totalStages = stages.length;
            const doneStages = stages.filter(t => t.status === 'done').length;
            const progress = totalStages > 0 ? doneStages / totalStages : 0;
            const activeStageLabel = getActiveStageLabel(project.id);
            const myNext = getMyNextTask(project.id);
            const isBlocking = !!myNext;

            return (
              <div
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`rounded-xl border bg-card p-4 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                  isBlocking ? 'border-primary/40 bg-primary/[0.02]' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                      {isBlocking && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-0 shrink-0">
                          Twoja kolej
                        </Badge>
                      )}
                    </div>
                    {client && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {client.companyName} · {client.contactName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {doneStages}/{totalStages}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isBlocking ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>

                {/* Active stage + my task */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Etap: {activeStageLabel}</span>
                  </div>
                  {myNext && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        selectItem({ type: 'task', taskId: myNext.id });
                        setView('tasks');
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                    >
                      Wykonaj zadanie
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <img src="/images/yads-logo.png" alt="YADS" className="h-7 w-auto rounded" />
            <div>
              <div className="text-sm font-semibold text-foreground">{currentUser.name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role]}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentUser(null)} title="Zmień użytkownika">
              <LogOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab bar: Zadania / Pomysły [/ Nagrania for KP] */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setView('tasks')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              view === 'tasks'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Zadania
            {myActionableTasks.length > 0 && (
              <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary leading-none">
                {myActionableTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('projects')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              view === 'projects'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Pomysły
            {myProjects.length > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
                {myProjects.length}
              </span>
            )}
          </button>
          {currentUser.role === 'montazysta' && (
            <button
              onClick={() => setView('queue')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                view === 'queue'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              Kolejka
              {editorQueueProjects.length > 0 && (
                <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary leading-none">
                  {editorQueueProjects.length}
                </span>
              )}
            </button>
          )}
          {currentUser.role === 'kierownik_planu' && (
            <button
              onClick={() => setView('filming')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                view === 'filming'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              Nagrania
              {filmingDayCount > 0 && (
                <span className="ml-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning leading-none">
                  {filmingDayCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Sidebar content — only shown in tasks view */}
        {view === 'tasks' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">

            {/* Sub-tab toggle: Do zrobienia / Wykonane */}
            {(myActionableTasks.length > 0 || myDoneUrlTasks.length > 0 || hasCampaigns) && (
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  onClick={() => setTaskSubTab('todo')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    taskSubTab === 'todo' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Do zrobienia
                  {(myActionableTasks.length + (hasCampaigns ? 1 : 0)) > 0 && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary leading-none">
                      {myActionableTasks.length + (hasCampaigns ? ideasCampaigns.length : 0)}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTaskSubTab('done')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    taskSubTab === 'done' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Wykonane
                  {myDoneUrlTasks.length > 0 && (
                    <span className="rounded-full bg-muted-foreground/20 px-1.5 py-px text-[10px] font-medium text-muted-foreground leading-none">
                      {myDoneUrlTasks.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* ── Todo sub-tab ── */}
            {taskSubTab === 'todo' && <>

            {/* Ideas / campaigns */}
            {showIdeasSection && ideasCampaigns.length > 0 && (
              <div>
                <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {currentUser.role === 'influencer' ? 'Pomysły do złożenia' : 'Pomysły do oceny'}
                </div>
                {ideasCampaigns.map(campaign => {
                  const pending = getPendingIdeasCount(campaign.id);
                  const total = getTotalIdeasCount(campaign.id);
                  const client = clients.find(c => c.id === campaign.clientId);
                  const isSelected = selectedItem?.type === 'ideas' && selectedItem.campaignId === campaign.id;

                  const msLeft = new Date(campaign.createdAt).getTime() + campaign.slaHours * 3600000 - Date.now();
                  const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
                  const minsLeft = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
                  const isOverdue = msLeft < 0;

                  return (
                    <button
                      key={campaign.id}
                      onClick={() => selectItem({ type: 'ideas', campaignId: campaign.id })}
                      className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected ? 'bg-warning/10 text-warning' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <Lightbulb className="h-4 w-4 shrink-0 text-warning" />
                      <div className="flex-1 truncate">
                        <div className="truncate font-medium">{client?.companyName || 'Kampania'}</div>
                        <div className={`truncate text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {isOverdue
                            ? '⚠ Po terminie!'
                            : `${String(hoursLeft).padStart(2, '0')}h ${String(minsLeft).padStart(2, '0')}m · ${total}/${campaign.targetIdeaCount} pomysłów`}
                        </div>
                      </div>
                      {pending > 0 && currentUser.role === 'klient' && (
                        <Badge variant="secondary" className="border-0 bg-warning/15 text-warning text-[10px] shrink-0">
                          {pending}
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="secondary" className="border-0 bg-destructive/10 text-destructive text-[10px] shrink-0">
                          !
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Reviewed ideas feedback (influencer) — collapsible ── */}
            {myReviewedIdeas.length > 0 && (
              <div>
                <button
                  onClick={() => setReviewedIdeasExpanded(v => !v)}
                  className="flex w-full items-center justify-between px-1 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    Ocena Twoich pomysłów
                    <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal">
                      {myReviewedIdeas.length}
                    </span>
                  </span>
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${reviewedIdeasExpanded ? 'rotate-90' : ''}`} />
                </button>

                {reviewedIdeasExpanded && myReviewedIdeas.map(idea => {
                  const campaign = campaigns.find(c => c.id === idea.campaignId);
                  const client = clients.find(c => c.id === campaign?.clientId);
                  return (
                    <div key={idea.id} className={`mb-1.5 rounded-lg border px-3 py-2.5 ${
                      idea.status === 'rejected'
                        ? 'border-destructive/20 bg-destructive/5'
                        : 'border-primary/20 bg-primary/5'
                    }`}>
                      <div className="flex items-start gap-2">
                        <div className="shrink-0 mt-0.5">
                          {idea.status === 'rejected'
                            ? <XCircle className="h-4 w-4 text-destructive" />
                            : <Bookmark className="h-4 w-4 text-primary" />
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">{idea.title}</div>
                          {client && <div className="text-[10px] text-muted-foreground">{client.companyName}</div>}
                          <div className={`text-[10px] font-medium mt-0.5 ${
                            idea.status === 'rejected' ? 'text-destructive' : 'text-primary'
                          }`}>
                            {idea.status === 'rejected' ? 'Odrzucony przez klienta' : 'Odłożony na później'}
                          </div>
                          {idea.clientNotes && (
                            <div className="text-xs mt-1 italic text-muted-foreground leading-snug">
                              „{idea.clientNotes}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Currently actionable tasks */}
            {myActionableTasks.length > 0 && (
              <div>
                <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Do zrobienia ({myActionableTasks.length})
                </div>
                {myActionableTasks.map(task => {
                  const project = getProject(task.projectId);
                  const timeInfo = getTaskTimeInfo(task, project);
                  const isSelected = selectedItem?.type === 'task' && selectedItem.taskId === task.id;

                  const ideaWithNotes = task.order <= 3
                    ? ideas.find(i => i.resultingProjectId === task.projectId && i.clientNotes)
                    : null;
                  return (
                    <button
                      key={task.id}
                      onClick={() => selectItem({ type: 'task', taskId: task.id })}
                      className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {taskIcon(task.status)}
                      <div className="flex-1 truncate min-w-0">
                        {/* Project name — prominent chip */}
                        {project?.name && (
                          <div className="mb-0.5 truncate">
                            <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary leading-tight max-w-full truncate">
                              {project.name}
                            </span>
                          </div>
                        )}
                        {/* Task title */}
                        <div className="truncate text-sm font-medium leading-snug">{task.title}</div>
                        {/* Time info */}
                        {timeInfo && (
                          <div className={`flex items-center gap-0.5 text-[11px] font-medium mt-0.5 ${timeInfo.isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <Clock className="h-2.5 w-2.5" />
                            {timeInfo.isOverdue ? 'Po terminie' : timeInfo.label}
                          </div>
                        )}
                      </div>
                      {ideaWithNotes && (
                        <span className="shrink-0 rounded-full bg-warning/20 px-1.5 py-px text-[10px] font-semibold text-warning leading-none">
                          UWAGI
                        </span>
                      )}
                      {task.status === 'needs_influencer_revision' && (
                        <span className="text-[10px] font-bold text-destructive shrink-0">POPRAW</span>
                      )}
                      {task.status === 'pending_client_approval' && (
                        <span className="text-[10px] font-medium text-warning shrink-0">CZEKA</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            </> /* end todo sub-tab */}

            {/* ── Done sub-tab ── */}
            {taskSubTab === 'done' && <>
            {myDoneUrlTasks.length > 0 ? (
              <div>
                <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Wysłane ({myDoneUrlTasks.length})
                </div>
                {myDoneUrlTasks.map(task => {
                  const project = getProject(task.projectId);
                  const isSelected = selectedItem?.type === 'task' && selectedItem.taskId === task.id;
                  return (
                    <button
                      key={task.id}
                      onClick={() => selectItem({ type: 'task', taskId: task.id })}
                      className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      <div className="flex-1 truncate min-w-0">
                        {project?.name && (
                          <div className="mb-0.5 truncate">
                            <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary leading-tight max-w-full truncate">
                              {project.name}
                            </span>
                          </div>
                        )}
                        <div className="truncate text-sm font-medium leading-snug">{task.title}</div>
                        {task.value && (
                          <div className="truncate text-[11px] text-muted-foreground mt-0.5">
                            {task.inputType === 'actor_assignment' ? (() => {
                              try {
                                const actors = JSON.parse(task.value) as { name: string }[];
                                return actors.map(a => a.name).join(', ');
                              } catch { return task.value; }
                            })() : task.value}
                          </div>
                        )}
                      </div>
                      <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground">Brak wykonanych zadań</p>
              </div>
            )}
            </> /* end done sub-tab */}

            {/* Waiting state — only in todo view */}
            {taskSubTab === 'todo' && isWaiting && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center space-y-1.5">
                <Lock className="h-5 w-5 mx-auto text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">
                  {myUpcomingCount} {myUpcomingCount === 1 ? 'zadanie' : myUpcomingCount < 5 ? 'zadania' : 'zadań'} nadchodzi
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Oczekujesz aż inne etapy zostaną ukończone przez resztę zespołu
                </p>
              </div>
            )}

            {/* Truly done */}
            {taskSubTab === 'todo' && isTrulyDone && (
              <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-4 text-center space-y-1.5">
                <CheckCircle2 className="h-5 w-5 mx-auto text-success" />
                <p className="text-xs font-medium text-success">Wszystko gotowe!</p>
                <p className="text-[11px] text-muted-foreground">Brak oczekujących zadań</p>
              </div>
            )}

          </div>
        )}

        {/* Projects view — sidebar shows hint */}
        {view === 'projects' && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">
                {myProjects.length > 0
                  ? `${myProjects.length} pomysłów po prawej`
                  : 'Brak pomysłów'}
              </p>
            </div>
          </div>
        )}

      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center border-b border-border px-4 py-3 md:px-6 shrink-0">
          <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <img src="/images/yads-logo.png" alt="YADS" className="mr-3 h-7 w-auto rounded md:hidden" />
          <h1 className="text-lg font-semibold text-foreground">
            {view === 'filming'
              ? 'Dzień nagraniowy'
              : view === 'queue'
                ? 'Kolejka montażu'
                : view === 'projects'
                  ? (selectedProjectId
                      ? (myProjects.find(p => p.id === selectedProjectId)?.name ?? 'Pomysł')
                      : 'Moje pomysły')
                  : selectedItem?.type === 'ideas'
                    ? (currentUser.role === 'klient' ? 'Oceń pomysły' : 'Twoje pomysły')
                    : selectedTask
                      ? selectedTask.title
                      : 'Moje zadania'}
          </h1>
          {view === 'tasks' && selectedItem?.type === 'task' && selectedTask && (
            <span className="ml-2 text-sm text-muted-foreground truncate hidden sm:inline-flex items-center gap-1">
              <ChevronRight className="h-4 w-4" />
              {getProject(selectedTask.projectId)?.name}
            </span>
          )}
        </header>

        {/* Editor queue view (montazysta) */}
        {view === 'queue' ? renderEditorQueueView() :

        /* Filming day view (kierownik_planu) */
        view === 'filming' ? renderFilmingDayView() :

        /* Projects view */
        view === 'projects' ? renderProjectsView() : (

          /* Tasks view — existing behavior */
          <div className={`flex flex-1 overflow-auto flex-col ${selectedItem?.type === 'ideas' ? 'p-4 md:p-6' : 'items-center justify-center p-4 md:p-8'}`}>

            {/* ── Influencer: live pre-montage notes panel ── */}
            {currentUser.role === 'influencer' && (() => {
              const liveNotesTasks = myProjects.flatMap(p =>
                tasks.filter(t =>
                  t.projectId === p.id &&
                  t.title === 'Wnieś uwagi przed montażem' &&
                  t.status !== 'locked' &&
                  t.status !== 'done'
                )
              );
              if (liveNotesTasks.length === 0) return null;
              return (
                <div className="w-full max-w-lg mx-auto space-y-4 mb-4">
                  {liveNotesTasks.map(task => {
                    const proj = projects.find(p => p.id === task.projectId);
                    return (
                      <div key={task.id} className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-warning" />
                          <span className="text-sm font-semibold text-foreground">Uwagi przed montażem</span>
                          {proj && <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{proj.name}</span>}
                          <span className="ml-auto text-[10px] text-warning uppercase font-semibold tracking-wide">Na żywo</span>
                        </div>
                        <MultiPartyNotesPanel
                          task={task}
                          role="influencer"
                          onSubmit={(note) => updatePartyNote(task.id, 'influencer', note)}
                          onUpdate={(note) => updatePartyNote(task.id, 'influencer', note)}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {selectedItem?.type === 'ideas' ? (
              <div className="w-full max-w-2xl mx-auto">
                <IdeasPanel
                  campaignId={selectedItem.campaignId}
                  role={currentUser.role as 'influencer' | 'klient'}
                />
              </div>

            ) : selectedTask && selectedTask.status === 'done' ? (
              <div className="w-full max-w-lg">
                <CompletedTaskCard task={selectedTask} projectName={getProject(selectedTask.projectId)?.name || ''} />
              </div>

            ) : selectedTask ? (
              <div className="w-full max-w-lg space-y-4">
                {/* Idea notes banner — only relevant during script phase (orders 2–3) */}
                {(() => {
                  if (selectedTask.order > 3) return null;
                  const idea = ideas.find(i => i.resultingProjectId === selectedTask.projectId && i.clientNotes);
                  if (!idea) return null;
                  const isInfluencer = currentUser.role === 'influencer';
                  return (
                    <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <MessageSquare className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-warning mb-1">
                            {isInfluencer
                              ? 'Klient zaakceptował pomysł z uwagami — uwzględnij je w scenariuszu:'
                              : 'Twoje uwagi do pomysłu — sprawdź czy zostały uwzględnione:'}
                          </p>
                          <p className="text-sm text-foreground leading-relaxed">„{idea.clientNotes}"</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <TaskCard key={selectedTask.id} task={selectedTask} projectName={getProject(selectedTask.projectId)?.name || ''} />
              </div>

            ) : (
              <div className="animate-fade-in text-center max-w-sm">
                {hasActiveTasks || hasCampaigns ? (
                  <>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Circle className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {hasActiveTasks
                        ? `${myActionableTasks.length} ${myActionableTasks.length === 1 ? 'zadanie' : 'zadań'} do wykonania`
                        : 'Pomysły czekają na Ciebie'}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">Wybierz zadanie z listy po lewej.</p>
                  </>
                ) : isWaiting ? (
                  <>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Lock className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Oczekujesz na innych</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Masz {myUpcomingCount} {myUpcomingCount === 1 ? 'zadanie' : 'zadań'} w kolejce — zostaną odblokowane gdy poprzednie etapy zostaną ukończone.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Wszystko gotowe!</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Oczekuj na kolejne kroki od zespołu.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default UserDashboard;
