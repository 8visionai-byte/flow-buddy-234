import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Task, ROLE_LABELS, UserRole, TaskHistoryEntry } from '@/types';
import SocialDescriptionsDisplay, { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import { tryParseSocialDates } from '@/components/SocialDatesWidget';
import StepBadge from '@/components/StepBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, MessageSquare, Send, ThumbsDown, ThumbsUp, User as UserIcon, Pencil, Link as LinkIcon, X, Check, Film, Hash, FileText, CalendarDays, Facebook, Instagram, Youtube, BookOpen, RotateCcw } from 'lucide-react';
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.74a8.18 8.18 0 0 0 4.79 1.52V6.79a4.85 4.85 0 0 1-1.02-.1z"/>
  </svg>
);
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import ActorAssignmentInput from '@/components/ActorAssignmentInput';
import { ActorEntry } from '@/types';
import { toast } from '@/hooks/use-toast';

interface CompletedTaskCardProps {
  task: Task;
  projectName: string;
}

const actionLabels: Record<TaskHistoryEntry['action'], string> = {
  submitted: 'Przesłano',
  approved: 'Zaakceptowano',
  rejected: 'Odrzucono z uwagami',
  file_notes: 'Uwagi naniesione',
  resubmitted: 'Poprawiono i wysłano ponownie',
  deferred: 'Odłożono na później',
  rejected_final: 'Odrzucono ostatecznie',
  resubmitted_auto_approved: 'Poprawki naniesione (bez akceptacji klienta)',
  auto_approved_by_influencer: 'Auto-zatwierdzono przez Influencera',
};

const actionIcons: Record<TaskHistoryEntry['action'], React.ReactNode> = {
  submitted: <Send className="h-3.5 w-3.5 text-primary" />,
  approved: <ThumbsUp className="h-3.5 w-3.5 text-success" />,
  rejected: <ThumbsDown className="h-3.5 w-3.5 text-destructive" />,
  file_notes: <MessageSquare className="h-3.5 w-3.5 text-warning" />,
  resubmitted: <MessageSquare className="h-3.5 w-3.5 text-warning" />,
  deferred: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  rejected_final: <ThumbsDown className="h-3.5 w-3.5 text-destructive" />,
  resubmitted_auto_approved: <Send className="h-3.5 w-3.5 text-primary" />,
  auto_approved_by_influencer: <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />,
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), "dd.MM.yyyy, HH:mm", { locale: pl });
}

const URL_REGEX = /^https?:\/\/.+\..+/;

interface RawFootagePayload { url: string; recordingNumber?: string; notes?: string; }
function tryParseRawFootage(val: string): RawFootagePayload | null {
  try {
    const p = JSON.parse(val);
    if (p && typeof p === 'object' && !Array.isArray(p) && typeof p.url === 'string' && /^https?:\/\//.test(p.url)) {
      return p as RawFootagePayload;
    }
  } catch {}
  return null;
}

