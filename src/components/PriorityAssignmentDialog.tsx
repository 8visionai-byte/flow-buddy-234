import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import type { Task, ProjectPriority } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, startOfToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Film, User2, ChevronRight, Info, AlertTriangle, CheckCircle2, UserPlus, Check, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

// ─── Priority config (only 3 editing priorities) ─────────────────────────────
type EditPriority = 'high' | 'medium' | 'low';

const PRIO: Record<EditPriority, {
  label: string;
  days: string;
  slots: number;        // 2-day slots in Gantt
  badge: string;
  bar: string;
  slotBg: string;
  dot: string;
}> = {
  high: {
    label: 'Wysoki',
    days: '1–2 dni',
    slots: 1,
    badge: 'bg-destructive/15 text-destructive border border-destructive/30',
    bar: 'bg-destructive',
    slotBg: 'bg-destructive/25',
    dot: 'bg-destructive',
  },
  medium: {
    label: 'Średni',
    days: '3–4 dni',
    slots: 2,
    badge: 'bg-warning/15 text-warning border border-warning/30',
    bar: 'bg-warning',
    slotBg: 'bg-warning/25',
    dot: 'bg-warning',
  },
  low: {
    label: 'Niski',
    days: '5–7 dni',
    slots: 3,
    badge: 'bg-success/15 text-success border border-success/30',
    bar: 'bg-success',
    slotBg: 'bg-success/25',
    dot: 'bg-success',
  },
};

const GANTT_SLOTS = 7; // 7 × 2 days = 14 days

