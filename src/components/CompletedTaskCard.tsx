import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Task, ROLE_LABELS, TaskHistoryEntry, ActorEntry } from '@/types';
import SocialDescriptionsDisplay, { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import { tryParseSocialDates } from '@/components/SocialDatesWidget';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, MessageSquare, Send, ThumbsDown, ThumbsUp, User as UserIcon, Pencil, Link as LinkIcon, X, Check, Film, Hash, FileText, CalendarDays, Facebook, Twitter, Instagram, Youtube, UserPlus, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
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
  deferred: 'Odroczono',
  rejected_final: 'Odrzucono ostatecznie',
};

const actionIcons: Record<TaskHistoryEntry['action'], React.ReactNode> = {
  submitted: <Send className="h-3.5 w-3.5 text-primary" />,
  approved: <ThumbsUp className="h-3.5 w-3.5 text-success" />,
  rejected: <ThumbsDown className="h-3.5 w-3.5 text-destructive" />,
  resubmitted: <MessageSquare className="h-3.5 w-3.5 text-warning" />,
  deferred: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  rejected_final: <ThumbsDown className="h-3.5 w-3.5 text-destructive" />,
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), "dd.MM.yyyy, HH:mm", { locale: pl });
}

const URL_REGEX = /^https?:\/\/.+\..+/;

interface RawFootagePayload { url: string; recordingNumber: string; notes?: string; }
function tryParseRawFootage(val: string): RawFootagePayload | null {
  try {
    const p = JSON.parse(val);
    if (p && typeof p === 'object' && !Array.isArray(p) && p.url && p.recordingNumber !== undefined) return p as RawFootagePayload;
  } catch {}
  return null;
}