const RawFootageDisplay = ({ payload }: { payload: RawFootagePayload }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-sm">
      <Film className="h-4 w-4 text-primary shrink-0" />
      <a
        href={payload.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:underline break-all"
      >
        {payload.url}
      </a>
    </div>
    {payload.recordingNumber && payload.recordingNumber.trim() && (
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        Nr nagrania: <span className="font-medium ml-1">{payload.recordingNumber}</span>
      </div>
    )}
    {payload.notes && payload.notes.trim() && (
      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{payload.notes}</p>
    )}
  </div>
);

const CompletedTaskCard = ({ task, projectName }: CompletedTaskCardProps) => {
  const { currentUser, updateTaskValue, tasks, reopenTask, clients, users, projects } = useApp();
  const [editingUrl, setEditingUrl] = useState(false);
  const [editUrlValue, setEditUrlValue] = useState('');
  const [urlError, setUrlError] = useState('');
  const [editingActors, setEditingActors] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [editTextValue, setEditTextValue] = useState('');

  // GENERAL RULE: a user can edit their submission as long as no downstream task
  // (any task with order > this one) has been completed yet. The moment the next
  // actor moves the work forward, the submission becomes immutable to keep
  // history consistent.
  const noDownstreamWorkDone = !tasks.some(
    t => t.projectId === task.projectId && t.order > task.order && t.status === 'done'
  );
  const isOwnerInfluencer =
    currentUser?.role === 'influencer' &&
    task.assignedRoles.includes('influencer') &&
    task.status === 'done';

  const canEditUrl = task.inputType === 'url' && isOwnerInfluencer && noDownstreamWorkDone;
  const canEditActors = task.inputType === 'actor_assignment' && isOwnerInfluencer && noDownstreamWorkDone;
  const canEditText = task.inputType === 'text' && isOwnerInfluencer && noDownstreamWorkDone;


  // Resolve project + client for ActorAssignmentInput (only needed when editing actors)
  const taskProject = projects.find(p => p.id === task.projectId) ?? null;
  const taskClient = taskProject ? (clients.find(c => c.id === taskProject.clientId) ?? null) : null;
  const taskClientUsers = taskProject
    ? users.filter(u => u.role === 'klient' && u.clientId === taskProject.clientId)
    : [];

  const handleSaveUrl = () => {
    if (!URL_REGEX.test(editUrlValue.trim())) {
      setUrlError('Podaj poprawny adres URL (https://...)');
      return;
    }
    updateTaskValue(task.id, editUrlValue.trim());
    setEditingUrl(false);
    setUrlError('');
  };

  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span>
          <StepBadge order={task.order} />
        </div>
        <Badge variant="secondary" className="gap-1 border-0 bg-success/10 text-success text-xs shrink-0">
          <CheckCircle2 className="h-3 w-3" />
          Ukończone
        </Badge>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>

      {/* Completion timestamp */}
      <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Zakończono: {formatTimestamp(task.completedAt)}
      </div>

      {/* Auto-approved by influencer (skipped client re-review) */}
      {task.value === 'auto_approved' && (
        <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Pominięto akceptację klienta</span> — Influencer uznał poprawki za drobne i niewymagające ponownej weryfikacji.
          </div>
        </div>
      )}

      {/* === SCRIPT REVIEW — explicit confirmation + change-decision option === */}
      {task.inputType === 'script_review' && (task.value === 'approved' || task.value === 'approved_with_file_notes') && (() => {
        const scriptUrl = task.previousValue && /^https?:\/\/.+\..+/.test(task.previousValue) ? task.previousValue : null;
        const hasFileNotes = task.value === 'approved_with_file_notes';
        // Allow change-decision only if no later task in the same project has been completed yet
        const laterDone = tasks.some(t => t.projectId === task.projectId && t.order > task.order && t.status === 'done');
        const canChange = currentUser?.role === 'klient' && !laterDone;
        return (
          <div className="mb-4 space-y-3">
            <div className={`flex items-start gap-3 rounded-xl border p-4 ${hasFileNotes ? 'border-warning/30 bg-warning/10' : 'border-success/30 bg-success/10'}`}>
              {hasFileNotes ? <MessageSquare className="h-5 w-5 text-warning shrink-0 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />}
              <div className="flex-1">
                <div className="font-semibold text-sm text-foreground">{hasFileNotes ? 'Uwagi w pliku przekazane' : 'Scenariusz zaakceptowany'}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {hasFileNotes ? 'Decyzja zapisana — influencer ma wrócić do pliku, uwzględnić komentarze i wysłać scenariusz ponownie.' : 'Decyzja przekazana — zespół przechodzi do kolejnego etapu.'}
                </div>
              </div>
            </div>
            {scriptUrl && (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {hasFileNotes ? 'Scenariusz z uwagami w pliku' : 'Zaakceptowany scenariusz'}
                </div>
                <a
                  href={scriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-2 hover:underline font-medium break-all"
                >
                  {scriptUrl}
                </a>
              </div>
            )}
            {canChange && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 h-10"
                onClick={() => reopenTask(task.id)}
              >
                <RotateCcw className="h-4 w-4" />
                Zmień decyzję
              </Button>
            )}
            {!canChange && currentUser?.role === 'klient' && laterDone && (
              <p className="text-xs text-muted-foreground text-center px-2">
                Nie można już zmienić decyzji — zespół rozpoczął kolejne etapy pomysłu.
              </p>
            )}
          </div>
        );
      })()}

      {/* Accepted value (skipped for script_review — handled in dedicated block above) */}
      {task.value === 'approved' && task.previousValue && task.inputType !== 'script_review' && (() => {
        try {
          const parsed = JSON.parse(task.previousValue);
          // New format: ActorEntry[] array
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) {
            return (
              <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Zaakceptowane osoby do filmu</div>
                <div className="space-y-1.5">
                  {parsed.map((actor: { id: string; name: string; roleLabel?: string; sourceType: string }) => (
                    <div key={actor.id} className="flex items-center gap-2 text-sm text-foreground">
                      <UserIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium">{actor.name}</span>
                      {actor.roleLabel && <Badge variant="secondary" className="text-[10px] border-0">{actor.roleLabel}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          // Old format: { type, name }
          if (parsed.type && parsed.name) {
            return (
              <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Zaakceptowana osoba do filmu</div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <UserIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{parsed.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{parsed.type === 'client' ? 'Klient' : 'Inna osoba'}</Badge>
                </div>
              </div>
            );
          }
        } catch {}
        return (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Zaakceptowana propozycja</div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{task.previousValue}</p>
          </div>
        );
      })()}

      {/* ACTOR APPROVAL — allow client to change decision before later tasks start */}
      {task.inputType === 'actor_approval' && (task.value === 'approved' || task.value?.startsWith('approved: ') || task.value === 'rejected' || task.value?.startsWith('rejected: ')) && (() => {
        const laterDone = tasks.some(t => t.projectId === task.projectId && t.order > task.order && t.status === 'done');
        const canChange = currentUser?.role === 'klient' && !laterDone;
        if (!canChange) {
          if (currentUser?.role === 'klient' && laterDone) {
            return (
              <p className="mb-4 text-xs text-muted-foreground text-center px-2">
                Nie można już zmienić decyzji — zespół rozpoczął kolejne etapy pomysłu.
              </p>
            );
          }
          return null;
        }
        return (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 h-10"
              onClick={() => reopenTask(task.id)}
            >
              <RotateCcw className="h-4 w-4" />
              Zmień decyzję
            </Button>
          </div>
        );
      })()}

      {/* Social dates display (admin "Ustaw datę publikacji" task) */}
      {task.inputType === 'social_dates' && task.value && (() => {
        const dates = tryParseSocialDates(task.value);
        if (!dates) return null;
        const PLATFORM_CONFIG = [
          { dateKey: 'facebookDate' as const, label: 'Facebook', icon: <Facebook className="h-3.5 w-3.5 text-[#1877F2]" /> },
          { dateKey: 'tiktokDate' as const, label: 'TikTok', icon: <TikTokIcon className="h-3.5 w-3.5 text-foreground" /> },
          { dateKey: 'instagramDate' as const, label: 'Instagram', icon: <Instagram className="h-3.5 w-3.5 text-[#E4405F]" /> },
          { dateKey: 'youtubeDate' as const, label: 'YouTube', icon: <Youtube className="h-3.5 w-3.5 text-[#FF0000]" /> },
        ] as const;
        return (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Daty publikacji</div>
            <div className="space-y-1.5">
              {PLATFORM_CONFIG.map(p => {
                const dateVal = dates[p.dateKey];
                if (!dateVal) return null;
                return (
                  <div key={p.dateKey} className="flex items-center gap-2 text-sm">
                    {p.icon}
                    <span className="font-medium text-foreground">{p.label}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(dateVal), 'dd.MM.yyyy', { locale: pl })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Multi-party notes (Wnieś uwagi przed montażem) */}
      {task.inputType === 'multi_party_notes' && task.value && (() => {
        try {
          const notes: Record<string, string> = JSON.parse(task.value);
          const entries = Object.entries(notes).filter(([, v]) => v);

          // Pull operator's note from raw_footage task in same project
          const rawTask = tasks.find(t => t.projectId === task.projectId && t.inputType === 'raw_footage' && t.status === 'done');
          let operatorNote: { url?: string; notes?: string } | undefined;
          try {
            if (rawTask?.value) {
              const parsed = JSON.parse(rawTask.value);
              if (parsed?.notes || parsed?.url) operatorNote = parsed;
            }
          } catch { /* ignore */ }
          const hasOperator = !!(operatorNote && (operatorNote.notes?.trim() || operatorNote.url?.trim()));

          if (!entries.length && !hasOperator) return null;
          return (
            <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Uwagi przed montażem</div>
              {hasOperator && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                    Operator (surówka)
                  </div>
                  {operatorNote!.notes?.trim() && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{operatorNote!.notes}</p>
                  )}
                  {operatorNote!.url?.trim() && (
                    <a href={operatorNote!.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      Otwórz surówkę
                    </a>
                  )}
                </div>
              )}
              {entries.map(([role, note]) => (
                <div key={role}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                    {ROLE_LABELS[role as UserRole] || role}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note}</p>
                </div>
              ))}
            </div>
          );
        } catch { return null; }
      })()}

      {task.inputType === 'publication_confirm' && task.value && (() => {
        try {
          const confirmedRaw: Record<string, string | boolean | null> = JSON.parse(task.value);
          const PLAT_LABELS: Record<string, string> = { facebook: 'Facebook', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };
          const PLAT_ICONS: Record<string, React.ReactNode> = {
            facebook: <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />,
            tiktok: <TikTokIcon className="h-3.5 w-3.5 text-foreground" />,
            instagram: <Instagram className="h-3.5 w-3.5 text-[#E4405F]" />,
            youtube: <Youtube className="h-3.5 w-3.5 text-[#FF0000]" />,
          };
          return (
            <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Publikacja per platforma</span>
              {Object.entries(confirmedRaw).map(([platform, v]) => {
                const isDone = !!v;
                const timestamp = typeof v === 'string' ? v : null;
                return (
                  <div key={platform} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {PLAT_ICONS[platform]}
                      <span className="font-medium">{PLAT_LABELS[platform] || platform}</span>
                    </div>
                    {isDone
                      ? timestamp
                        ? <span className="text-xs text-success">{format(new Date(timestamp), 'dd.MM.yyyy, HH:mm', { locale: pl })}</span>
                        : <span className="text-xs text-success">Potwierdzono</span>
                      : <span className="text-xs text-muted-foreground italic">Nie wykonano</span>
                    }
                  </div>
                );
              })}
            </div>
          );
        } catch { return null; }
      })()}

      {task.value && task.value !== 'true' && task.value !== 'approved' && task.value !== 'approved_with_file_notes' && task.value !== 'skipped' && task.inputType !== 'social_dates' && task.inputType !== 'publication_confirm' && task.inputType !== 'multi_party_notes' && (
        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {task.inputType === 'url' ? 'Przesłany link'
                : task.inputType === 'raw_footage' ? 'Wgrana surówka'
                : task.inputType === 'actor_approval' ? 'Komentarz do akceptacji'
                : task.inputType === 'actor_assignment' ? 'Przesłana obsada'
                : task.inputType === 'filming_confirmation' ? 'Potwierdzenie nagrania'
                : 'Przesłana treść'}
            </span>
            {canEditUrl && !editingUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => { setEditUrlValue(task.value ?? ''); setEditingUrl(true); setUrlError(''); }}
              >
                <Pencil className="h-3 w-3" />
                Popraw link
              </Button>
            )}
            {canEditActors && !editingActors && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => setEditingActors(true)}
              >
                <Pencil className="h-3 w-3" />
                Popraw obsadę
              </Button>
            )}
            {canEditText && !editingText && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => {
                  setEditTextValue(task.value === 'Nie wymagane' ? '' : (task.value ?? ''));
                  setEditingText(true);
                }}
              >
                <Pencil className="h-3 w-3" />
                Popraw
              </Button>
            )}
          </div>
          {editingText ? (
            <div className="space-y-2 mt-1">
              <textarea
                value={editTextValue}
                onChange={e => setEditTextValue(e.target.value)}
                className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                placeholder="Wpisz tutaj... (zostaw puste, aby oznaczyć jako Nie wymagane)"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    const trimmed = editTextValue.trim();
                    updateTaskValue(task.id, trimmed || 'Nie wymagane');
                    setEditingText(false);
                    toast({ title: 'Zapisano', description: 'Treść została zaktualizowana.' });
                  }}
                >
                  <Check className="h-3 w-3" />Zapisz
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditingText(false)}
                >
                  <X className="h-3 w-3" />Anuluj
                </Button>
              </div>
            </div>
          ) : editingActors ? (
            <div className="space-y-3 mt-2">
              <ActorAssignmentInput
                client={taskClient}
                clientUsers={taskClientUsers}
                initialActors={(() => {
                  try {
                    const parsed = JSON.parse(task.value ?? '');
                    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) return parsed as ActorEntry[];
                  } catch {}
                  return [];
                })()}
                onSubmit={(actors: ActorEntry[]) => {
                  updateTaskValue(task.id, JSON.stringify(actors));
                  setEditingActors(false);
                  toast({
                    title: 'Obsada poprawiona',
                    description: 'Klient zobaczy zaktualizowaną propozycję.',
                  });
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => setEditingActors(false)}
              >
                <X className="h-3 w-3" />Anuluj
              </Button>
            </div>
          ) : editingUrl ? (
            <div className="space-y-2 mt-1">
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={editUrlValue}
                  onChange={e => { setEditUrlValue(e.target.value); setUrlError(''); }}
                  className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="https://..."
                  autoFocus
                />
              </div>
              {urlError && <p className="text-xs text-destructive">{urlError}</p>}
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveUrl}>
                  <Check className="h-3 w-3" />Zapisz
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setEditingUrl(false); setUrlError(''); }}>
                  <X className="h-3 w-3" />Anuluj
                </Button>
              </div>
            </div>
          ) : (
            tryParseSocialDescriptions(task.value) ? (
              <SocialDescriptionsDisplay value={task.value} />
            ) : (() => {
              // raw_footage: { url, recordingNumber, notes }
              const rawFootage = tryParseRawFootage(task.value!);
              if (rawFootage) return <RawFootageDisplay payload={rawFootage} />;
              try {
                const parsed = JSON.parse(task.value!);
                // New format: ActorEntry[]
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) {
                  return (
                    <div className="space-y-1.5">
                      {parsed.map((actor: { id: string; name: string; roleLabel?: string }) => (
                        <div key={actor.id} className="flex items-center gap-2 text-sm text-foreground">
                          <UserIcon className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium">{actor.name}</span>
                          {actor.roleLabel && <Badge variant="secondary" className="text-[10px] border-0">{actor.roleLabel}</Badge>}
                        </div>
                      ))}
                    </div>
                  );
                }
                // Old format: { type, name }
                if (parsed.type && parsed.name) {
                  return (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <UserIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{parsed.name}</span>
                      <span className="text-xs text-muted-foreground">({parsed.type === 'client' ? 'Klient' : 'Aktor'})</span>
                    </div>
                  );
                }
              } catch {}
              // Strip "approved: " prefix from actor_approval comments
              const displayValue = task.inputType === 'actor_approval' && task.value?.startsWith('approved: ')
                ? task.value.slice('approved: '.length)
                : task.value;
              return <p className="text-sm text-foreground whitespace-pre-wrap break-all">{displayValue}</p>;
            })()
          )}
        </div>
      )}

      {task.value === 'true' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-4 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Potwierdzono
        </div>
      )}

      {/* History accordion */}
      {task.history.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="history" className="border-border">
            <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground hover:no-underline">
              Pokaż historię ustaleń ({task.history.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {task.history.map((entry, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="mt-0.5 shrink-0">{actionIcons[entry.action]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{actionLabels[entry.action]}</span>
                        <Badge variant="secondary" className="text-[10px] border-0">{ROLE_LABELS[entry.by]}</Badge>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                      </div>
                      {entry.value && entry.value !== 'approved' && entry.value !== 'true' && (() => {
                        const v = entry.value!;
                        // Social descriptions
                        if (tryParseSocialDescriptions(v)) return <div className="mt-1"><SocialDescriptionsDisplay value={v} /></div>;
                        // Raw footage
                        const rf = tryParseRawFootage(v);
                        if (rf) return <div className="mt-1"><RawFootageDisplay payload={rf} /></div>;
                        // Try JSON
                        try {
                          const parsed = JSON.parse(v);
                          // ActorEntry[]
                          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) {
                            return <p className="mt-1 text-muted-foreground text-xs">{parsed.map((a: { name: string }) => a.name).join(', ')}</p>;
                          }
                          // Old actor format
                          if (parsed.type && parsed.name) {
                            return <p className="mt-1 text-muted-foreground text-xs">Osoba: {parsed.name}</p>;
                          }
                          // Multi-party notes
                          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                            const notes = Object.entries(parsed).filter(([, nv]) => nv && typeof nv === 'string') as [string, string][];
                            if (notes.length && !notes.some(([k]) => ['facebookDate','tiktokDate','instagramDate','youtubeDate'].includes(k))) {
                              return (
                                <div className="mt-1 space-y-1">
                                  {notes.map(([role, note]) => (
                                    <div key={role} className="text-xs text-muted-foreground">
                                      <span className="font-medium">{ROLE_LABELS[role as UserRole] || role}: </span>
                                      <span className="whitespace-pre-wrap">{note}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            // Social dates
                            const dateKeys = ['facebookDate','tiktokDate','instagramDate','youtubeDate'];
                            const dateEntries = Object.entries(parsed).filter(([k, dv]) => dateKeys.includes(k) && dv) as [string, string][];
                            if (dateEntries.length) {
                              const labelMap: Record<string, string> = { facebookDate: 'FB', tiktokDate: 'TT', instagramDate: 'IG', youtubeDate: 'YT' };
                              return <p className="mt-1 text-xs text-muted-foreground">{dateEntries.map(([k, dv]) => `${labelMap[k]} ${format(new Date(dv), 'dd.MM', { locale: pl })}`).join(' · ')}</p>;
                            }
                          }
                        } catch {}
                        // Strip "approved: " prefix
                        const display = v.startsWith('approved: ') ? v.slice('approved: '.length) : v;
                        return <p className="mt-1 text-muted-foreground whitespace-pre-wrap text-xs">{display}</p>;
                      })()}
                      {entry.feedback && (
                        <p className="mt-1 text-destructive whitespace-pre-wrap text-xs">Uwagi: {entry.feedback}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

export default CompletedTaskCard;
