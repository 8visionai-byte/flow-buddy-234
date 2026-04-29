import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import SocialDescriptionsDisplay, { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import SocialDescriptionsInput from '@/components/SocialDescriptionsInput';
import PublicationConfirmPanel from '@/components/PublicationConfirmPanel';
import ActorAssignmentInput from '@/components/ActorAssignmentInput';
import MultiPartyNotesPanel from '@/components/MultiPartyNotesPanel';
import { Task, ROLE_LABELS, TaskHistoryEntry, ActorEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle2, Link as LinkIcon, FileText, AlertCircle, ThumbsUp, ThumbsDown, Send, MessageSquare, CalendarClock, UserPlus, User as UserIcon, Clock, XCircle, ExternalLink, BookOpen, CheckCheck, Copy, Check, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import SlaTimer from '@/components/SlaTimer';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

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
  rejected_final: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  resubmitted_auto_approved: <Send className="h-3.5 w-3.5 text-primary" />,
  auto_approved_by_influencer: <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />,
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), "dd.MM.yyyy, HH:mm", { locale: pl });
}

const HistoryAccordion = ({ history }: { history: TaskHistoryEntry[] }) => {
  if (history.length === 0) return null;
  return (
    <Accordion type="single" collapsible className="w-full mt-4">
      <AccordionItem value="history" className="border-border">
        <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground hover:no-underline">
          Historia ustaleń ({history.length})
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pt-2">
            {history.map((entry, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="mt-0.5 shrink-0">{actionIcons[entry.action]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{actionLabels[entry.action]}</span>
                    <Badge variant="secondary" className="text-[10px] border-0">{ROLE_LABELS[entry.by]}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  {entry.value && (
                    tryParseSocialDescriptions(entry.value) ? (
                      <div className="mt-1"><SocialDescriptionsDisplay value={entry.value} /></div>
                    ) : (
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap text-xs">{entry.value}</p>
                    )
                  )}
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
  );
};

interface TaskCardProps {
  task: Task;
  projectName: string;
}

const URL_REGEX = /^https?:\/\/.+\..+/;

const TaskCard = ({ task, projectName }: TaskCardProps) => {
  const { completeTask, rejectTask, resubmitTask, resubmitTaskAndAutoApprove, updateTaskValue, saveDraftValue, rejectFinalTask, currentUser, projects, clients, users, tasks, updatePartyNote } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [feedbackValue, setFeedbackValue] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showRejectFinalForm, setShowRejectFinalForm] = useState(false);
  const [rejectFinalReason, setRejectFinalReason] = useState('');
  const [error, setError] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [noteText, setNoteText] = useState('');
  // socialFields state removed — handled by SocialDescriptionsInput component
  const [actorType, setActorType] = useState<'client' | 'custom'>('client');
  const [actorCustomName, setActorCustomName] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [fileNotesSubmitted, setFileNotesSubmitted] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [editUrlValue, setEditUrlValue] = useState('');
  const [briefDraft, setBriefDraft] = useState<string>(() => {
    // Pre-fill from existing scratchpad (roleCompletions['influencer']) or empty
    return task.roleCompletions?.['influencer'] ?? '';
  });
  const [briefDraftSaved, setBriefDraftSaved] = useState(false);
  // Private notes for "Brief dla montażysty" card (stored in the "Wnieś uwagi" task)
  const notesTaskForBrief = task.title === 'Brief dla montażysty'
    ? tasks.find(nt => nt.projectId === task.projectId && nt.title === 'Wnieś uwagi przed montażem')
    : null;
  const [privateNotesDraft, setPrivateNotesDraft] = useState<string>(
    () => notesTaskForBrief?.roleCompletions?.['influencer'] ?? ''
  );
  const [privateNotesSaved, setPrivateNotesSaved] = useState(false);
  const [recordingNumber, setRecordingNumber] = useState('');
  const [additionalRawTaskIds, setAdditionalRawTaskIds] = useState<Set<string>>(new Set());

  const project = projects.find(p => p.id === task.projectId);

  // Other "Wgraj surówkę na serwer" tasks for the operator that are still to-do
  const otherRawFootageTasks = task.inputType === 'raw_footage' && task.status === 'todo'
    ? tasks
        .filter(t => t.id !== task.id && t.inputType === 'raw_footage' && t.status === 'todo' && (t.assignedRoles?.includes('operator') || t.assignedRole === 'operator'))
        .map(t => {
          const proj = projects.find(p => p.id === t.projectId);
          const sameClient = proj?.clientId && project?.clientId && proj.clientId === project.clientId;
          return { task: t, project: proj, sameClient: !!sameClient };
        })
        .sort((a, b) => Number(b.sameClient) - Number(a.sameClient))
    : [];

  const handleSubmit = () => {
    if (task.inputType === 'filming_confirmation') {
      if (!recordingNumber.trim()) {
        setError('Podaj numer nagrania');
        return;
      }
      const jsonValue = JSON.stringify({ recordingNumber: recordingNumber.trim(), notes: noteText.trim() });
      completeTask(task.id, jsonValue, currentUser?.role);
      return;
    }
    if (task.inputType === 'raw_footage') {
      if (!URL_REGEX.test(noteUrl)) {
        setError('Podaj poprawny adres URL surówki (https://...)');
        return;
      }
      const jsonValue = JSON.stringify({ url: noteUrl.trim(), notes: noteText.trim() });
      completeTask(task.id, jsonValue, currentUser?.role);
      // Apply same link / note to additionally selected operator tasks
      additionalRawTaskIds.forEach(extraId => {
        completeTask(extraId, jsonValue, currentUser?.role);
      });
      setAdditionalRawTaskIds(new Set());
      return;
    }
    if (task.inputType === 'actor_assignment') {
      if (actorType === 'custom' && actorCustomName.trim().length === 0) {
        setError('Wpisz imię i nazwisko osoby');
        return;
      }
      const name = actorType === 'client' ? (project?.clientName || 'Klient') : actorCustomName.trim();
      setError('');
      completeTask(task.id, JSON.stringify({ type: actorType, name }), currentUser?.role);
      return;
    }
    // social_descriptions handled by SocialDescriptionsInput component directly
    if (task.inputType === 'url' && !URL_REGEX.test(inputValue)) {
      setError('Podaj poprawny adres URL (https://...)');
      return;
    }
    if (task.inputType === 'text' && inputValue.trim().length === 0) {
      setError('To pole nie może być puste');
      return;
    }
    setError('');
    const value = task.inputType === 'boolean' ? 'true' : inputValue;
    completeTask(task.id, value, currentUser?.role);
  };

  const handleApprove = () => {
    completeTask(task.id, 'approved', currentUser?.role);
  };

  const handleReject = () => {
    if (feedbackValue.trim().length === 0) {
      setError('Wpisz uwagi przed wysłaniem');
      return;
    }
    setError('');
    rejectTask(task.id, feedbackValue);
    setFeedbackValue('');
    setShowFeedbackForm(false);
  };

  const handleResubmit = () => {
    if (task.inputType === 'text' && inputValue.trim().length === 0) {
      setError('To pole nie może być puste');
      return;
    }
    if (task.inputType === 'url' && !URL_REGEX.test(inputValue)) {
      setError('Podaj poprawny adres URL (https://...)');
      return;
    }
    setError('');
    resubmitTask(task.id, inputValue);
  };

  const handleResubmitAutoApprove = () => {
    if (task.inputType === 'text' && inputValue.trim().length === 0) {
      setError('To pole nie może być puste');
      return;
    }
    if (task.inputType === 'url' && !URL_REGEX.test(inputValue)) {
      setError('Podaj poprawny adres URL (https://...)');
      return;
    }
    setError('');
    resubmitTaskAndAutoApprove(task.id, inputValue);
  };

  const isSubmitDisabled =
    task.inputType === 'url' ? !URL_REGEX.test(inputValue) :
    task.inputType === 'text' ? inputValue.trim().length === 0 :
    false;

  // === DEFERRED VIEW ===
  if (task.status === 'deferred') {
    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-2"><span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span></div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Odłożono na później — wróćcie do tego etapu w odpowiednim momencie.</span>
        </div>
        <HistoryAccordion history={task.history} />
      </div>
    );
  }

  // === REJECTED FINAL VIEW ===
  if (task.status === 'rejected_final') {
    return (
      <div className="animate-fade-in rounded-xl border border-destructive/30 bg-card p-6 shadow-sm">
        <div className="mb-2"><span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span></div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Odrzucono ostatecznie</div>
            {task.clientFeedback && <div className="mt-1 text-xs opacity-80">{task.clientFeedback}</div>}
          </div>
        </div>
        <HistoryAccordion history={task.history} />
      </div>
    );
  }

  // === SCRIPT REVIEW VIEW (Client sees script link, accepts or notes in file) ===
  if (task.inputType === 'script_review') {
    const scriptUrl = task.previousValue && /^https?:\/\/.+\..+/.test(task.previousValue) ? task.previousValue : null;
    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span>
          <SlaTimer assignedAt={task.assignedAt} compact />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>

        {scriptUrl ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              Scenariusz do oceny
            </div>
            <div className="flex items-center gap-2">
              <a
                href={scriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-primary underline-offset-2 hover:underline font-medium"
              >
                {scriptUrl}
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(scriptUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                title="Kopiuj link"
              >
                {copiedUrl ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Otwórz dokument, przejrzyj scenariusz i ewentualnie dodaj komentarze bezpośrednio w pliku. Następnie zaznacz decyzję poniżej.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
            Link do scenariusza zostanie wyświetlony gdy influencer go doda.
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Twoja decyzja</p>
          <Button
            className="w-full justify-start gap-3 h-12"
            onClick={() => completeTask(task.id, 'approved', 'klient')}
            disabled={!scriptUrl}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-sm">Akceptuję scenariusz</div>
              <div className="text-xs opacity-80 font-normal">Scenariusz jest gotowy, przechodzimy dalej</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
            onClick={() => { setFileNotesSubmitted(true); completeTask(task.id, 'approved_with_file_notes', 'klient'); }}
            disabled={!scriptUrl || fileNotesSubmitted}
          >
            <MessageSquare className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-sm">Uwagi naniesione w pliku</div>
              <div className="text-xs opacity-80 font-normal">Dodałam/em komentarze w dokumencie — influencer je widzi</div>
            </div>
          </Button>
        </div>

        {!scriptUrl && (
          <p className="text-xs text-muted-foreground text-center">Przyciski zostaną odblokowane gdy influencer doda link do scenariusza.</p>
        )}
        <HistoryAccordion history={task.history} />
      </div>
    );
  }

  // === FRAME.IO REVIEW VIEW (Client sees upload link, chooses accept or changes) ===
  if (task.inputType === 'frameio_review') {
    // Find frame.io URL — either from "Wgraj zmontowany film" or latest "Wgraj poprawki"
    const uploadTask = tasks
      .filter(t => t.projectId === task.projectId && (t.title === 'Wgraj zmontowany film' || t.title === 'Wgraj poprawki') && t.status === 'done' && t.value && t.value !== 'skipped')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
    const frameioUrl = uploadTask?.value ?? null;

    const handleFrameioDecision = (decision: 'approved' | 'changes_in_frameio') => {
      completeTask(task.id, decision, 'klient');
    };

    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span>
          <SlaTimer assignedAt={task.assignedAt} compact />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>

        {/* Frame.io link */}
        {frameioUrl ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ExternalLink className="h-4 w-4 text-primary" />
              Film gotowy do oceny
            </div>
            <div className="flex items-center gap-2">
              <a
                href={frameioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-primary underline-offset-2 hover:underline font-medium"
              >
                {frameioUrl}
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => { navigator.clipboard.writeText(frameioUrl); }}
                title="Kopiuj link"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Otwórz link, obejrzyj film i dodaj swoje komentarze bezpośrednio we frame.io. Następnie wróć i zaznacz wynik poniżej.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
            Link do frame.io będzie dostępny gdy montażysta wgra film.
          </div>
        )}

        {/* Decision buttons */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Twoja decyzja</p>
          <Button
            className="w-full justify-start gap-3 h-12"
            onClick={() => handleFrameioDecision('approved')}
            disabled={!frameioUrl}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-sm">Akceptuję film bez uwag</div>
              <div className="text-xs opacity-80 font-normal">Film jest gotowy do publikacji</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
            onClick={() => handleFrameioDecision('changes_in_frameio')}
            disabled={!frameioUrl}
          >
            <MessageSquare className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-sm">Uwagi dodałam/em we frame.io</div>
              <div className="text-xs opacity-80 font-normal">Montażysta otrzyma zadanie wprowadzenia poprawek</div>
            </div>
          </Button>
        </div>

        {!frameioUrl && (
          <p className="text-xs text-muted-foreground text-center">Przyciski zostaną odblokowane gdy pojawi się link do frame.io.</p>
        )}
      </div>
    );
  }

  // === APPROVAL VIEW (Client sees influencer's content) ===
  if (task.status === 'pending_client_approval' && (task.inputType === 'approval' || task.inputType === 'actor_approval')) {
    // actor_approval tasks OR legacy 'approval' tasks whose previousValue is ActorEntry[]
    const isActorApproval = task.inputType === 'actor_approval' || (() => {
      try {
        const p = JSON.parse(task.previousValue ?? '');
        return Array.isArray(p) && p.length > 0 && !!p[0].sourceType;
      } catch { return false; }
    })();

    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span>
          <SlaTimer assignedAt={task.assignedAt} compact />
        </div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
          <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs space-y-2 p-3 text-xs">
                  {isActorApproval ? (
                    <>
                      <p><span className="font-semibold text-success">Zaakceptuj</span> — skład aktorów zatwierdzony, produkcja idzie dalej.</p>
                      <p><span className="font-semibold text-warning">Zmień</span> — opisz, jakich zmian oczekujesz. Influencer naniesie poprawki i przejdzie dalej bez ponownej akceptacji z Twojej strony.</p>
                    </>
                  ) : (
                    <>
                      <p><span className="font-semibold text-success">Zaakceptuj</span> — materiał zatwierdzony, produkcja przechodzi do kolejnego etapu.</p>
                      <p><span className="font-semibold text-warning">Zmień</span> — opisz, co należy poprawić. Wykonawca wprowadzi zmiany i prześle materiał ponownie do Twojej akceptacji.</p>
                    </>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{task.description}</p>

        {/* Show influencer's submission */}
        {task.previousValue && (() => {
          // 1. Actor assignment JSON (new multi-actor format: ActorEntry[])
          try {
            const parsed = JSON.parse(task.previousValue);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) {
              const actors = parsed as ActorEntry[];
              return (
                <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5" />
                    Osoby na planie ({actors.length})
                  </div>
                  <div className="space-y-2">
                    {actors.map(a => (
                      <div key={a.id} className="flex items-center gap-2 flex-wrap">
                        <UserIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground">{a.name}</span>
                        {a.roleLabel && <Badge variant="secondary" className="text-[10px] border-0">{a.roleLabel}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          } catch {}
          // 2. URL — show as clickable link (e.g. script, frame.io)
          if (/^https?:\/\/.+\..+/.test(task.previousValue)) {
            const isScript = task.title.toLowerCase().includes('scenariusz');
            const url = task.previousValue;
            return (
              <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                  {isScript ? <BookOpen className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                  {isScript ? 'Link do scenariusza' : 'Link do materiału'}
                </div>
                <div className="flex items-start gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-1.5 text-sm text-primary hover:underline break-all font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {url}
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    title="Kopiuj link"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Otwórz link w przeglądarce, zapoznaj się z dokumentem, a następnie wybierz decyzję poniżej.</p>
              </div>
            );
          }
          // 3. Default: plain text
          return (
            <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Propozycja Influencera
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{task.previousValue}</p>
            </div>
          );
        })()}

        {/* Decision buttons */}
        {!showFeedbackForm && !showRejectFinalForm ? (
          <div className="space-y-2">
            <Button onClick={handleApprove} className="w-full bg-success hover:bg-success/90 text-success-foreground" size="lg">
              <ThumbsUp className="mr-2 h-4 w-4" />
              Zaakceptuj
            </Button>
            <Button
              onClick={() => setShowFeedbackForm(true)}
              variant="outline"
              className="w-full border-warning/50 text-warning hover:bg-warning/10"
              size="lg"
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              Zmień
            </Button>
          </div>
        ) : showRejectFinalForm ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Powód odrzucenia (opcjonalnie)..."
              value={rejectFinalReason}
              onChange={e => setRejectFinalReason(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={() => { rejectFinalTask(task.id, rejectFinalReason || undefined); }} variant="destructive" className="flex-1">
                <XCircle className="mr-2 h-4 w-4" />
                Potwierdź odrzucenie
              </Button>
              <Button variant="ghost" onClick={() => { setShowRejectFinalForm(false); setRejectFinalReason(''); }}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Opisz, co należy zmienić (wymagane):</p>
            <Textarea
              placeholder="Napisz, jakich zmian oczekujesz..."
              value={feedbackValue}
              onChange={e => { setFeedbackValue(e.target.value); setError(''); }}
              rows={4}
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleReject} className="flex-1" disabled={feedbackValue.trim().length === 0}>
                <Send className="mr-2 h-4 w-4" />
                Wyślij prośbę o zmiany
              </Button>
              <Button variant="ghost" onClick={() => { setShowFeedbackForm(false); setError(''); }}>
                Anuluj
              </Button>
            </div>
          </div>
        )}

        <HistoryAccordion history={task.history} />
      </div>
    );
  }

  // === REVISION VIEW (Influencer sees feedback and edits) ===
  if (task.status === 'needs_influencer_revision') {
    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span>
          <SlaTimer assignedAt={task.assignedAt} compact />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>

        {/* Client feedback alert */}
        {task.clientFeedback && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Uwagi od Klienta</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{task.clientFeedback}</AlertDescription>
          </Alert>
        )}

        {/* Show original submission — only for text tasks (URL shown inline, actors pre-loaded) */}
        {task.value && task.inputType !== 'actor_assignment' && task.inputType !== 'url' && (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Twoja poprzednia propozycja</div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{task.value}</p>
          </div>
        )}

        <div className="space-y-3">
          {task.inputType === 'actor_assignment' ? (() => {
            let initialActors: ActorEntry[] = [];
            try {
              const parsed = JSON.parse(task.value ?? '');
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) initialActors = parsed;
            } catch {}
            return (
              <ActorAssignmentInput
                client={clients.find(c => c.id === project?.clientId) ?? null}
                clientUsers={users.filter(u => u.role === 'klient' && u.clientId === project?.clientId)}
                initialActors={initialActors}
                onSubmit={(actors: ActorEntry[]) => {
                  // Aktor: pipeline ma tylko jedną akceptację klienta — poprawki idą dalej automatycznie
                  resubmitTaskAndAutoApprove(task.id, JSON.stringify(actors));
                }}
              />
            );
          })() : task.inputType === 'url' && task.title === 'Dodaj link do scenariusza' ? (
            // Script revision: influencer edited the same file — just confirm, no new URL needed
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <a href={task.value!} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                  {task.value}
                </a>
              </div>
              <Button onClick={() => resubmitTask(task.id, task.value!)} className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Poprawki wprowadzone — proszę o weryfikację
              </Button>
              <Button
                onClick={() => resubmitTaskAndAutoApprove(task.id, task.value!)}
                variant="outline"
                className="w-full"
              >
                Poprawki naniesione, nie wymagana kolejna akceptacja klienta
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Użyj, gdy uwagi były drobne i klient nie musi tego ponownie zatwierdzać.
              </p>
            </div>
          ) : task.inputType === 'url' ? (
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="https://..."
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); setError(''); }}
                className="pl-10"
              />
            </div>
          ) : (
            <Textarea
              placeholder="Wpisz poprawioną wersję..."
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); setError(''); }}
              rows={4}
            />
          )}
          {task.inputType !== 'actor_assignment' && !(task.inputType === 'url' && task.title === 'Dodaj link do scenariusza') && (
            <>
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </div>
              )}
              <Button onClick={handleResubmit} className="w-full" disabled={isSubmitDisabled}>
                <Send className="mr-2 h-4 w-4" />
                Wyślij ponownie
              </Button>
              <Button
                onClick={handleResubmitAutoApprove}
                variant="outline"
                className="w-full"
                disabled={isSubmitDisabled}
              >
                Poprawki naniesione, nie wymagana kolejna akceptacja klienta
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Użyj, gdy uwagi były drobne i klient nie musi tego ponownie zatwierdzać.
              </p>
            </>
          )}
        </div>

        <HistoryAccordion history={task.history} />
      </div>
    );
  }

  // === PARTIAL MULTI-ROLE NOTES — show already submitted notes for "Wnieś uwagi" ===
  const partialNotes = task.title === 'Wnieś uwagi przed montażem' && Object.keys(task.roleCompletions).length > 0
    ? task.roleCompletions
    : null;

  // === DEFAULT VIEWS ===
  const usesDeadline = task.assignedRoles.includes('kierownik_planu') || task.title === 'Określ rekwizyty';
  const deadlineDisplay = usesDeadline && task.deadlineDate ? (
    <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
      new Date(task.deadlineDate) < new Date() ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
    }`}>
      <CalendarClock className="h-4 w-4" />
      Termin: {format(new Date(task.deadlineDate), 'dd.MM.yyyy', { locale: pl })}
    </div>
  ) : usesDeadline ? (
    <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <CalendarClock className="h-4 w-4" />
      Termin nagrania zostanie ustalony przez Admina równolegle
    </div>
  ) : null;

  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span>
        {!usesDeadline && <SlaTimer assignedAt={task.assignedAt} compact />}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{task.description}</p>

      {deadlineDisplay}

      {partialNotes && (
        <div className="mb-4 space-y-2 rounded-lg border border-warning/20 bg-warning/5 p-4">
          <div className="mb-2 text-xs font-medium text-warning uppercase tracking-wider">Uwagi już złożone</div>
          {Object.entries(partialNotes).map(([role, note]) => note ? (
            <div key={role} className="text-sm">
              <Badge variant="secondary" className="mb-1 text-[10px] border-0">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</Badge>
              <p className="text-foreground whitespace-pre-wrap pl-1">{note}</p>
            </div>
          ) : null)}
        </div>
      )}

      {task.inputType === 'filming_confirmation' ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Numer nagrania *</label>
            <Input
              placeholder="np. 001, 002..."
              value={recordingNumber}
              onChange={e => { setRecordingNumber(e.target.value); setError(''); }}
              className="font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notatka (opcjonalnie)</label>
            <Textarea
              placeholder="Opis przebiegu nagrania, uwagi dla operatora..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full" size="lg">
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Potwierdź nagranie
          </Button>
        </div>
      ) : task.inputType === 'multi_party_notes' ? (
        <MultiPartyNotesPanel key={task.id} task={task} role={currentUser?.role ?? ''} onSubmit={(note) => completeTask(task.id, note, currentUser?.role)} onUpdate={(note) => updatePartyNote(task.id, currentUser?.role ?? '', note)} />
      ) : task.inputType === 'raw_footage' ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Link do surówki na serwerze *</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="https://..."
                value={noteUrl}
                onChange={e => { setNoteUrl(e.target.value); setError(''); }}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Numer nagrania *</label>
            <Input
              placeholder="np. 001, 002..."
              value={recordingNumber}
              onChange={e => { setRecordingNumber(e.target.value); setError(''); }}
              className="font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notatka / opis surówki</label>
            <Textarea
              placeholder="Opis jakości materiału, uwagi dla montażysty..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={3}
            />
          </div>
          {otherRawFootageTasks.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Zastosuj ten sam link do innych pomysłów</p>
                <span className="text-[11px] text-muted-foreground">{additionalRawTaskIds.size} zaznaczonych</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Przydatne, gdy jedno nagranie obejmuje materiał dla kilku pomysłów.</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                {otherRawFootageTasks.map(({ task: t, project: p, sameClient }) => {
                  const checked = additionalRawTaskIds.has(t.id);
                  return (
                    <label key={t.id} className="flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-background">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          setAdditionalRawTaskIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(t.id);
                            else next.delete(t.id);
                            return next;
                          });
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-foreground truncate">{p?.name || 'Pomysł'}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {p?.company || p?.clientName || '—'}{sameClient ? ' • ten sam klient' : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full" size="lg" disabled={!noteUrl.trim()}>
            <Send className="mr-2 h-5 w-5" />
            {additionalRawTaskIds.size > 0
              ? `Wgraj surówkę do ${additionalRawTaskIds.size + 1} pomysłów`
              : 'Wgraj surówkę'}
          </Button>
        </div>
      ) : task.inputType === 'boolean' ? (
        <Button onClick={handleSubmit} className="w-full" size="lg">
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Akceptuję
        </Button>
      ) : task.inputType === 'url' ? (
        <div className="space-y-3">
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="https://..."
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); setError(''); }}
              className="pl-10"
            />
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full" disabled={isSubmitDisabled}>
            Wyślij link
          </Button>
        </div>
      ) : task.title === 'Brief dla montażysty' ? (() => {
        // Live notes from the "Wnieś uwagi" task (may still be in progress)
        const notesTask = tasks.find(nt => nt.projectId === task.projectId && nt.title === 'Wnieś uwagi przed montażem');
        const liveNotes = notesTask
          ? Object.entries(notesTask.roleCompletions).filter(([r]) => r !== 'influencer')
          : [];
        const pendingRoles = notesTask
          ? notesTask.assignedRoles.filter(r => !notesTask.roleCompletions[r])
          : [];
        const notesRoleLabels: Record<string, string> = {
          kierownik_planu: 'Kierownik Planu',
          admin: 'Dyrektor Zarządzający',
          klient: 'Klient',
        };
        const saveDraft = () => {
          if (!briefDraft.trim()) return;
          updatePartyNote(task.id, 'influencer', briefDraft.trim());
          setBriefDraftSaved(true);
          setTimeout(() => setBriefDraftSaved(false), 2000);
        };
        const sendFinal = () => {
          if (!briefDraft.trim()) return;
          completeTask(task.id, briefDraft.trim(), 'influencer');
        };
        return (
          <div className="space-y-4">
            {/* Live team notes at top */}
            {liveNotes.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
                <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Uwagi od zespołu
                </div>
                {liveNotes.map(([r, note]) => note ? (
                  <div key={r} className="text-sm">
                    <Badge variant="secondary" className="mb-1 text-[10px] border-0">{notesRoleLabels[r] ?? r}</Badge>
                    <p className="text-foreground whitespace-pre-wrap pl-1">{note}</p>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Pending roles */}
            {pendingRoles.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Oczekuje jeszcze na uwagi od: {pendingRoles.map(r => notesRoleLabels[r] ?? r).join(', ')}
              </div>
            )}

            {/* Main action: brief textarea */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Twój brief dla montażysty
              </label>
              <Textarea
                placeholder="Na podstawie zebranych uwag napisz brief dla montażysty..."
                value={briefDraft}
                onChange={e => setBriefDraft(e.target.value)}
                rows={5}
              />
              {briefDraftSaved && (
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3.5 w-3.5" />
                  Wersja robocza zapisana
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={!briefDraft.trim()}
                onClick={saveDraft}
              >
                <FileText className="mr-2 h-4 w-4" />
                Zapisz wersję roboczą
              </Button>
              <Button
                className="flex-1"
                disabled={!briefDraft.trim()}
                onClick={sendFinal}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Wyślij i przekaż do montażu
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Wersja robocza jest widoczna tylko dla Ciebie. Wysłanie zamknie ten etap i przekaże brief do montażysty.
            </p>

            {/* Private scratchpad — subtle, at very bottom */}
            {notesTask && (
              <div className="border-t border-border/40 pt-3 space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon className="h-3 w-3" />
                  Twoje prywatne notatki robocze
                </div>
                <Textarea
                  placeholder="Notatki robocze — widoczne tylko dla Ciebie..."
                  value={privateNotesDraft}
                  onChange={e => setPrivateNotesDraft(e.target.value)}
                  rows={3}
                  className="text-xs bg-muted/20 border-border/50 placeholder:text-muted-foreground/50"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  disabled={!privateNotesDraft.trim()}
                  onClick={() => {
                    updatePartyNote(notesTask.id, 'influencer', privateNotesDraft.trim());
                    setPrivateNotesSaved(true);
                    setTimeout(() => setPrivateNotesSaved(false), 2000);
                  }}
                >
                  {privateNotesSaved ? <><Check className="mr-1 h-3 w-3" />Zapisano</> : 'Zapisz notatki'}
                </Button>
              </div>
            )}
          </div>
        );
      })() : task.inputType === 'text' ? (
        <div className="space-y-3">
          <Textarea
            placeholder="Wpisz tutaj..."
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setError(''); }}
            rows={4}
          />
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitDisabled}>
              <FileText className="mr-2 h-4 w-4" />
              Wyślij
            </Button>
            {task.title === 'Określ rekwizyty' && (
              <Button
                variant="outline"
                className="shrink-0 text-muted-foreground"
                onClick={() => completeTask(task.id, 'Nie wymagane', currentUser?.role)}
              >
                Nie wymagane
              </Button>
            )}
          </div>
        </div>
      ) : task.inputType === 'actor_assignment' ? (
        <ActorAssignmentInput
          client={clients.find(c => c.id === project?.clientId) ?? null}
          clientUsers={users.filter(u => u.role === 'klient' && u.clientId === project?.clientId)}
          onSubmit={(actors: ActorEntry[]) => {
            completeTask(task.id, JSON.stringify(actors), currentUser?.role);
          }}
        />
      ) : task.inputType === 'social_descriptions' ? (
        <SocialDescriptionsInput
          initialValue={task.value ?? null}
          onSaveDraft={(value) => saveDraftValue(task.id, value)}
          onSubmit={(value) => { setError(''); completeTask(task.id, value, currentUser?.role); }}
        />
      ) : task.inputType === 'publication_confirm' ? (() => {
        // Resolve final video link: prefer "Wgraj poprawki" (if not skipped), else "Wgraj zmontowany film"
        const poprawkiTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Wgraj poprawki');
        const montazTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Wgraj zmontowany film');
        const videoUrl =
          (poprawkiTask?.value && poprawkiTask.value !== 'skipped' ? poprawkiTask.value : null) ??
          montazTask?.value ?? null;
        const descriptionsTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Opisy i tytuły do publikacji');
        const datesTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Ustaw datę publikacji');
        return (
          <PublicationConfirmPanel
            videoUrl={videoUrl}
            descriptionsJson={descriptionsTask?.value ?? null}
            datesJson={datesTask?.value ?? null}
            currentValue={task.value}
            onConfirmPlatform={(value) => saveDraftValue(task.id, value)}
            onConfirmAll={(value) => completeTask(task.id, value, currentUser?.role)}
          />
        );
      })() : null}
    </div>
  );
};

export default TaskCard;
