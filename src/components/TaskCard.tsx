import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Task, ROLE_LABELS, TaskHistoryEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle2, Link as LinkIcon, FileText, AlertCircle, ThumbsUp, ThumbsDown, Send, MessageSquare, CalendarClock } from 'lucide-react';
import SlaTimer from '@/components/SlaTimer';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const actionLabels: Record<TaskHistoryEntry['action'], string> = {
  submitted: 'Przesłano',
  approved: 'Zaakceptowano',
  rejected: 'Odrzucono z uwagami',
  resubmitted: 'Poprawiono i wysłano ponownie',
};

const actionIcons: Record<TaskHistoryEntry['action'], React.ReactNode> = {
  submitted: <Send className="h-3.5 w-3.5 text-primary" />,
  approved: <ThumbsUp className="h-3.5 w-3.5 text-success" />,
  rejected: <ThumbsDown className="h-3.5 w-3.5 text-destructive" />,
  resubmitted: <MessageSquare className="h-3.5 w-3.5 text-warning" />,
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
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap text-xs">{entry.value}</p>
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
  const { completeTask, rejectTask, resubmitTask } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [feedbackValue, setFeedbackValue] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [error, setError] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [noteText, setNoteText] = useState('');

  const isKierownikConfirm = task.assignedRole === 'kierownik_planu' && task.title === 'Potwierdź nagranie';

  const handleSubmit = () => {
    if (isKierownikConfirm) {
      if (noteUrl.trim() && !URL_REGEX.test(noteUrl)) {
        setError('Podaj poprawny adres URL (https://...)');
        return;
      }
      const jsonValue = JSON.stringify({ url: noteUrl.trim(), note: noteText.trim() });
      completeTask(task.id, jsonValue);
      return;
    }
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
    completeTask(task.id, value);
  };

  const handleApprove = () => {
    completeTask(task.id, 'approved');
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

  const isSubmitDisabled =
    task.inputType === 'url' ? !URL_REGEX.test(inputValue) :
    task.inputType === 'text' ? inputValue.trim().length === 0 :
    false;

  // === APPROVAL VIEW (Client sees influencer's content) ===
  if (task.status === 'pending_client_approval' && task.inputType === 'approval') {
    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{projectName}</span>
          <SlaTimer assignedAt={task.assignedAt} compact />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{task.description}</p>

        {/* Show influencer's submission */}
        {task.previousValue && (
          <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Propozycja Influencera
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{task.previousValue}</p>
          </div>
        )}

        {!showFeedbackForm ? (
          <div className="flex gap-3">
            <Button onClick={handleApprove} className="flex-1 bg-success hover:bg-success/90 text-success-foreground" size="lg">
              <ThumbsUp className="mr-2 h-4 w-4" />
              Zaakceptuj
            </Button>
            <Button onClick={() => setShowFeedbackForm(true)} variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive/10" size="lg">
              <ThumbsDown className="mr-2 h-4 w-4" />
              Dodaj zmiany
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              placeholder="Opisz, co należy zmienić..."
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
                Wyślij do poprawy
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
          <span className="text-xs font-medium text-muted-foreground">{projectName}</span>
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

        {/* Show original submission */}
        {task.value && (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Twoja poprzednia propozycja</div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{task.value}</p>
          </div>
        )}

        <div className="space-y-3">
          {task.inputType === 'url' ? (
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
        </div>

        <HistoryAccordion history={task.history} />
      </div>
    );
  }

  // === DEFAULT VIEWS ===
  const usesDeadline = task.assignedRole === 'kierownik_planu' || task.title === 'Określ rekwizyty';
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
      Brak przypisanego terminu — skontaktuj się z Adminem
    </div>
  ) : null;

  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{projectName}</span>
        {!usesDeadline && <SlaTimer assignedAt={task.assignedAt} compact />}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{task.description}</p>

      {deadlineDisplay}

      {isKierownikConfirm ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Link do nagrania (opcjonalnie)</label>
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
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notatka / opis</label>
            <Textarea
              placeholder="Krótki opis nagrania..."
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
      ) : task.inputType === 'text' ? (
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
          <Button onClick={handleSubmit} className="w-full" disabled={isSubmitDisabled}>
            <FileText className="mr-2 h-4 w-4" />
            Wyślij
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default TaskCard;
