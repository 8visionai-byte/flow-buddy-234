import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS, ROLE_COLORS } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LogOut, CheckCircle2, Circle, Lock, MoreVertical, Snowflake, Trash2, AlertTriangle, RotateCcw, CalendarClock, ExternalLink, Link as LinkIcon, Send, ClipboardList, Calendar as CalendarIcon } from 'lucide-react';
import AddProjectDialog from '@/components/AddProjectDialog';
import TeamManagementDialog from '@/components/TeamManagementDialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, differenceInMilliseconds } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const SLA_MS = 48 * 60 * 60 * 1000;

function formatDurationFromMs(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
}

interface AdminDashboardProps {
  readOnly?: boolean;
  allowedTaskIds?: Set<string>;
}

const AdminDashboard = ({ readOnly = false, allowedTaskIds }: AdminDashboardProps) => {
  const { currentUser, setCurrentUser, tasks, projects, users, deleteProject, toggleFreezeProject, assignToProject, completeTask, reopenTask, setTaskDeadline, setPublicationDate } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [adminLinkInputs, setAdminLinkInputs] = useState<Record<string, string>>({});

  if (!currentUser) return null;

  const getTasksForProject = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId).sort((a, b) => a.order - b.order);

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === 'todo') return <Circle className="h-4 w-4 text-primary" />;
    if (status === 'pending_client_approval') return <Circle className="h-4 w-4 text-warning" />;
    if (status === 'needs_influencer_revision') return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />;
  };

  const statusBadge = (status: string) => {
    if (status === 'done') return <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">Gotowe</Badge>;
    if (status === 'todo') return <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">Aktywne</Badge>;
    if (status === 'pending_client_approval') return <Badge variant="secondary" className="bg-warning/10 text-warning border-0 text-xs">Czeka na klienta</Badge>;
    if (status === 'needs_influencer_revision') return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs">Do poprawy</Badge>;
    return <Badge variant="secondary" className="text-xs opacity-40">Zablokowane</Badge>;
  };

  const influencers = users.filter(u => u.role === 'influencer');
  const editors = users.filter(u => u.role === 'montazysta');

  const getDeleteProjectName = () => projects.find(p => p.id === deleteConfirm)?.name || '';

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteProject(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const isNagrywkaTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.assignedRole === 'kierownik_planu';
  };

  const roleLabel = readOnly ? 'Kierownik Planu' : 'Panel Admina';
  const roleSubtitle = readOnly ? 'Widok tylko do odczytu' : 'Widok helikoptera — wszystkie projekty';

  const renderSlaColumn = (task: typeof tasks[0]) => {
    const isActive = task.status === 'todo' || task.status === 'pending_client_approval' || task.status === 'needs_influencer_revision';
    const isKierownik = task.assignedRole === 'kierownik_planu' || task.title === 'Określ rekwizyty';

    // Done tasks: show frozen completion time
    if (task.status === 'done' && task.assignedAt && task.completedAt) {
      const durationMs = differenceInMilliseconds(new Date(task.completedAt), new Date(task.assignedAt));
      const overdue = isKierownik
        ? (task.deadlineDate ? new Date(task.completedAt) > new Date(task.deadlineDate) : false)
        : durationMs > SLA_MS;

      return (
        <span className={`text-xs font-medium ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
          Wykonano w: {formatDurationFromMs(durationMs)}
          {overdue && ' (Przekroczony)'}
        </span>
      );
    }

    // Kierownik locked: show "set deadline" button for admin
    if (isKierownik && !isActive && task.status === 'locked') {
      if (task.deadlineDate) {
        return (
          <span className="text-xs text-muted-foreground">
            Termin: {format(new Date(task.deadlineDate), 'dd.MM.yyyy', { locale: pl })}
          </span>
        );
      }
      if (!readOnly) {
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                Ustaw termin
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(date) => {
                  if (date) setTaskDeadline(task.id, date.toISOString());
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        );
      }
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    // Kierownik active: show deadline date
    if (isKierownik && isActive) {
      if (task.deadlineDate) {
        const deadlinePassed = new Date(task.deadlineDate) < new Date();
        return (
          <div className="flex items-center gap-1">
            {!readOnly && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className={`h-7 gap-1 text-xs ${deadlinePassed ? 'text-destructive' : 'text-muted-foreground'}`}>
                    <CalendarClock className="h-3 w-3" />
                    {format(new Date(task.deadlineDate), 'dd.MM.yyyy', { locale: pl })}
                    {deadlinePassed && ' (!)'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(task.deadlineDate)}
                    onSelect={(date) => {
                      if (date) setTaskDeadline(task.id, date.toISOString());
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
            {readOnly && (
              <span className={`text-xs font-medium ${deadlinePassed ? 'text-destructive' : 'text-muted-foreground'}`}>
                Termin: {format(new Date(task.deadlineDate), 'dd.MM.yyyy', { locale: pl })}
                {deadlinePassed && ' (Przekroczony!)'}
              </span>
            )}
          </div>
        );
      }
      if (!readOnly) {
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                Ustaw termin
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(date) => {
                  if (date) setTaskDeadline(task.id, date.toISOString());
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        );
      }
      return <span className="text-xs text-muted-foreground">Brak terminu</span>;
    }

    // Active non-kierownik: live SLA timer
    if (isActive && task.assignedAt) {
      const elapsed = Date.now() - new Date(task.assignedAt).getTime();
      const remaining = SLA_MS - elapsed;
      const overdue = remaining < 0;
      return (
        <span className={`text-xs font-medium ${overdue ? 'text-destructive' : 'text-success'}`}>
          {overdue ? `+${formatDurationFromMs(elapsed - SLA_MS)} opóźnienia` : `Pozostało: ${formatDurationFromMs(remaining)}`}
        </span>
      );
    }

    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const renderValueColumn = (task: typeof tasks[0]) => {
    const isActive = task.status === 'todo' || task.status === 'pending_client_approval' || task.status === 'needs_influencer_revision';
    const canInteract = readOnly ? isNagrywkaTask(task.id) && isActive : false;
    const isKierownikConfirm = task.assignedRole === 'kierownik_planu' && task.title === 'Potwierdź nagranie';

    // Kierownik confirm done: show URL link + tooltip with note
    if (isKierownikConfirm && task.status === 'done' && task.value) {
      try {
        const parsed = JSON.parse(task.value);
        if (parsed.url || parsed.note) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {parsed.url ? (
                    <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      Nagranie
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground cursor-help">Potwierdzone ✓</span>
                  )}
                </TooltipTrigger>
                {parsed.note && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{parsed.note}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        }
      } catch {
        // Not JSON, render normally
      }
    }

    // Admin task: Ustaw termin planu zdjęciowego
    if (!readOnly && task.assignedRole === 'admin' && task.title === 'Ustaw termin planu zdjęciowego' && task.status === 'todo') {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <CalendarClock className="h-3 w-3" />
              Wybierz datę
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={(date) => {
                if (date) {
                  // Set deadline on the "Określ rekwizyty" task for this project
                  const rekwizytyTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Określ rekwizyty');
                  if (rekwizytyTask) setTaskDeadline(rekwizytyTask.id, date.toISOString());
                  // Also set on the Potwierdź nagranie task
                  const confirmTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Potwierdź nagranie');
                  if (confirmTask) setTaskDeadline(confirmTask.id, date.toISOString());
                  completeTask(task.id, date.toISOString());
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      );
    }

    // Admin task: Ustaw termin - done, show selected date
    if (task.assignedRole === 'admin' && task.title === 'Ustaw termin planu zdjęciowego' && task.status === 'done' && task.value) {
      return (
        <span className="text-xs text-muted-foreground">
          <CalendarClock className="inline mr-1 h-3 w-3" />
          {format(new Date(task.value), 'dd.MM.yyyy', { locale: pl })}
        </span>
      );
    }

    // Admin task: Wstaw link do frame.io
    if (!readOnly && task.assignedRole === 'admin' && task.title === 'Wstaw link do frame.io' && task.status === 'todo') {
      const linkVal = adminLinkInputs[task.id] || '';
      return (
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="url"
              placeholder="https://frame.io/..."
              value={linkVal}
              onChange={e => setAdminLinkInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
              className="h-7 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-7 px-2"
            disabled={!linkVal.trim()}
            onClick={() => {
              completeTask(task.id, linkVal.trim());
              setAdminLinkInputs(prev => { const n = { ...prev }; delete n[task.id]; return n; });
            }}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    // Admin task: Wstaw link done - show link
    if (task.assignedRole === 'admin' && task.title === 'Wstaw link do frame.io' && task.status === 'done' && task.value) {
      return (
        <a href={task.value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" />
          frame.io
        </a>
      );
    }

    if (canInteract && task.status === 'todo' && task.inputType === 'boolean') {
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => completeTask(task.id, 'true')}>
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Potwierdź
        </Button>
      );
    }

    return <span className="truncate">{task.value || '—'}</span>;
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{roleLabel}</h1>
          <p className="text-xs text-muted-foreground">{roleSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && <TeamManagementDialog />}
          {!readOnly && <AddProjectDialog />}
          <span className="hidden text-sm text-muted-foreground sm:inline">{currentUser.name}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentUser(null)} title="Zmień użytkownika">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Admin pending tasks panel */}
        {!readOnly && (() => {
          const adminTasks = tasks.filter(t => t.assignedRole === 'admin' && (t.status === 'todo'));
          if (adminTasks.length === 0) return null;
          return (
            <div className="mb-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 md:p-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Twoje zadania do wykonania</h2>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0">{adminTasks.length}</Badge>
              </div>
              <div className="space-y-2">
                {adminTasks.map(task => {
                  const project = projects.find(p => p.id === task.projectId);
                  return (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <Circle className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{task.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {project?.name}</span>
                      </div>
                      {task.title === 'Ustaw termin planu zdjęciowego' && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="default" className="h-7 gap-1 text-xs">
                              <CalendarClock className="h-3 w-3" />
                              Wybierz datę
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                              mode="single"
                              selected={undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const rekwizytyTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Określ rekwizyty');
                                  if (rekwizytyTask) setTaskDeadline(rekwizytyTask.id, date.toISOString());
                                  const confirmTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Potwierdź nagranie');
                                  if (confirmTask) setTaskDeadline(confirmTask.id, date.toISOString());
                                  completeTask(task.id, date.toISOString());
                                }
                              }}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                      {task.title === 'Wstaw link do frame.io' && (
                        <div className="flex items-center gap-1">
                          <div className="relative">
                            <LinkIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="url"
                              placeholder="https://frame.io/..."
                              value={adminLinkInputs[task.id] || ''}
                              onChange={e => setAdminLinkInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                              className="h-7 w-40 rounded-md border border-input bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2"
                            disabled={!(adminLinkInputs[task.id] || '').trim()}
                            onClick={() => {
                              completeTask(task.id, (adminLinkInputs[task.id] || '').trim());
                              setAdminLinkInputs(prev => { const n = { ...prev }; delete n[task.id]; return n; });
                            }}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {projects.map(project => {
          const projectTasks = getTasksForProject(project.id);
          const isFrozen = project.status === 'frozen';

          return (
            <div
              key={project.id}
              className={`mb-6 animate-fade-in rounded-xl border bg-card shadow-sm ${
                isFrozen ? 'border-muted opacity-60' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between border-b border-border px-4 py-3 md:px-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-foreground">{project.name}</h2>
                    {isFrozen && (
                      <Badge variant="secondary" className="gap-1 border-0 bg-muted text-muted-foreground text-xs">
                        <Snowflake className="h-3 w-3" />
                        Zamrożony
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Klient: {project.clientName} · {project.company || '—'} · {project.clientEmail} · {project.clientPhone || '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Data publikacji:</span>
                    {!readOnly ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                            {project.publicationDate
                              ? format(new Date(project.publicationDate), 'dd.MM.yyyy', { locale: pl })
                              : 'Ustaw datę'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={project.publicationDate ? new Date(project.publicationDate) : undefined}
                            onSelect={(date) => setPublicationDate(project.id, date ? date.toISOString() : null)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-xs font-medium text-foreground">
                        {project.publicationDate
                          ? format(new Date(project.publicationDate), 'dd.MM.yyyy', { locale: pl })
                          : '—'}
                      </span>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className="hidden md:flex items-center gap-2">
                      <Select
                        value={project.assignedInfluencerId || 'none'}
                        onValueChange={v => assignToProject(project.id, 'assignedInfluencerId', v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue placeholder="Influencer" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="none">— Brak —</SelectItem>
                          {influencers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={project.assignedEditorId || 'none'}
                        onValueChange={v => assignToProject(project.id, 'assignedEditorId', v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue placeholder="Montażysta" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="none">— Brak —</SelectItem>
                          {editors.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover z-50">
                        <DropdownMenuItem onClick={() => toggleFreezeProject(project.id)}>
                          <Snowflake className="mr-2 h-4 w-4" />
                          {isFrozen ? 'Odmroź' : 'Zamroź'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteConfirm(project.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Usuń projekt
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Etap</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rola</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Czas na zadanie</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Typ</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Wartość</th>
                      {!readOnly && <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Akcje</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {projectTasks.map(task => (
                      <tr key={task.id} className={`border-b border-border last:border-0 ${task.status === 'locked' ? 'opacity-40' : ''}`}>
                        <td className="flex items-center gap-2 px-4 py-2.5">
                          {statusIcon(task.status)}
                          <span className="font-medium text-foreground">{task.title}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary" className={`${ROLE_COLORS[task.assignedRole]} border-0 text-xs`}>
                            {ROLE_LABELS[task.assignedRole]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">{statusBadge(task.status)}</td>
                        <td className="px-4 py-2.5">{renderSlaColumn(task)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground capitalize">{task.inputType}</td>
                        <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                          {renderValueColumn(task)}
                        </td>
                        {!readOnly && (
                          <td className="px-4 py-2.5 text-right">
                            {task.status === 'done' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => reopenTask(task.id)} title="Odblokuj do ponownej weryfikacji">
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Odblokuj
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Czy na pewno chcesz usunąć projekt?</AlertDialogTitle>
              <AlertDialogDescription>
                Projekt „{getDeleteProjectName()}" oraz wszystkie przypisane do niego zadania zostaną trwale usunięte. Tej akcji nie można cofnąć.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Usuń projekt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default AdminDashboard;