const RawFootageDisplay = ({ payload }: { payload: RawFootagePayload }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm">
      <Film className="h-4 w-4 text-primary shrink-0" />
      <a href={payload.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{payload.url}</a>
    </div>
    {payload.recordingNumber && (
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        Nr nagrania: <span className="font-medium ml-1">{payload.recordingNumber}</span>
      </div>
    )}
    {payload.notes && (
      <div className="flex items-start gap-2 text-sm text-foreground">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <span className="whitespace-pre-wrap">{payload.notes}</span>
      </div>
    )}
  </div>
);

const CompletedTaskCard = ({ task, projectName }: CompletedTaskCardProps) => {
  const { currentUser, updateTaskValue, projects, clients, users } = useApp();
  const [editingUrl, setEditingUrl] = useState(false);
  const [editUrlValue, setEditUrlValue] = useState('');
  const [urlError, setUrlError] = useState('');

  // Actor assignment edit state
  const [editingActors, setEditingActors] = useState(false);
  const [editActorList, setEditActorList] = useState<ActorEntry[]>([]);
  const [actorError, setActorError] = useState('');

  const project = projects.find(p => p.id === task.projectId);

  // Show edit button only for influencer's done URL tasks where next task hasn't been completed yet
  const canEditUrl =
    task.inputType === 'url' &&
    task.status === 'done' &&
    currentUser?.role === 'influencer' &&
    task.assignedRoles.includes('influencer');

  // Can edit actor assignment (influencer only, done task)
  const canEditActors =
    task.inputType === 'actor_assignment' &&
    task.status === 'done' &&
    currentUser?.role === 'influencer' &&
    task.assignedRoles.includes('influencer');

  const parseCurrentActors = (): ActorEntry[] => {
    if (!task.value) return [];
    try {
      const parsed = JSON.parse(task.value);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) return parsed;
    } catch {}
    return [];
  };

  const startEditActors = () => {
    setEditActorList(parseCurrentActors());
    setEditingActors(true);
    setActorError('');
  };

  const removeActor = (id: string) => {
    setEditActorList(prev => prev.filter(a => a.id !== id));
  };

  // Get available client users for adding
  const clientUsersForProject = users.filter(u => u.role === 'klient' && u.clientId === project?.clientId);
  const clientForProject = clients.find(c => c.id === project?.clientId) ?? null;

  const isActorAdded = (sourceId: string) => editActorList.some(a => a.sourceId === sourceId);

  const addActorFromDB = (sourceId: string, name: string, sourceType: 'client_contact' | 'client_user', defaultRole: string) => {
    if (isActorAdded(sourceId)) return;
    setEditActorList(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 9),
      sourceType,
      sourceId,
      name,
      roleLabel: defaultRole,
      notifyChannel: 'none',
      telegramHandle: '',
    }]);
  };

  const handleSaveActors = () => {
    if (editActorList.length === 0) {
      setActorError('Przypisz co najmniej jedną osobę');
      return;
    }
    const historyEntry: TaskHistoryEntry = {
      action: 'submitted',
      by: 'influencer',
      userId: currentUser?.id,
      value: JSON.stringify(editActorList),
      timestamp: new Date().toISOString(),
    };
    updateTaskValue(task.id, JSON.stringify(editActorList), historyEntry);
    setEditingActors(false);
    setActorError('');
    toast.success('Zapisano zmiany');
  };

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
      <div className="mb-1 flex items-center justify-between">
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide">{projectName}</span>
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
      {task.value === 'approved' && task.previousValue && (() => {
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

      {/* Social dates display (admin "Ustaw datę publikacji" task) */}
      {task.inputType === 'social_dates' && task.value && (() => {
        const dates = tryParseSocialDates(task.value);
        if (!dates) return null;
        const PLATFORM_CONFIG = [
          { dateKey: 'facebookDate' as const, label: 'Facebook', icon: <Facebook className="h-3.5 w-3.5 text-[#1877F2]" /> },
          { dateKey: 'twitterDate' as const, label: 'Twitter / X', icon: <Twitter className="h-3.5 w-3.5 text-foreground" /> },
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

      {task.value && task.value !== 'true' && task.value !== 'approved' && task.value !== 'approved_with_file_notes' && task.value !== 'skipped' && task.inputType !== 'social_dates' && (
        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {task.inputType === 'url' ? 'Przesłany link'
                : task.inputType === 'raw_footage' ? 'Wgrana surówka'
                : task.inputType === 'actor_assignment' ? 'Przypisane osoby'
                : 'Zaakceptowana treść'}
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
                onClick={startEditActors}
              >
                <Pencil className="h-3 w-3" />
                Edytuj obsadę
              </Button>
            )}
          </div>

          {/* Actor assignment edit mode */}
          {editingActors && canEditActors ? (
            <div className="space-y-3 mt-2">
              {/* Current actors with remove buttons */}
              {editActorList.length > 0 ? (
                <div className="space-y-1.5">
                  {editActorList.map(actor => (
                    <div key={actor.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-foreground min-w-0">
                        <UserIcon className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium truncate">{actor.name}</span>
                        {actor.roleLabel && <Badge variant="secondary" className="text-[10px] border-0">{actor.roleLabel}</Badge>}
                      </div>
                      <button
                        onClick={() => removeActor(actor.id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Brak przypisanych osób</p>
              )}

              {/* Add person buttons from DB */}
              {(clientForProject || clientUsersForProject.length > 0) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dodaj osobę</p>
                  {clientForProject && (
                    <button
                      onClick={() => addActorFromDB(`contact-${clientForProject.id}`, clientForProject.contactName, 'client_contact', 'Klient')}
                      disabled={isActorAdded(`contact-${clientForProject.id}`)}
                      className="flex w-full items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">{clientForProject.contactName}</span>
                        <Badge variant="outline" className="text-[10px]">Kontakt klienta</Badge>
                      </span>
                      {isActorAdded(`contact-${clientForProject.id}`) && <Check className="h-3.5 w-3.5 text-success" />}
                    </button>
                  )}
                  {clientUsersForProject.map(u => (
                    <button
                      key={u.id}
                      onClick={() => addActorFromDB(u.id, u.name, 'client_user', 'Klient')}
                      disabled={isActorAdded(u.id)}
                      className="flex w-full items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">{u.name}</span>
                        <Badge variant="outline" className="text-[10px]">Konto klienta</Badge>
                      </span>
                      {isActorAdded(u.id) && <Check className="h-3.5 w-3.5 text-success" />}
                    </button>
                  ))}
                </div>
              )}

              {actorError && <p className="text-xs text-destructive">{actorError}</p>}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleSaveActors}
                  disabled={editActorList.length === 0}
                >
                  <Check className="h-3 w-3" />Zapisz zmiany
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setEditingActors(false); setActorError(''); }}>
                  <X className="h-3 w-3" />Anuluj
                </Button>
              </div>
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
              return <p className="text-sm text-foreground whitespace-pre-wrap break-all">{task.value}</p>;
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
                      {entry.value && entry.value !== 'approved' && (
                        tryParseSocialDescriptions(entry.value) ? (
                          <div className="mt-1"><SocialDescriptionsDisplay value={entry.value} /></div>
                        ) : (() => {
                          const rf = tryParseRawFootage(entry.value!);
                          if (rf) return <div className="mt-1"><RawFootageDisplay payload={rf} /></div>;
                          try {
                            const parsed = JSON.parse(entry.value!);
                            // New format: ActorEntry[]
                            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sourceType) {
                              return (
                                <p className="mt-1 text-muted-foreground text-xs">
                                  {parsed.map((a: { name: string }) => a.name).join(', ')}
                                </p>
                              );
                            }
                            // Old format
                            if (parsed.type && parsed.name) {
                              return <p className="mt-1 text-muted-foreground text-xs">Osoba: {parsed.name} ({parsed.type === 'client' ? 'Klient' : 'Inna osoba'})</p>;
                            }
                          } catch {}
                          return <p className="mt-1 text-muted-foreground whitespace-pre-wrap text-xs">{entry.value}</p>;
                        })()
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
