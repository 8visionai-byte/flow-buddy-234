import { Project, Task, Client, ROLE_LABELS, ActorEntry } from '@/types';
import { PIPELINE_STAGES } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Circle, Lock, Clock, ArrowLeft,
  ExternalLink, BookOpen, Link as LinkIcon, User as UserIcon,
  AlertTriangle, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

// ── Value display helpers ──────────────────────────────────────────────────────

function renderTaskValue(value: string | null, inputType: Task['inputType']): React.ReactNode {
  if (!value) return null;

  // Actor assignment (new format: ActorEntry[])
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.sourceType) {
      const actors = parsed as ActorEntry[];
      return (
        <div className="mt-1.5 space-y-1">
          {actors.map(a => (
            <div key={a.id} className="flex items-center gap-1.5 flex-wrap">
              <UserIcon className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground font-medium">{a.name}</span>
              {a.roleLabel && (
                <Badge variant="secondary" className="text-[9px] border-0 h-4">{a.roleLabel}</Badge>
              )}
              {a.telegramHandle && (
                <span className="text-[10px] text-muted-foreground">{a.telegramHandle}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
  } catch {}

  // Filming confirmation / raw footage JSON
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && 'recordingNumber' in parsed) {
      if ('url' in parsed) {
        // raw_footage
        return (
          <div className="mt-1.5 space-y-1">
            <span className="text-xs font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
              #{parsed.recordingNumber}
            </span>
            {parsed.url && (
              <a href={parsed.url} target="_blank" rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline break-all"
                onClick={e => e.stopPropagation()}>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                Surówka
              </a>
            )}
            {parsed.notes && <p className="text-xs text-muted-foreground italic mt-0.5">"{parsed.notes}"</p>}
          </div>
        );
      } else {
        // filming_confirmation
        return (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
              #{parsed.recordingNumber}
            </span>
            {parsed.notes && <span className="text-xs text-muted-foreground italic">"{parsed.notes}"</span>}
          </div>
        );
      }
    }
  } catch {}

  // URL
  if (/^https?:\/\/.+\..+/.test(value)) {
    const isScript = inputType === 'url';
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline break-all"
        onClick={e => e.stopPropagation()}
      >
        {isScript ? <BookOpen className="h-3 w-3 shrink-0" /> : <LinkIcon className="h-3 w-3 shrink-0" />}
        <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
        <span className="truncate">{value}</span>
      </a>
    );
  }

  // Approved variants
  if (value === 'approved' || value.startsWith('approved')) {
    const notes = value.startsWith('approved: ') ? value.slice('approved: '.length) : null;
    return (
      <div className="mt-1.5 flex items-start gap-1.5">
        <ThumbsUp className="h-3 w-3 text-success shrink-0 mt-0.5" />
        <div>
          <span className="text-xs font-medium text-success">Zaakceptowano</span>
          {notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{notes}"</p>}
        </div>
      </div>
    );
  }

  // Social descriptions
  if (inputType === 'social_descriptions') {
    try {
      const desc: Record<string, string> = JSON.parse(value);
      const PLAT_LABELS: Record<string, string> = { facebook: 'Facebook', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };
      const entries = Object.entries(desc).filter(([, v]) => v);
      if (entries.length) {
        return (
          <div className="mt-1.5 space-y-1.5">
            {entries.map(([k, v]) => (
              <div key={k}>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{PLAT_LABELS[k] || k}: </span>
                <span className="text-xs text-foreground">{v.length > 80 ? v.slice(0, 80) + '…' : v}</span>
              </div>
            ))}
          </div>
        );
      }
    } catch {}
  }

  // Social dates
  if (inputType === 'social_dates') {
    try {
      const dates: Record<string, string> = JSON.parse(value);
      const DATE_KEYS = ['facebookDate', 'tiktokDate', 'instagramDate', 'youtubeDate'];
      const LABELS: Record<string, string> = { facebookDate: 'FB', tiktokDate: 'TT', instagramDate: 'IG', youtubeDate: 'YT' };
      const parts = DATE_KEYS.filter(k => dates[k]).map(k => `${LABELS[k]} ${format(new Date(dates[k]), 'dd.MM', { locale: pl })}`);
      if (parts.length) return <p className="mt-1.5 text-xs text-muted-foreground">{parts.join(' · ')}</p>;
    } catch {}
  }

  // Multi-party notes
  if (inputType === 'multi_party_notes') {
    try {
      const notes: Record<string, string> = JSON.parse(value);
      const entries = Object.entries(notes).filter(([, v]) => v);
      if (entries.length) {
        return (
          <div className="mt-1.5 space-y-1">
            {entries.map(([role, note]) => (
              <div key={role} className="text-xs text-muted-foreground">
                <span className="font-medium">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}: </span>
                <span>{note.length > 80 ? note.slice(0, 80) + '…' : note}</span>
              </div>
            ))}
          </div>
        );
      }
    } catch {}
  }

  // Publication confirm
  if (inputType === 'publication_confirm') {
    try {
      const confirmed: Record<string, string | boolean | null> = JSON.parse(value);
      const PLAT_LABELS: Record<string, string> = { facebook: 'Facebook', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };
      const entries = Object.entries(confirmed);
      if (entries.length) {
        return (
          <div className="mt-1.5 space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{PLAT_LABELS[k] || k}:</span>
                {v
                  ? <span className="text-success font-medium">{typeof v === 'string' ? format(new Date(v), 'dd.MM.yyyy, HH:mm', { locale: pl }) : 'Potwierdzono'}</span>
                  : <span className="text-muted-foreground/60 italic">Nie wykonano</span>
                }
              </div>
            ))}
          </div>
        );
      }
    } catch {}
  }

  // Long text — truncate
  const truncated = value.length > 120 ? value.slice(0, 120) + '…' : value;
  return <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{truncated}</p>;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function stageStatusIcon(status: Task['status'], isMyStage: boolean) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />;
    case 'todo':
    case 'pending_client_approval':
      return <Circle className={`h-4 w-4 shrink-0 ${isMyStage ? 'text-primary' : 'text-warning'}`} />;
    case 'needs_influencer_revision':
      return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
    case 'deferred':
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
    case 'rejected_final':
      return <ThumbsDown className="h-4 w-4 text-destructive shrink-0" />;
    default:
      return <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
  }
}

