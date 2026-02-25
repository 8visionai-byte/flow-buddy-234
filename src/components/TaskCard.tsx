import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Link as LinkIcon, FileText, AlertCircle } from 'lucide-react';
import SlaTimer from '@/components/SlaTimer';

interface TaskCardProps {
  task: Task;
  projectName: string;
}

const URL_REGEX = /^https?:\/\/.+\..+/;

const TaskCard = ({ task, projectName }: TaskCardProps) => {
  const { completeTask } = useApp();
  const [inputValue, setInputValue] = useState('');
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

  const isSubmitDisabled =
    task.inputType === 'url' ? !URL_REGEX.test(inputValue) :
    task.inputType === 'text' ? inputValue.trim().length === 0 :
    false;

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
