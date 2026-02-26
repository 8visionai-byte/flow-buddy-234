import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS, ROLE_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, ProjectPriority } from '@/types';
import SocialDescriptionsDisplay, { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LogOut, CheckCircle2, Circle, Lock, MoreVertical, Snowflake, Trash2, AlertTriangle, RotateCcw, CalendarClock, ExternalLink, Link as LinkIcon, Send, ClipboardList, Calendar as CalendarIcon, Flag, FileText, ChevronDown, ChevronRight } from 'lucide-react';
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
  const { currentUser, setCurrentUser, tasks, projects, users, deleteProject, toggleFreezeProject, assignToProject, completeTask, reopenTask, setTaskDeadline, setPublicationDate, setProjectPriority } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [adminLinkInputs, setAdminLinkInputs] = useState<Record<string, string>>({});
  const [adminTextInputs, setAdminTextInputs] = useState<Record<string, string>>({});
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (!currentUser) return null;

  const getTasksForProject = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId).sort((a, b) => a.order - b.order);

  // Check if an admin task is effectively actionable (admin can always act)
  const isAdminTaskActionable = (task: typeof tasks[0]) => {
    if (!task.assignedRoles.includes('admin')) return false;
    // Multi-role: admin part not done yet
    if (task.assignedRoles.length > 1) return !task.roleCompletions['admin'];
    // Single-role admin task: not done yet
    return task.status !== 'done';
  };

  const isAdminTaskDone = (task: typeof tasks[0]) => {
    if (!task.assignedRoles.includes('admin')) return false;
    if (task.assignedRoles.length > 1) return !!task.roleCompletions['admin'];
    return task.status === 'done';
  };

  // Check if the pipeline is currently blocked waiting for this admin task
  const isAdminTaskBlocking = (task: typeof tasks[0]) => {
    if (!task.assignedRoles.includes('admin')) return false;
    if (isAdminTaskDone(task)) return false;
    // The task is blocking if its natural pipeline status would be 'todo' or 'pending_client_approval'
    // i.e., all previous tasks in the project are done
    const projectTasks = tasks.filter(t => t.projectId === task.projectId).sort((a, b) => a.order - b.order);
    for (const pt of projectTasks) {
      if (pt.order < task.order) {
        // For multi-role tasks, check if all roles completed
        if (pt.assignedRoles.length > 1) {
          const allDone = pt.assignedRoles.every(r => pt.roleCompletions[r]);
          if (!allDone && pt.status !== 'done') return false;
        } else if (pt.status !== 'done') {
          return false;
        }
      }
    }
    return true;
  };

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
  const clients = users.filter(u => u.role === 'klient');

  const getDeleteProjectName = () => projects.find(p => p.id === deleteConfirm)?.name || '';

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteProject(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const isNagrywkaTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.assignedRoles.includes('kierownik_planu');
  };

  const roleLabel = readOnly ? 'Kierownik Planu' : 'Panel Admina';
  const roleSubtitle = readOnly ? 'Widok tylko do odczytu' : 'Widok helikoptera — wszystkie projekty';

  // Render admin task inline action (used in both the per-project panel and table)
  const renderAdminAction = (task: typeof tasks[0], compact = false) => {
    const adminDone = isAdminTaskDone(task);
    
    if (adminDone) {
      // Show completed value
      if (task.title === 'Ustaw termin planu zdjęciowego' && task.value) {
        return (
          <span className="text-xs text-success font-medium">
            <CalendarClock className="inline mr-1 h-3 w-3" />
            {format(new Date(task.value), 'dd.MM.yyyy', { locale: pl })} ✓
          </span>
        );
      }
      if (task.title === 'Wstaw link do frame.io' && task.value) {
        return (
          <a href={task.value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-success hover:underline">
            <ExternalLink className="h-3 w-3" />
            frame.io ✓
          </a>
        );
      }
      if (task.title === 'Nadaj priorytet' && task.value) {
        return (
          <Badge variant="secondary" className={`${PRIORITY_COLORS[task.value as ProjectPriority] || ''} border-0 text-xs`}>
            <Flag className="mr-1 h-3 w-3" />{PRIORITY_LABELS[task.value as ProjectPriority] || task.value} ✓
          </Badge>
        );
      }
      if (task.title === 'Ustaw datę publikacji' && task.value) {
        return (
          <span className="text-xs text-success font-medium">
            <CalendarIcon className="inline mr-1 h-3 w-3" />
            {format(new Date(task.value), 'dd.MM.yyyy', { locale: pl })} ✓
          </span>
        );
      }
      if (task.title === 'Dodaj uwagi przed montażem') {
        return <span className="text-xs text-success font-medium">Uwagi dodane ✓</span>;
      }
      if (task.title === 'Akceptacja materiału') {
        return <span className="text-xs text-success font-medium">Zaakceptowano ✓</span>;
      }
      return <span className="text-xs text-success">Wykonane ✓</span>;
    }

    // Actionable controls
    if (task.title === 'Ustaw termin planu zdjęciowego') {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="default" className={`h-7 gap-1 text-xs ${compact ? '' : 'min-w-[120px]'}`}>
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
                  completeTask(task.id, date.toISOString(), 'admin');
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      );
    }

    if (task.title === 'Wstaw link do frame.io') {
      const linkVal = adminLinkInputs[task.id] || '';
      return (
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input type="url" placeholder="https://frame.io/..." value={linkVal}
              onChange={e => setAdminLinkInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
              className="h-7 w-full min-w-[140px] rounded-md border border-input bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <Button size="sm" variant="default" className="h-7 px-2" disabled={!linkVal.trim()}
            onClick={() => { completeTask(task.id, linkVal.trim(), 'admin'); setAdminLinkInputs(prev => { const n = { ...prev }; delete n[task.id]; return n; }); }}>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (task.title === 'Nadaj priorytet') {
      return (
        <Select onValueChange={(val: ProjectPriority) => { setProjectPriority(task.projectId, val); completeTask(task.id, val, 'admin'); }}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Priorytet" /></SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {(['low', 'medium', 'high', 'urgent'] as ProjectPriority[]).map(p => (
              <SelectItem key={p} value={p}><span className="flex items-center gap-1"><Flag className="h-3 w-3" />{PRIORITY_LABELS[p]}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (task.title === 'Dodaj uwagi przed montażem') {
      const val = adminTextInputs[task.id] || '';
      return (
        <div className="flex items-center gap-1">
          <input type="text" placeholder="Uwagi admina..." value={val}
            onChange={e => setAdminTextInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
            className="h-7 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          <Button size="sm" variant="default" className="h-7 px-2" disabled={!val.trim()} onClick={() => {
            completeTask(task.id, val.trim(), 'admin');
            setAdminTextInputs(prev => { const n = { ...prev }; delete n[task.id]; return n; });
          }}>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (task.title === 'Ustaw datę publikacji') {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="default" className={`h-7 gap-1 text-xs ${compact ? '' : 'min-w-[120px]'}`}>
              <CalendarIcon className="h-3 w-3" />
              Wybierz datę
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={undefined}
              onSelect={(date) => { if (date) { setPublicationDate(task.projectId, date.toISOString()); completeTask(task.id, date.toISOString(), 'admin'); } }}
              initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      );
    }

    if (task.title === 'Akceptacja materiału') {
      return (
        <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => completeTask(task.id, 'true', 'admin')}>
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Zaakceptuj
        </Button>
      );
    }

    return null;
  };

  const renderSlaColumn = (task: typeof tasks[0]) => {
    const isActive = task.status === 'todo' || task.status === 'pending_client_approval' || task.status === 'needs_influencer_revision';
    const isKierownik = task.assignedRoles.includes('kierownik_planu') || task.title === 'Określ rekwizyty';

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
              <Calendar mode="single" selected={undefined}
                onSelect={(date) => { if (date) setTaskDeadline(task.id, date.toISOString()); }}
                initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        );
      }
      return <span className="text-xs text-muted-foreground">—</span>;
    }

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
                  <Calendar mode="single" selected={new Date(task.deadlineDate)}
                    onSelect={(date) => { if (date) setTaskDeadline(task.id, date.toISOString()); }}
                    initialFocus className={cn("p-3 pointer-events-auto")} />
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
              <Calendar mode="single" selected={undefined}
                onSelect={(date) => { if (date) setTaskDeadline(task.id, date.toISOString()); }}
                initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        );
      }
      return <span className="text-xs text-muted-foreground">Brak terminu</span>;
    }

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
    const isKierownikConfirm = task.assignedRoles.includes('kierownik_planu') && task.title === 'Potwierdź nagranie';
    const isAdminTask = task.assignedRoles.includes('admin');

    // Kierownik confirm done
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
        // Not JSON
      }
    }

    // Multi-role task: show per-role completion + admin inline action
    if (task.assignedRoles.length > 1 && (task.status === 'todo' || task.status === 'done' || (isAdminTask && task.status === 'locked'))) {
      const completionInfo = task.assignedRoles.map(r => ({
        role: r,
        done: !!task.roleCompletions[r],
        value: task.roleCompletions[r],
      }));

      // Admin can act from table regardless of task status
      if (!readOnly && isAdminTask && !task.roleCompletions['admin']) {
        return (
          <div className="space-y-1">
            {renderAdminAction(task, true)}
            <div className="flex gap-1 flex-wrap">
              {completionInfo.map(c => (
                <Badge key={c.role} variant="secondary" className={`text-[9px] ${c.done ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'} border-0`}>
                  {ROLE_LABELS[c.role]} {c.done ? '✓' : '…'}
                </Badge>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div className="flex gap-1 flex-wrap">
          {completionInfo.map(c => (
            <TooltipProvider key={c.role}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className={`text-[9px] ${c.done ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'} border-0 cursor-help`}>
                    {ROLE_LABELS[c.role]} {c.done ? '✓' : '…'}
                  </Badge>
                </TooltipTrigger>
                {c.value && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{c.value}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      );
    }

    // Single-role admin tasks: always show action regardless of lock status
    if (!readOnly && isAdminTask && task.assignedRoles.length === 1) {
      if (isAdminTaskActionable(task)) {
        return renderAdminAction(task, true);
      }
      if (isAdminTaskDone(task)) {
        return renderAdminAction(task, true);
      }
    }

    if (canInteract && task.status === 'todo' && task.inputType === 'boolean') {
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => completeTask(task.id, 'true')}>
          <CheckCircle2 className="mr-1 h-3 w-3" />Potwierdź
        </Button>
      );
    }

    if (tryParseSocialDescriptions(task.value)) {
      return <SocialDescriptionsDisplay value={task.value} compact />;
    }

    // Actor assignment display
    if (task.inputType === 'actor_assignment' && task.value) {
      try {
        const parsed = JSON.parse(task.value);
        if (parsed.type && parsed.name) {
          return (
            <span className="text-xs">
              🎬 {parsed.name} <span className="text-muted-foreground">({parsed.type === 'client' ? 'Klient' : 'Aktor'})</span>
            </span>
          );
        }
      } catch {}
    }

    return <span className="truncate">{task.value || '—'}</span>;
  };

  // Get admin tasks for a specific project
  const getAdminTasksForProject = (projectId: string) => {
    return tasks
      .filter(t => t.projectId === projectId && t.assignedRoles.includes('admin'))
      .sort((a, b) => a.order - b.order);
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
        {projects.map(project => {
          const projectTasks = getTasksForProject(project.id);
          const isFrozen = project.status === 'frozen';
          const adminTasks = getAdminTasksForProject(project.id);
          const pendingAdminTasks = adminTasks.filter(t => isAdminTaskActionable(t));
          const blockingAdminTasks = adminTasks.filter(t => isAdminTaskBlocking(t));
          const doneAdminTasks = adminTasks.filter(t => isAdminTaskDone(t));
          const isExpanded = expandedProjects.has(project.id);

          return (
            <div
              key={project.id}
              className={`mb-6 animate-fade-in rounded-xl border bg-card shadow-sm ${
                isFrozen ? 'border-muted opacity-60' : 'border-border'
              }`}
            >
              {/* Collapsible Header */}
              <div
                className="flex items-center justify-between px-4 py-3 md:px-6 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleProject(project.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-foreground">{project.name}</h2>
                      {isFrozen && (
                        <Badge variant="secondary" className="gap-1 border-0 bg-muted text-muted-foreground text-xs">
                          <Snowflake className="h-3 w-3" />
                          Zamrożony
                        </Badge>
                      )}
                      {project.priority && project.priority !== 'medium' && (
                        <Badge variant="secondary" className={`${PRIORITY_COLORS[project.priority]} border-0 text-xs gap-1`}>
                          <Flag className="h-3 w-3" />
                          {PRIORITY_LABELS[project.priority]}
                        </Badge>
                      )}
                      {blockingAdminTasks.length > 0 && (
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs animate-pulse">
                          {blockingAdminTasks.length} blokuje!
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Klient: {project.clientName} · {project.company || '—'} · {project.clientPhone || '—'}
                      {project.publicationDate && (
                        <span className="ml-2">
                          <CalendarIcon className="inline h-3 w-3 mr-0.5" />
                          Publikacja: {format(new Date(project.publicationDate), 'dd.MM.yyyy', { locale: pl })}
                        </span>
                      )}
                    </p>
                    {!isExpanded && (() => {
                      const pTasks = getTasksForProject(project.id);
                      const doneTasks = pTasks.filter(t => t.status === 'done' || isAdminTaskDone(t)).length;
                      const total = pTasks.length;
                      const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0;
                      return (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="relative h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{doneTasks}/{total} ({pct}%)</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-2 ml-4" onClick={e => e.stopPropagation()}>
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

              {/* Expanded Content */}
              {isExpanded && (
                <>
              {/* Assignment selects */}
              {!readOnly && (
                <div className="border-t border-border px-4 py-2 md:px-6 flex items-center gap-2 flex-wrap bg-muted/20">
                  <span className="text-xs text-muted-foreground font-medium mr-1">Przypisani:</span>
                  <Select
                    value={project.assignedInfluencerId || 'none'}
                    onValueChange={v => assignToProject(project.id, 'assignedInfluencerId', v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs">
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
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue placeholder="Montażysta" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="none">— Brak —</SelectItem>
                      {editors.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={project.assignedClientId || 'none'}
                    onValueChange={v => assignToProject(project.id, 'assignedClientId', v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue placeholder="Klient" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="none">— Brak —</SelectItem>
                      {clients.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 ml-auto">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Publikacja:</span>
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
                  </div>
                </div>
              )}

              {/* Per-project Admin Tasks Panel */}
              {!readOnly && adminTasks.length > 0 && (
                <div className="border-b border-border bg-primary/5 px-4 py-3 md:px-6">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Zadania Admina</span>
                    {blockingAdminTasks.length > 0 && (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs animate-pulse">
                        {blockingAdminTasks.length} blokuje proces!
                      </Badge>
                    )}
                    {blockingAdminTasks.length === 0 && pendingAdminTasks.length > 0 && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">
                        {pendingAdminTasks.length} do zrobienia
                      </Badge>
                    )}
                    {pendingAdminTasks.length === 0 && (
                      <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">
                        Wszystko gotowe ✓
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {adminTasks.map(task => {
                      const actionable = isAdminTaskActionable(task);
                      const done = isAdminTaskDone(task);
                      const blocking = isAdminTaskBlocking(task);
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                            blocking && "border-destructive/60 bg-destructive/10 shadow-md ring-1 ring-destructive/20",
                            !blocking && actionable && "border-primary/40 bg-primary/10 shadow-sm",
                            done && "border-success/40 bg-success/10",
                            !actionable && !done && !blocking && "border-border bg-card opacity-60"
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          ) : blocking ? (
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 animate-pulse" />
                          ) : actionable ? (
                            <Circle className="h-4 w-4 text-primary shrink-0 animate-pulse" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={cn("text-xs font-medium truncate", blocking ? "text-destructive" : "text-foreground")}>
                              {task.order + 1}. {task.title}
                              {blocking && <span className="ml-1 text-[10px] font-bold">(Proces czeka!)</span>}
                            </div>
                            <div className="mt-1">
                              {(actionable || done) && renderAdminAction(task)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                    {projectTasks.map(task => {
                      const isAdminTask = task.assignedRoles.includes('admin');
                      const adminActionable = isAdminTask && isAdminTaskActionable(task);
                      const adminDone = isAdminTask && isAdminTaskDone(task);
                      const adminBlocking = isAdminTask && isAdminTaskBlocking(task);

                      return (
                        <tr
                          key={task.id}
                          className={cn(
                            "border-b border-border last:border-0",
                            !isAdminTask && task.status === 'locked' && 'opacity-40',
                            adminBlocking && 'bg-destructive/5 border-l-2 border-l-destructive',
                            !adminBlocking && adminActionable && 'bg-primary/5 border-l-2 border-l-primary',
                            adminDone && 'bg-success/5 border-l-2 border-l-success',
                          )}
                        >
                          <td className="flex items-center gap-2 px-4 py-2.5">
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{task.order + 1}.</span>
                            {isAdminTask ? (
                              adminDone ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                              adminBlocking ? <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" /> :
                              adminActionable ? <Circle className="h-4 w-4 text-primary" /> :
                              statusIcon(task.status)
                            ) : statusIcon(task.status)}
                            <span className={cn("font-medium", adminBlocking && "text-destructive font-semibold", !adminBlocking && adminActionable && "text-primary", adminDone && "text-success", !isAdminTask && "text-foreground")}>{task.title}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {task.assignedRoles.map(r => (
                                <Badge key={r} variant="secondary" className={`${ROLE_COLORS[r]} border-0 text-xs`}>
                                  {ROLE_LABELS[r]}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {isAdminTask ? (
                              adminDone ? <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">Gotowe</Badge> :
                              adminBlocking ? <Badge variant="destructive" className="border-0 text-xs animate-pulse">Proces czeka!</Badge> :
                              adminActionable ? <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">Do zrobienia</Badge> :
                              statusBadge(task.status)
                            ) : statusBadge(task.status)}
                          </td>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
              )}
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