function stageStatusLabel(status: Task['status']): { text: string; className: string } {
  switch (status) {
    case 'done':             return { text: 'Ukończono', className: 'bg-success/10 text-success border-0' };
    case 'todo':             return { text: 'W toku', className: 'bg-primary/10 text-primary border-0' };
    case 'pending_client_approval': return { text: 'Oczekuje na klienta', className: 'bg-warning/10 text-warning border-0' };
    case 'needs_influencer_revision': return { text: 'Do poprawy', className: 'bg-destructive/10 text-destructive border-0' };
    case 'deferred':         return { text: 'Odłożono', className: 'bg-muted text-muted-foreground border-0' };
    case 'rejected_final':   return { text: 'Odrzucono', className: 'bg-destructive/10 text-destructive border-0' };
    default:                 return { text: 'Oczekuje', className: 'bg-muted text-muted-foreground/60 border-0' };
  }
}

// ── Phase labels ───────────────────────────────────────────────────────────────
const PHASE_LABELS: Record<number, string> = {
  0: '📋 Faza 1 — Pomysł',
  2: '📝 Faza 2 — Scenariusz',
  4: '🎬 Faza 3 — Obsada',
  6: '🎥 Faza 4 — Przygotowanie do nagrania',
  12: '✂️ Faza 5 — Montaż',
  17: '✅ Faza 6 — Finalizacja i publikacja',
};

const PHASE_STARTS = new Set(Object.keys(PHASE_LABELS).map(Number));

// ── Main component ─────────────────────────────────────────────────────────────

interface ProjectReadOnlyViewProps {
  project: Project;
  tasks: Task[];
  client: Client | null;
  currentUserRole: string;
  onBack: () => void;
}