// Map ProjectPriority → EditPriority (discard 'urgent' → treat as 'high')
function toEditPriority(p: string | null | undefined): EditPriority {
  if (p === 'high' || p === 'urgent') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PriorityAssignmentDialog({ task, open, onOpenChange }: Props) {
  const {
    projects, tasks, users, clients,
    assignToProject, completeTask, setProjectPriority, addUser,
  } = useApp();

  const project = projects.find(p => p.id === task.projectId);
  const client = project ? clients.find(c => c.id === project.clientId) : null;
  const editors = users.filter(u => u.role === 'montazysta');

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedEditorId, setSelectedEditorId] = useState<string>(
    project?.assignedEditorId ?? ''
  );

  const [showNewEditor, setShowNewEditor] = useState(false);
  const [newEditorName, setNewEditorName] = useState('');

  // Priority overrides: projectId → EditPriority
  const [priorities, setPriorities] = useState<Record<string, EditPriority>>(() => ({
    [task.projectId]: toEditPriority(project?.priority),
  }));

  const currentPriority = priorities[task.projectId] ?? 'medium';

  // ── Editor's montage queue (other projects, not the current one) ─────────
  const queueProjects = useMemo(() => {
    if (!selectedEditorId) return [];
    return projects.filter(p => {
      if (p.id === task.projectId) return false;
      if (p.assignedEditorId !== selectedEditorId) return false;
      // Has active montage tasks (assigned to montazysta and not done/locked)
      return tasks.some(t =>
        t.projectId === p.id &&
        t.assignedRoles.includes('montazysta') &&
        (t.status === 'todo' || t.status === 'pending_client_approval')
      );
    });
  }, [projects, tasks, selectedEditorId, task.projectId]);

  // Initialise priorities for newly loaded queue projects
  const allQueued = useMemo(() => {
    const items = [
      { proj: project!, isCurrent: true },
      ...queueProjects.map(p => ({ proj: p, isCurrent: false })),
    ].filter(x => x.proj);

    // Ensure every project has a local priority
    items.forEach(({ proj }) => {
      if (!priorities[proj.id]) {
        setPriorities(prev => ({
          ...prev,
          [proj.id]: toEditPriority(proj.priority),
        }));
      }
    });

    // Sort: high → medium → low, current project stays in its natural position
    const order: Record<EditPriority, number> = { high: 0, medium: 1, low: 2 };
    return [...items].sort((a, b) => {
      const pa = priorities[a.proj.id] ?? toEditPriority(a.proj.priority);
      const pb = priorities[b.proj.id] ?? toEditPriority(b.proj.priority);
      return order[pa] - order[pb];
    });
  }, [project, queueProjects, priorities]); // eslint-disable-line

  // ── Gantt: calculate positions ───────────────────────────────────────────
  const ganttData = useMemo(() => {
    return allQueued.map(({ proj, isCurrent }) => {
      const prio = priorities[proj.id] ?? toEditPriority(proj.priority);
      const spans = PRIO[prio].slots;
      return { proj, isCurrent, prio, start: 0, spans };
    });
  }, [allQueued, priorities]);

  const maxSpans = ganttData.reduce((m, d) => Math.max(m, d.spans), 0);
  const isOverloaded = maxSpans > GANTT_SLOTS;

  // ── Gantt slot headers ───────────────────────────────────────────────────
  const today = startOfToday();
  const slotHeaders = Array.from({ length: GANTT_SLOTS }, (_, i) => ({
    top: format(addDays(today, i * 2), 'EEE', { locale: pl }),
    bottom: format(addDays(today, i * 2), 'dd.MM', { locale: pl }),
  }));

  // ── Confirm handler ──────────────────────────────────────────────────────
  const handleConfirm = () => {
    // Apply all priority changes
    Object.entries(priorities).forEach(([projectId, prio]) => {
      setProjectPriority(projectId, prio as ProjectPriority);
    });
    // Assign editor to current project
    if (selectedEditorId) {
      assignToProject(task.projectId, 'assignedEditorId', selectedEditorId);
    }
    // Complete the "Nadaj priorytet" task
    completeTask(task.id, currentPriority, 'admin');
    onOpenChange(false);
  };

  const getClient = (p: typeof project) =>
    p ? (clients.find(c => c.id === p.clientId)?.name ?? '—') : '—';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Film className="h-5 w-5 text-primary shrink-0" />
            Priorytet montażu
          </DialogTitle>
          <DialogDescription>
            Przypisz priorytet i montażystę dla pomysłu{' '}
            <span className="font-semibold text-foreground">{project?.name}</span>
            {client && <span className="text-muted-foreground"> · {client.name}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-1">

          {/* ── Row 1: Editor + Priority selectors ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <User2 className="h-3 w-3" />
                  Montażysta
                </label>
                {!showNewEditor && (
                  <button
                    type="button"
                    onClick={() => setShowNewEditor(true)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <UserPlus className="h-3 w-3" />Dodaj nowego
                  </button>
                )}
              </div>
              {showNewEditor ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">Nowy montażysta</span>
                    <button onClick={() => { setShowNewEditor(false); setNewEditorName(''); }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    placeholder="Imię i nazwisko *"
                    value={newEditorName}
                    onChange={e => setNewEditorName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={!newEditorName.trim()}
                    onClick={() => {
                      const newId = addUser({ name: newEditorName.trim(), role: 'montazysta' });
                      setSelectedEditorId(newId);
                      setNewEditorName('');
                      setShowNewEditor(false);
                    }}
                  >
                    <Check className="h-3 w-3" />Dodaj i wybierz
                  </Button>
                </div>
              ) : (
                <Select
                  value={selectedEditorId || 'none'}
                  onValueChange={v => setSelectedEditorId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz montażystę..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="none">— Wybierz —</SelectItem>
                    {editors.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className={`h-2.5 w-2.5 rounded-full ${PRIO[currentPriority].dot}`} />
                Priorytet tego pomysłu
              </label>
              <Select
                value={currentPriority}
                onValueChange={v =>
                  setPriorities(prev => ({ ...prev, [task.projectId]: v as EditPriority }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {(Object.keys(PRIO) as EditPriority[]).map(p => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${PRIO[p].dot}`} />
                        {PRIO[p].label} · {PRIO[p].days}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Workload panel (shown when editor selected) ── */}
          {selectedEditorId && (
            <>
              {/* Overload warning */}
              {isOverloaded && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Łączne obciążenie przekracza 14 dni ({maxSpans * 2} dni max).
                    Rozważ zmianę priorytetów lub wybór drugiego montażysty.
                  </span>
                </div>
              )}

              {/* Queue table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Kolejka montażu · {allQueued.length}{' '}
                    {allQueued.length === 1 ? 'pomysł' : allQueued.length < 5 ? 'pomysły' : 'pomysłów'}
                  </span>
                  {!isOverloaded && (
                    <div className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Mieści się w 14 dniach
                    </div>
                  )}
                  {isOverloaded && (
                    <div className="flex items-center gap-1 text-xs text-warning">
                      <Info className="h-3 w-3" />
                      {maxSpans * 2} dni max
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium w-6">#</th>
                        <th className="px-3 py-2 text-left font-medium">Pomysł</th>
                        <th className="px-3 py-2 text-left font-medium">Klient</th>
                        <th className="px-3 py-2 text-left font-medium w-40">Priorytet</th>
                        <th className="px-3 py-2 text-left font-medium w-24">Czas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ganttData.map(({ proj, isCurrent, prio }, idx) => (
                        <tr
                          key={proj.id}
                          className={`border-t border-border transition-colors ${
                            isCurrent ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-muted-foreground text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {isCurrent && (
                                <ChevronRight className="h-3 w-3 text-primary shrink-0" />
                              )}
                              <span className={isCurrent ? 'font-semibold text-foreground' : 'text-foreground'}>
                                {proj.name}
                              </span>
                              {isCurrent && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/40 text-primary">
                                  Przypisywany
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {getClient(proj)}
                          </td>
                          <td className="px-3 py-2">
                            {isCurrent ? (
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${PRIO[prio].badge}`}>
                                {PRIO[prio].label}
                              </span>
                            ) : (
                              <Select
                                value={priorities[proj.id] ?? toEditPriority(proj.priority)}
                                onValueChange={v =>
                                  setPriorities(prev => ({
                                    ...prev,
                                    [proj.id]: v as EditPriority,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  {(Object.keys(PRIO) as EditPriority[]).map(pr => (
                                    <SelectItem key={pr} value={pr}>
                                      <span className="flex items-center gap-2">
                                        <span className={`inline-block h-2 w-2 rounded-full ${PRIO[pr].dot}`} />
                                        {PRIO[pr].label} · {PRIO[pr].days}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {PRIO[prio].days}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Gantt chart ── */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Plan w oknach 2-dniowych (14 dni)
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  {/* Slot headers */}
                  <div className="flex border-b border-border bg-muted/50">
                    <div className="w-40 shrink-0 px-3 py-1.5 text-xs text-muted-foreground font-medium border-r border-border">
                      Pomysł
                    </div>
                    {slotHeaders.map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 min-w-0 px-1 py-1 text-center border-r border-border last:border-0"
                      >
                        <div className="text-[10px] font-semibold text-muted-foreground capitalize">{h.top}</div>
                        <div className="text-[9px] text-muted-foreground">{h.bottom}</div>
                      </div>
                    ))}
                  </div>

                  {/* Project rows */}
                  {ganttData.map(({ proj, isCurrent, prio, spans }) => {
                    const leftPct = 0;
                    const widthPct = (Math.min(spans, GANTT_SLOTS) / GANTT_SLOTS) * 100;
                    return (
                      <div
                        key={proj.id}
                        className={`flex border-b border-border last:border-0 ${
                          isCurrent ? 'bg-primary/5' : ''
                        }`}
                      >
                        {/* Project name */}
                        <div className="w-40 shrink-0 px-3 py-2 text-xs text-foreground truncate flex items-center gap-1 border-r border-border">
                          {isCurrent && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                          <span className="truncate">{proj.name}</span>
                        </div>

                        {/* Gantt area */}
                        <div className="flex-1 relative h-9">
                          {/* Background grid lines */}
                          {Array.from({ length: GANTT_SLOTS - 1 }).map((_, i) => (
                            <div
                              key={i}
                              className="absolute top-0 bottom-0 border-r border-border/50"
                              style={{ left: `${((i + 1) / GANTT_SLOTS) * 100}%` }}
                            />
                          ))}
                          {/* Bar */}
                          <div
                            className={`absolute top-1.5 bottom-1.5 rounded-md ${PRIO[prio].bar} opacity-85 flex items-center px-2 overflow-hidden`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          >
                            <span className="text-[10px] font-semibold text-white whitespace-nowrap truncate">
                              {PRIO[prio].label} · {PRIO[prio].days}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>

              {/* Empty state */}
              {allQueued.length === 1 && (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Montażysta nie ma innych pomysłów w kolejce — idealny wybór!
                </div>
              )}
            </>
          )}

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button
              disabled={!selectedEditorId}
              onClick={handleConfirm}
            >
              <Film className="mr-2 h-4 w-4" />
              Zatwierdź priorytet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
