import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, Link as LinkIcon, FileText, AlertCircle, ThumbsUp, ThumbsDown, Send, MessageSquare } from 'lucide-react';
import SlaTimer from '@/components/SlaTimer';

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

  const handleSubmit = () => {
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
      </div>
    );
  }

  // === DEFAULT VIEWS ===
  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{projectName}</span>
        <SlaTimer assignedAt={task.assignedAt} compact />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{task.title}</h3>
      <p className="mb-6 text-sm text-muted-foreground">{task.description}</p>

      {task.inputType === 'boolean' && (
        <Button onClick={handleSubmit} className="w-full" size="lg">
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Akceptuję
        </Button>
      )}

      {task.inputType === 'url' && (
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
      )}

      {task.inputType === 'text' && (
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
      )}
    </div>
  );
};

export default TaskCard;