export default function ProjectReadOnlyView({
  project,
  tasks,
  client,
  currentUserRole,
  onBack,
}: ProjectReadOnlyViewProps) {
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  const projectTasks = tasks
    .filter(t => t.projectId === project.id)
    .sort((a, b) => a.order - b.order);

  const doneCount = projectTasks.filter(t => t.status === 'done').length;
  const totalCount = projectTasks.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  const toggleExpand = (order: number) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      next.has(order) ? next.delete(order) : next.add(order);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Wróć
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">{project.name}</h2>
            {client && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {client.companyName} · {client.contactName}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-semibold text-foreground">{doneCount}/{totalCount}</div>
            <div className="text-[10px] text-muted-foreground">etapów</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {/* Read-only notice */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Widok tylko do odczytu — akcje wykonujesz w zakładce <strong className="text-foreground mx-1">Zadania</strong>.
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 space-y-1">
        {projectTasks.map((task, idx) => {
          const stageDef = PIPELINE_STAGES[task.order];
          const isMyStage = stageDef?.roles.includes(currentUserRole as any) ?? false;
          const isLocked = task.status === 'locked';
          // Filming task with a pre-set value is effectively done even if pipeline status lags
          const isDone = task.status === 'done' ||
            (task.title === 'Ustaw termin planu zdjęciowego' && !!task.value);
          const isActive = !isLocked && !isDone;
          const isExpanded = expandedStages.has(task.order) || isActive;
          const canExpand = isDone && (task.value || task.clientFeedback || task.history.length > 0);
          const showPhaseLabel = PHASE_STARTS.has(task.order);
          const statusInfo = isDone && task.status !== 'done'
            ? { text: 'Ukończono', className: 'bg-success/10 text-success border-0' }
            : stageStatusLabel(task.status);

          return (
            <div key={task.id}>
              {/* Phase divider */}
              {showPhaseLabel && (
                <div className="flex items-center gap-2 py-2 mt-2 first:mt-0">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {PHASE_LABELS[task.order]}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {/* Stage row */}
              <div
                className={`rounded-lg border transition-colors ${
                  isActive && isMyStage
                    ? 'border-primary/30 bg-primary/[0.03]'
                    : isActive
                      ? 'border-warning/30 bg-warning/[0.03]'
                      : isLocked
                        ? 'border-border bg-muted/20 opacity-60'
                        : 'border-border bg-card'
                } ${canExpand || isActive ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                onClick={() => (canExpand || isActive) && toggleExpand(task.order)}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* Status icon */}
                  {stageStatusIcon(task.status, isMyStage)}

                  {/* Stage number + title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                      {isMyStage && !isLocked && (
                        <Badge variant="outline" className="text-[9px] border-primary/40 text-primary h-4">
                          Twój etap
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {stageDef?.roles.map(r => ROLE_LABELS[r]).join(' + ')}
                      </span>
                      {task.completedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          · {format(new Date(task.completedAt), 'dd.MM.yyyy HH:mm', { locale: pl })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={`text-[9px] h-4 ${statusInfo.className}`}>
                      {statusInfo.text}
                    </Badge>
                    {canExpand && (
                      isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (task.value || task.clientFeedback || task.description) && (
                  <div className="px-10 pb-3 border-t border-border/60 pt-2 space-y-2">
                    {/* Description for active tasks */}
                    {isActive && stageDef?.description && (
                      <p className="text-xs text-muted-foreground">{stageDef.description}</p>
                    )}

                    {/* Submitted value */}
                    {task.value && task.value !== 'true' && renderTaskValue(task.value, task.inputType)}

                    {/* Client feedback (rejection notes) */}
                    {task.clientFeedback && (
                      <div className="flex items-start gap-1.5 rounded-md bg-destructive/8 px-2.5 py-2">
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Uwagi klienta</span>
                          <p className="text-xs text-destructive/80 mt-0.5">{task.clientFeedback}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {totalCount === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Brak etapów dla tego projektu.
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
