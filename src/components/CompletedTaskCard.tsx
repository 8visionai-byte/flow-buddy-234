import { Task, ROLE_LABELS, TaskHistoryEntry } from '@/types';
import SocialDescriptionsDisplay, { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, MessageSquare, Send, ThumbsDown, ThumbsUp, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface CompletedTaskCardProps {
  task: Task;
  projectName: string;
}

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

const CompletedTaskCard = ({ task, projectName }: CompletedTaskCardProps) => {
  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{projectName}</span>
        <Badge variant="secondary" className="gap-1 border-0 bg-success/10 text-success text-xs">
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

      {/* Accepted value */}
      {task.value === 'approved' && task.previousValue && (
        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Zaakceptowana propozycja</div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{task.previousValue}</p>
        </div>
      )}

      {task.value && task.value !== 'true' && task.value !== 'approved' && (
        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Zaakceptowana treść</div>
          {tryParseSocialDescriptions(task.value) ? (
            <SocialDescriptionsDisplay value={task.value} />
          ) : (() => {
            try {
              const parsed = JSON.parse(task.value!);
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
            return <p className="text-sm text-foreground whitespace-pre-wrap">{task.value}</p>;
          })()}
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
      )}
    </div>
  );
};

export default CompletedTaskCard;
