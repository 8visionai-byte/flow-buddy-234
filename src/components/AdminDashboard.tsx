import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS, ROLE_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, ProjectPriority, Task, UserRole } from '@/types';
import PriorityAssignmentDialog from '@/components/PriorityAssignmentDialog';
import SocialDescriptionsDisplay, { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import SocialDatesWidget, { tryParseSocialDates } from '@/components/SocialDatesWidget';
import { NOTES_ROLE_LABELS } from '@/components/MultiPartyNotesPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LogOut, CheckCircle2, Circle, Lock, MoreVertical, Snowflake, Trash2, AlertTriangle,
  RotateCcw, CalendarClock, ExternalLink, Link as LinkIcon, Send, ClipboardList,
  Calendar as CalendarIcon, Flag, FileText, ChevronDown, ChevronRight, ChevronLeft,
  Building2, Clock, LayoutList, Users, Phone, Mail, Lightbulb, UserPlus, Check, X, Eye,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import AddCampaignDialog from '@/components/AddCampaignDialog';
import TeamManagementDialog from '@/components/TeamManagementDialog';
import ClientManagementDialog from '@/components/ClientManagementDialog';
import IdeasBankDialog from '@/components/IdeasBankDialog';
import IdeasPanel from '@/components/IdeasPanel';
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

const DEFAULT_SLA_MS = 48 * 60 * 60 * 1000;

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

type ViewId = 'campaigns' | 'tasks' | 'client' | 'delays' | 'details' | 'project';

const VIEWS: { id: ViewId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'campaigns', label: 'Kampanie', icon: Lightbulb },
  { id: 'tasks', label: 'Moje Zadania', icon: ClipboardList },
  { id: 'client', label: 'Widok Klienta', icon: Building2 },
  { id: 'delays', label: 'Opóźnienia', icon: Clock },
  { id: 'details', label: 'Wszystkie pomysły', icon: LayoutList },
];

const AdminDashboard = ({ readOnly = false, allowedTaskIds }: AdminDashboardProps) => {
  const {
    currentUser, setCurrentUser, tasks, projects, clients, users, ideas,
    deleteProject, toggleFreezeProject, assignToProject, completeTask,
    setTaskDeadline, setPublicationDate, setProjectPriority, setProjectSla,
    campaigns, updateCampaign, deleteCampaign, addUser, setFilmingDate,
  } = useApp();

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteCampaignConfirm, setDeleteCampaignConfirm] = useState<string | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [adminLinkInputs, setAdminLinkInputs] = useState<Record<string, string>>({});
  const [adminTextInputs, setAdminTextInputs] = useState<Record<string, string>>({});
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [slaInputs, setSlaInputs] = useState<Record<string, string>>({});
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [activeView, setActiveView] = useState<ViewId>('campaigns');
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [clientViewId, setClientViewId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<Exclude<ViewId, 'project'>>('campaigns');
  // Two-step filming-date setup: step 1 = pick date, step 2 = assign KP + Operator + confirm
  const [filmingSetup, setFilmingSetup] = useState<Record<string, { date: Date; kierownikId: string; operatorId: string; selectedProjectIds: string[] }>>({});
  // Quick filming date picker per project (projectId → open state)
  const [filmingDateOpen, setFilmingDateOpen] = useState<Record<string, boolean>>({});
  // Priority assignment dialog
  const [priorityDialogTask, setPriorityDialogTask] = useState<Task | null>(null);
  const [inlineNewKP, setInlineNewKP] = useState<Record<string, string>>({});
  const [inlineNewOp, setInlineNewOp] = useState<Record<string, string>>({});

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const navigateToProject = (projectId: string) => {
    setPreviousView(activeView as Exclude<ViewId, 'project'>);
    setSelectedProjectId(projectId);
    setActiveView('project');
  };

  const navigateBack = () => {
    setActiveView(previousView);
    setSelectedProjectId(null);
  };

  if (!currentUser) return null;

  const getTasksForProject = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId).sort((a, b) => a.order - b.order);

  const isAdminTaskActionable = (task: typeof tasks[0]) => {
    if (!task.assignedRoles.includes('admin')) return false;
    if (task.status === 'locked') return false;
    // Filming task with value already set is done — not actionable
    if (task.title === 'Ustaw termin planu zdjęciowego' && !!task.value) return false;
    if (task.assignedRoles.length > 1) return !task.roleCompletions['admin'];
    return task.status === 'todo' || task.status === 'pending_client_approval';
  };

  const isAdminTaskDone = (task: typeof tasks[0]) => {
    if (!task.assignedRoles.includes('admin')) return false;
    // Filming date is "done" as soon as a value is stored, regardless of pipeline status
    if (task.title === 'Ustaw termin planu zdjęciowego') return !!task.value;
    if (task.assignedRoles.length > 1) return !!task.roleCompletions['admin'];
    return task.status === 'done';
  };

  const isAdminTaskBlocking = (task: typeof tasks[0]) => {
    if (!task.assignedRoles.includes('admin')) return false;
    if (isAdminTaskDone(task)) return false;

    if (task.status === 'todo' || task.status === 'pending_client_approval') {
      return true;
    }

    const projectTasks = tasks.filter(t => t.projectId === task.projectId).sort((a, b) => a.order - b.order);
    for (const pt of projectTasks) {
      if (pt.order < task.order) {
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
    if (status === 'deferred') return <RotateCcw className="h-4 w-4 text-muted-foreground" />;
    if (status === 'rejected_final') return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />;
  };

  const statusBadge = (status: string) => {
    if (status === 'done') return <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">Gotowe</Badge>;
    if (status === 'todo') return <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">Aktywne</Badge>;
    if (status === 'pending_client_approval') return <Badge variant="secondary" className="bg-warning/10 text-warning border-0 text-xs">Czeka na klienta</Badge>;
    if (status === 'needs_influencer_revision') return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs">Do poprawy</Badge>;
    if (status === 'deferred') return <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-xs">Na później</Badge>;
    if (status === 'rejected_final') return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs">Odrzucony</Badge>;
    return <Badge variant="secondary" className="text-xs opacity-40">Zablokowane</Badge>;
  };

  const influencers = users.filter(u => u.role === 'influencer');
  const editors = users.filter(u => u.role === 'montazysta');
  const clientUsers = users.filter(u => u.role === 'klient');
  const kierownicy = users.filter(u => u.role === 'kierownik_planu');

  const filteredProjects = clientFilter === 'all'
    ? projects
    : projects.filter(p => {
        if (p.clientId === clientFilter) return true;
        // Legacy: match by resolved client entity
        const resolved = p.clientId ? null : clients.find(c => c.id === clientFilter && c.companyName === p.company);
        return !!resolved;
      });

  const getClientForProject = (project: typeof projects[0]) =>
    project.clientId ? clients.find(c => c.id === project.clientId) : null;

  const getDeleteProjectName = () => projects.find(p => p.id === deleteConfirm)?.name || '';

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteProject(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const toggleBulkSelected = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkSelectMode(false);
    setBulkSelected(new Set());
  };

  const handleBulkDeleteConfirm = () => {
    bulkSelected.forEach(id => deleteProject(id));
    setBulkDeleteConfirm(false);
    exitBulkMode();
  };

  const isNagrywkaTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.assignedRoles.includes('kierownik_planu');
  };

  const roleLabel = readOnly ? 'Kierownik Planu' : 'Panel Admina';
  const roleSubtitle = readOnly ? 'Widok tylko do odczytu' : 'Centrum zarządzania';

  const renderAdminAction = (task: typeof tasks[0], compact = false) => {
    const adminDone = isAdminTaskDone(task);

    if (adminDone) {
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
      if (task.title === 'Nadaj priorytet montażu' && task.value) {
        return (
          <Badge variant="secondary" className={`${PRIORITY_COLORS[task.value as ProjectPriority] || ''} border-0 text-xs`}>
            <Flag className="mr-1 h-3 w-3" />{PRIORITY_LABELS[task.value as ProjectPriority] || task.value} ✓
          </Badge>
        );
      }
      if (task.title === 'Ustaw datę publikacji' && task.value) {
        const dates = tryParseSocialDates(task.value);
        if (dates) {
          const entries = Object.entries(dates).filter(([, v]) => v);
          return (
            <div className="flex flex-wrap gap-1">
              {entries.map(([key, val]) => {
                const label = key.replace('Date', '').replace('facebook','FB').replace('tiktok','TT').replace('instagram','IG').replace('youtube','YT');
                return (
                  <span key={key} className="inline-flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    {label} {format(new Date(val as string), 'dd.MM', { locale: pl })}
                  </span>
                );
              })}
            </div>
          );
        }
        // fallback: old single-date format
        try {
          return (
            <span className="text-xs text-success font-medium">
              <CalendarIcon className="inline mr-1 h-3 w-3" />
              {format(new Date(task.value), 'dd.MM.yyyy', { locale: pl })} ✓
            </span>
          );
        } catch { return <span className="text-xs text-success">Ustawiono ✓</span>; }
      }
      if (task.title === 'Wnieś uwagi przed montażem') {
        return <span className="text-xs text-success font-medium">Uwagi dodane ✓</span>;
      }
      if (task.title === 'Akceptacja materiału') {
        return <span className="text-xs text-success font-medium">Zaakceptowano ✓</span>;
      }
      return <span className="text-xs text-success">Wykonane ✓</span>;
    }

    if (task.title === 'Ustaw termin planu zdjęciowego') {
      const project = projects.find(p => p.id === task.projectId);
      const setup = filmingSetup[task.id];
      const isPast = setup ? (() => { const t = new Date(); t.setHours(0,0,0,0); return setup.date < t; })() : false;

      const applyFilmingDate = () => {
        if (!setup) return;
        const { date, kierownikId, operatorId, selectedProjectIds } = setup;
        selectedProjectIds.forEach(projId => {
          if (kierownikId) assignToProject(projId, 'assignedKierownikId', kierownikId);
          if (operatorId) assignToProject(projId, 'assignedOperatorId', operatorId);
          setFilmingDate(projId, date.toISOString());
        });
        setFilmingSetup(prev => { const n = { ...prev }; delete n[task.id]; return n; });
      };

      return (
        <Popover onOpenChange={open => { if (!open) setFilmingSetup(prev => { const n = { ...prev }; delete n[task.id]; return n; }); }}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="default" className={`h-7 gap-1 text-xs ${compact ? '' : 'min-w-[120px]'}`}>
              <CalendarClock className="h-3 w-3" />
              Wybierz datę
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            {!setup ? (
              /* ── Step 1: Pick date ── */
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={date => {
                  if (date) {
                    const pendingProjectIds = tasks
                      .filter(t => {
                        if (t.title !== 'Ustaw termin planu zdjęciowego' || t.value) return false;
                        const relatedProject = projects.find(p => p.id === t.projectId);
                        return relatedProject?.clientId === project?.clientId;
                      })
                      .map(t => t.projectId);
                    setFilmingSetup(prev => ({
                      ...prev,
                      [task.id]: {
                        date,
                        kierownikId: project?.assignedKierownikId ?? '',
                        operatorId: project?.assignedOperatorId ?? '',
                        selectedProjectIds: pendingProjectIds,
                      },
                    }));
                  }
                }}
                disabled={(date) => { const t = new Date(); t.setHours(0, 0, 0, 0); return date < t; }}
                locale={pl}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            ) : (
              /* ── Step 2: Assign KP + Operator ── */
              <div className="p-4 w-72 space-y-4 pointer-events-auto">
                {/* Date display */}
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground">
                    {format(setup.date, 'EEEE, dd.MM.yyyy', { locale: pl })}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
                    onClick={() => setFilmingSetup(prev => { const n = { ...prev }; delete n[task.id]; return n; })}
                  >
                    Zmień datę
                  </button>
                </div>

                {isPast && (
                  <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Wybrany termin jest datą z przeszłości. Upewnij się, że to zamierzone.
                  </div>
                )}

                {/* KP selector */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Kierownik Planu
                    </label>
                    {!inlineNewKP[task.id] && (
                      <button
                        type="button"
                        onClick={() => setInlineNewKP(prev => ({ ...prev, [task.id]: '' }))}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <UserPlus className="h-3 w-3" />Dodaj
                      </button>
                    )}
                  </div>
                  {inlineNewKP[task.id] !== undefined ? (
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Imię i nazwisko"
                        value={inlineNewKP[task.id] || ''}
                        onChange={e => setInlineNewKP(prev => ({ ...prev, [task.id]: e.target.value }))}
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={!(inlineNewKP[task.id] || '').trim()}
                        onClick={() => {
                          const name = (inlineNewKP[task.id] || '').trim();
                          if (!name) return;
                          const newId = addUser({ name, role: 'kierownik_planu' });
                          setFilmingSetup(prev => ({ ...prev, [task.id]: { ...prev[task.id], kierownikId: newId } }));
                          setInlineNewKP(prev => { const n = { ...prev }; delete n[task.id]; return n; });
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setInlineNewKP(prev => { const n = { ...prev }; delete n[task.id]; return n; })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={setup.kierownikId || 'none'}
                      onValueChange={v => setFilmingSetup(prev => ({ ...prev, [task.id]: { ...prev[task.id], kierownikId: v === 'none' ? '' : v } }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Wybierz kierownika..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="none">— Brak —</SelectItem>
                        {kierownicy.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Operator selector */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Operator
                    </label>
                    {!inlineNewOp[task.id] && (
                      <button
                        type="button"
                        onClick={() => setInlineNewOp(prev => ({ ...prev, [task.id]: '' }))}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <UserPlus className="h-3 w-3" />Dodaj
                      </button>
                    )}
                  </div>
                  {inlineNewOp[task.id] !== undefined ? (
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Imię i nazwisko"
                        value={inlineNewOp[task.id] || ''}
                        onChange={e => setInlineNewOp(prev => ({ ...prev, [task.id]: e.target.value }))}
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={!(inlineNewOp[task.id] || '').trim()}
                        onClick={() => {
                          const name = (inlineNewOp[task.id] || '').trim();
                          if (!name) return;
                          const newId = addUser({ name, role: 'operator' });
                          setFilmingSetup(prev => ({ ...prev, [task.id]: { ...prev[task.id], operatorId: newId } }));
                          setInlineNewOp(prev => { const n = { ...prev }; delete n[task.id]; return n; });
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setInlineNewOp(prev => { const n = { ...prev }; delete n[task.id]; return n; })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={setup.operatorId || 'none'}
                      onValueChange={v => setFilmingSetup(prev => ({ ...prev, [task.id]: { ...prev[task.id], operatorId: v === 'none' ? '' : v } }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Wybierz operatora..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="none">— Brak —</SelectItem>
                        {users.filter(u => u.role === 'operator').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Project selection */}
                {(() => {
                  const taskProject = projects.find(p => p.id === task.projectId);
                  const allClientFilmingIds = tasks
                    .filter(t => {
                      if (t.title !== 'Ustaw termin planu zdjęciowego') return false;
                      const relatedProject = projects.find(p => p.id === t.projectId);
                      return relatedProject?.clientId === taskProject?.clientId;
                    })
                    .map(t => t.projectId)
                    .filter((id, i, a) => a.indexOf(id) === i);
                  if (!allClientFilmingIds.length) return null;
                  return (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Pomysły w tej sesji
                      </label>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {allClientFilmingIds.map(projId => {
                          const proj = projects.find(p => p.id === projId);
                          if (!proj) return null;
                          const isChecked = setup.selectedProjectIds.includes(projId);
                          return (
                            <label key={projId} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={isChecked}
                                onChange={e => setFilmingSetup(prev => ({
                                  ...prev,
                                  [task.id]: {
                                    ...prev[task.id],
                                    selectedProjectIds: e.target.checked
                                      ? [...prev[task.id].selectedProjectIds, projId]
                                      : prev[task.id].selectedProjectIds.filter(id => id !== projId),
                                  },
                                }))}
                              />
                              <span className="text-xs text-foreground truncate">{proj.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={applyFilmingDate} disabled={!setup.selectedProjectIds?.length}>
                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                    Zatwierdź termin
                  </Button>
                </div>
              </div>
            )}
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

    if (task.title === 'Nadaj priorytet montażu') {
      return (
        <Button
          size="sm"
          variant="default"
          className={`h-7 gap-1 text-xs ${compact ? '' : 'min-w-[140px]'}`}
          onClick={() => setPriorityDialogTask(task)}
        >
          <Flag className="h-3 w-3" />
          Ustaw priorytet
        </Button>
      );
    }

    if (task.title === 'Wnieś uwagi przed montażem') {
      const myNote = task.roleCompletions['admin'] ?? '';
      const val = adminTextInputs[task.id] ?? myNote;
      const othersNotes = Object.entries(task.roleCompletions).filter(([r]) => r !== 'admin' && r !== 'influencer');
      return (
        <div className="space-y-2 min-w-[260px]">
          {/* Others' notes — visible to admin */}
          {othersNotes.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 p-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Uwagi zespołu</p>
              {othersNotes.map(([r, note]) => (
                <div key={r} className="space-y-0.5">
                  <span className="inline-flex items-center rounded-sm bg-secondary/70 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {NOTES_ROLE_LABELS[r] ?? r}
                  </span>
                  <p className="text-xs text-foreground whitespace-pre-wrap pl-1 leading-snug">{note}</p>
                </div>
              ))}
            </div>
          )}
          {/* Admin's own input */}
          <div className="flex items-start gap-1">
            <Textarea
              placeholder="Twoje uwagi jako DZ..."
              value={val}
              onChange={e => setAdminTextInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
              rows={myNote ? 2 : 3}
              className="text-xs"
            />
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2 mt-0.5 shrink-0"
              disabled={!val.trim()}
              onClick={() => {
                completeTask(task.id, val.trim(), 'admin');
                setAdminTextInputs(prev => { const n = { ...prev }; delete n[task.id]; return n; });
              }}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
          {myNote && (
            <p className="text-[10px] text-success flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />Twoje uwagi wysłane — możesz edytować
            </p>
          )}
        </div>
      );
    }

    if (task.title === 'Ustaw datę publikacji') {
      return (
        <SocialDatesWidget
          socialTextsJson={task.previousValue ?? null}
          currentValue={task.value ?? null}
          onSubmit={(datesJson, earliest) => {
            if (earliest) setPublicationDate(task.projectId, earliest.toISOString());
            completeTask(task.id, datesJson, 'admin');
          }}
        />
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
    const project = projects.find(p => p.id === task.projectId);
    const SLA_MS = project?.slaHours ? project.slaHours * 3600000 : DEFAULT_SLA_MS;

    if (task.status === 'done' && task.assignedAt && task.completedAt) {
      const durationMs = differenceInMilliseconds(new Date(task.completedAt), new Date(task.assignedAt));
      const overdue = isKierownik
        ? (task.deadlineDate ? new Date(task.completedAt) > new Date(task.deadlineDate) : false)
        : durationMs > SLA_MS;

      return (
        <div className={`text-xs ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
          <div className="font-medium">{format(new Date(task.completedAt), 'dd.MM · HH:mm')}</div>
          <div className="text-[10px] opacity-70">{formatDurationFromMs(durationMs)}{overdue && ' (!)'}</div>
        </div>
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

  // Returns the person's name assigned to a role in the project
  const getPersonForRole = (role: UserRole, projectId: string): string | null => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    const idMap: Partial<Record<UserRole, string | null>> = {
      influencer: project.assignedInfluencerId,
      klient: project.assignedClientId,
      montazysta: project.assignedEditorId,
      kierownik_planu: project.assignedKierownikId,
      operator: project.assignedOperatorId,
      publikator: project.assignedPublikatorId,
    };
    const userId = idMap[role];
    if (!userId) return null;
    return users.find(u => u.id === userId)?.name || null;
  };

  // Returns JSX content for the detail popover, or null if nothing worth showing
  const getValuePopoverContent = (task: typeof tasks[0]): React.ReactNode => {
    if (!task.value) return null;

    if (task.inputType === 'text') {
      return <p className="text-sm whitespace-pre-wrap">{task.value}</p>;
    }

    if (task.inputType === 'url') {
      return (
        <a href={task.value} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline break-all">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />{task.value}
        </a>
      );
    }

    if (task.inputType === 'actor_assignment') {
      try {
        const parsed = JSON.parse(task.value);
        const actors: { name?: string; roleLabel?: string }[] = Array.isArray(parsed) ? parsed : [parsed];
        if (!actors.length) return null;
        return (
          <div className="space-y-1.5">
            {actors.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm font-medium">{a.name || '—'}</span>
                {a.roleLabel && <span className="text-xs text-muted-foreground">{a.roleLabel}</span>}
              </div>
            ))}
          </div>
        );
      } catch { return null; }
    }

    if (task.inputType === 'actor_approval') {
      // value like "approved: Tylko niech s..." — extract comment
      const sep = task.value.indexOf(': ');
      const comment = sep >= 0 ? task.value.slice(sep + 2) : null;
      if (!comment) return null;
      return <p className="text-sm whitespace-pre-wrap">{comment}</p>;
    }

    if (task.inputType === 'filming_confirmation') {
      try {
        const parsed = JSON.parse(task.value);
        return (
          <div className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Nr nagrania: </span><span className="font-medium">#{parsed.recordingNumber || '—'}</span></div>
            {parsed.notes && <div><span className="text-muted-foreground">Notatka: </span>{parsed.notes}</div>}
          </div>
        );
      } catch { return null; }
    }

    if (task.inputType === 'raw_footage') {
      try {
        const parsed = JSON.parse(task.value);
        return (
          <div className="space-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Nr nagrania: </span><span className="font-medium">#{parsed.recordingNumber || '—'}</span></div>
            {parsed.url && (
              <a href={parsed.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline break-all">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />Surówka
              </a>
            )}
            {parsed.notes && <div><span className="text-muted-foreground">Notatka: </span>{parsed.notes}</div>}
          </div>
        );
      } catch { return null; }
    }

    if (task.inputType === 'multi_party_notes') {
      const entries = Object.entries(task.roleCompletions || {});
      if (!entries.length) return null;
      return (
        <div className="space-y-2">
          {entries.map(([role, note]) => (
            <div key={role}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {NOTES_ROLE_LABELS[role as keyof typeof NOTES_ROLE_LABELS] || ROLE_LABELS[role as UserRole] || role}
              </span>
              <p className="text-sm mt-0.5 whitespace-pre-wrap">{note}</p>
            </div>
          ))}
        </div>
      );
    }

    if (task.inputType === 'publication_confirm') {
      try {
        const confirmedRaw: Record<string, string | boolean | null> = JSON.parse(task.value);
        // Normalize: old data may store boolean `true` instead of ISO timestamp
        const confirmed: Record<string, string | null> = Object.fromEntries(
          Object.entries(confirmedRaw).map(([k, v]) => [k, typeof v === 'string' ? v : null])
        );
        // Try to get planned dates from the sibling task
        const datesTask = tasks.find(t => t.projectId === task.projectId && t.title === 'Ustaw datę publikacji');
        const dates = datesTask?.value ? (() => { try { return JSON.parse(datesTask.value); } catch { return null; } })() : null;
        const PLAT_LABELS: Record<string, string> = { facebook: 'Facebook', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };
        const DATE_KEYS: Record<string, string> = { facebook: 'facebookDate', tiktok: 'tiktokDate', instagram: 'instagramDate', youtube: 'youtubeDate' };
        return (
          <div className="space-y-2">
            {Object.entries(confirmed).map(([platform, confirmedAt]) => {
              const label = PLAT_LABELS[platform] || platform;
              const plannedRaw = dates?.[DATE_KEYS[platform]];
              const planned = plannedRaw ? format(new Date(plannedRaw), 'dd.MM.yyyy', { locale: pl }) : null;
              const actual = confirmedAt ? format(new Date(confirmedAt), 'dd.MM.yyyy, HH:mm', { locale: pl }) : null;
              const isLate = confirmedAt && plannedRaw ? new Date(confirmedAt) > new Date(plannedRaw) : false;
              return (
                <div key={platform} className="text-sm">
                  <span className="font-medium">{label}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {planned && <div>Zaplanowane: {planned}</div>}
                    {actual
                      ? <div className={isLate ? 'text-destructive font-medium' : 'text-success'}>
                          Wykonane: {actual}{isLate ? ' (po terminie)' : ''}
                        </div>
                      : <div className="text-muted-foreground/60 italic">Nie wykonano</div>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        );
      } catch {
        return <p className="text-sm">{task.value}</p>;
      }
    }

    if (tryParseSocialDescriptions(task.value)) {
      return <SocialDescriptionsDisplay value={task.value} />;
    }

    if (tryParseSocialDates(task.value)) {
      try {
        const parsed = JSON.parse(task.value);
        const labelMap: Record<string, string> = { facebookDate: 'Facebook', tiktokDate: 'TikTok', instagramDate: 'Instagram', youtubeDate: 'YouTube' };
        return (
          <div className="space-y-1 text-sm">
            {Object.entries(parsed).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><span className="text-muted-foreground">{labelMap[k] || k}: </span>{String(v)}</div>
            ))}
          </div>
        );
      } catch { return null; }
    }

    // Skip boolean/approval — nothing meaningful
    if (['boolean', 'approval', 'script_review', 'frameio_review'].includes(task.inputType)) return null;

    // Fallback plain text
    if (task.value && task.value !== 'approved' && task.value !== 'true') {
      return <p className="text-sm whitespace-pre-wrap">{task.value}</p>;
    }

    return null;
  };

  const renderValueColumn = (task: typeof tasks[0]) => {
    const isActive = task.status === 'todo' || task.status === 'pending_client_approval' || task.status === 'needs_influencer_revision';
    const canInteract = readOnly ? isNagrywkaTask(task.id) && isActive : false;
    const isAdminTask = task.assignedRoles.includes('admin');

    // Kierownik in read-only mode can confirm nagranie
    if (canInteract && task.status === 'todo' && task.inputType === 'boolean') {
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => completeTask(task.id, 'true')}>
          <CheckCircle2 className="mr-1 h-3 w-3" />Potwierdź
        </Button>
      );
    }

    // Admin single-role task: show action button
    if (!readOnly && isAdminTask && task.assignedRoles.length === 1) {
      if (isAdminTaskActionable(task) || isAdminTaskDone(task)) {
        return renderAdminAction(task, true);
      }
    }

    // Multi-role task with admin: show action + completion badges
    if (!readOnly && isAdminTask && task.assignedRoles.length > 1 &&
        (task.status === 'todo' || task.status === 'done' || task.status === 'locked')) {
      const completionInfo = task.assignedRoles.map(r => ({
        role: r, done: !!task.roleCompletions[r],
      }));
      if (!task.roleCompletions['admin'] && isAdminTaskActionable(task)) {
        return (
          <div className="space-y-1">
            {renderAdminAction(task, true)}
            <div className="flex gap-1 flex-wrap">
              {completionInfo.map(c => (
                <Badge key={c.role} variant="secondary"
                  className={`text-[9px] ${c.done ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'} border-0`}>
                  {ROLE_LABELS[c.role]} {c.done ? '✓' : '…'}
                </Badge>
              ))}
            </div>
          </div>
        );
      }
      // All done: fall through to eye popover for multi_party_notes
    }

    // Eye popover for completed tasks with meaningful content
    const popoverContent = getValuePopoverContent(task);
    if (!popoverContent) return <span className="text-xs text-muted-foreground">—</span>;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 max-h-64 overflow-y-auto" align="end">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{task.title}</p>
          {popoverContent}
        </PopoverContent>
      </Popover>
    );
  };

  const getAdminTasksForProject = (projectId: string) => {
    return tasks
      .filter(t => t.projectId === projectId && t.assignedRoles.includes('admin'))
      .sort((a, b) => a.order - b.order);
  };

  // --- getProjectGroups helper ---
  type ProjectGroup = {
    key: string;
    label: string;
    client: typeof clients[0] | null;
    projects: typeof projects;
  };

  /** Resolve which client entity a project belongs to (by clientId or by matching company name) */
  const resolveProjectClient = (project: typeof projects[0]) => {
    if (project.clientId) return clients.find(c => c.id === project.clientId) || null;
    if (project.company) return clients.find(c => c.companyName === project.company) || null;
    return null;
  };

  function getProjectGroups(projectList: typeof projects): ProjectGroup[] {
    const groupMap = new Map<string, ProjectGroup>();

    for (const project of projectList) {
      // Resolve client entity either by id or by legacy company name match
      const resolvedClient = resolveProjectClient(project);
      const groupKey = resolvedClient ? resolvedClient.id : (project.company ? `company:${project.company}` : '__none__');

      if (project.clientId || resolvedClient) {
        const client = resolvedClient;
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            key: groupKey,
            label: client ? client.companyName : (project.company || 'Bez klienta'),
            client,
            projects: [],
          });
        }
        groupMap.get(groupKey)!.projects.push(project);
      } else if (project.company) {
        const key = `company:${project.company}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            label: project.company,
            client: null,
            projects: [],
          });
        }
        groupMap.get(key)!.projects.push(project);
      } else {
        const key = '__none__';
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            label: 'Bez klienta',
            client: null,
            projects: [],
          });
        }
        groupMap.get(key)!.projects.push(project);
      }
    }

    return Array.from(groupMap.values());
  }

  // --- Render compact clickable project summary card ---
  const renderProjectSummaryCard = (project: typeof projects[0], onClick: () => void) => {
    const projectTasks = getTasksForProject(project.id);
    const doneTasks = projectTasks.filter(t => t.status === 'done' || isAdminTaskDone(t)).length;
    const total = projectTasks.length;
    const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0;
    const isFrozen = project.status === 'frozen';
    const isComplete = total > 0 && projectTasks.every(t => t.status === 'done');
    const adminTasks = getAdminTasksForProject(project.id);
    const pendingAdminCount = adminTasks.filter(t => isAdminTaskActionable(t)).length;
    const blockingCount = adminTasks.filter(t => isAdminTaskBlocking(t)).length;
    const activeTasks = projectTasks.filter(t =>
      t.status === 'todo' || t.status === 'pending_client_approval' || t.status === 'needs_influencer_revision'
    );
    const activeTask = activeTasks[0];
    const clientEntity = resolveProjectClient(project);

    // ── Filming date indicator ──────────────────────────────────────────────
    const filmingTask = projectTasks.find(t => t.title === 'Ustaw termin planu zdjęciowego');
    const filmingDateValue = filmingTask?.value ?? null;
    const filmingDateParsed = filmingDateValue ? new Date(filmingDateValue) : null;
    const activeOrder = activeTask?.order ?? -1;
    // Urgency: stage 5-6 = approaching (yellow), stage 7+ = now (red), done = show date
    const filmingUrgency = filmingDateParsed
      ? 'set'
      : !isComplete && activeOrder >= 7
        ? 'required'       // filming task is active NOW
        : !isComplete && activeOrder >= 5
          ? 'soon'         // 1-2 stages away
          : 'none';
    const isFilmingDateOpen = filmingDateOpen[project.id] ?? false;

    return (
      <div
        key={project.id}
        className={`mb-3 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all hover:border-primary/40 ${
          isComplete ? 'border-success bg-success/5' :
          isFrozen ? 'border-muted bg-muted/10 opacity-60' :
          blockingCount > 0 ? 'border-destructive/50 bg-destructive/5' :
          'border-border bg-card'
        }`}
        onClick={onClick}
      >
        <div className="px-4 py-3 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn("font-semibold text-sm", isComplete ? "text-success" : "text-foreground")}>{project.name}</h3>
                {isComplete && <Badge variant="secondary" className="gap-1 border-0 bg-success/15 text-success text-xs"><CheckCircle2 className="h-3 w-3" />Zakończony</Badge>}
                {isFrozen && <Badge variant="secondary" className="gap-1 border-0 bg-muted text-muted-foreground text-xs"><Snowflake className="h-3 w-3" />Zamrożony</Badge>}
                {project.priority && project.priority !== 'medium' && (
                  <Badge variant="secondary" className={`${PRIORITY_COLORS[project.priority]} border-0 text-xs gap-1`}><Flag className="h-3 w-3" />{PRIORITY_LABELS[project.priority]}</Badge>
                )}
                {blockingCount > 0 && <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs animate-pulse">{blockingCount} blokuje!</Badge>}
                {!blockingCount && pendingAdminCount > 0 && <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">{pendingAdminCount} zadań admina</Badge>}
              </div>
              {clientEntity && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <Building2 className="inline h-3 w-3 mr-1" />
                  {clientEntity.companyName} · {clientEntity.contactName}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          </div>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{doneTasks}/{total}</span>
          </div>

          {/* Active stage */}
          {activeTask && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">Etap:</span> {activeTasks.map(t => t.title).join(', ')}
            </p>
          )}

          {/* Filming date indicator */}
          {filmingUrgency !== 'none' && !isComplete && (
            <div className="mt-1.5" onClick={e => e.stopPropagation()}>
              <Popover open={isFilmingDateOpen} onOpenChange={open => setFilmingDateOpen(prev => ({ ...prev, [project.id]: open }))}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                      filmingUrgency === 'set'
                        ? "text-success hover:bg-success/10"
                        : filmingUrgency === 'required'
                          ? "text-destructive bg-destructive/10 hover:bg-destructive/15 animate-pulse"
                          : "text-warning hover:bg-warning/10"
                    )}
                  >
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    {filmingUrgency === 'set'
                      ? <>Nagranie: {format(filmingDateParsed!, 'dd.MM.yyyy', { locale: pl })} <span className="text-muted-foreground font-normal">(zmień)</span></>
                      : filmingUrgency === 'required'
                        ? 'Ustaw termin nagrania!'
                        : 'Warto zaplanować termin nagrania'
                    }
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <p className="text-xs font-semibold text-foreground">Termin nagrania — {project.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Ustaw datę planu zdjęciowego</p>
                  </div>
                  <Calendar
                    mode="single"
                    selected={filmingDateParsed ?? undefined}
                    onSelect={date => {
                      if (date) {
                        setFilmingDate(project.id, date.toISOString());
                        setFilmingDateOpen(prev => ({ ...prev, [project.id]: false }));
                      }
                    }}
                    disabled={(date) => { const t = new Date(); t.setHours(0,0,0,0); return date < t; }}
                    locale={pl}
                    initialFocus
                  />
                  {filmingDateParsed && (
                    <div className="border-t px-3 pb-3 pt-2">
                      <button
                        onClick={() => {
                          setFilmingDate(project.id, null);
                          setFilmingDateOpen(prev => ({ ...prev, [project.id]: false }));
                        }}
                        className="w-full rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
                      >
                        Wyczyść — do ustalenia
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {project.publicationDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <CalendarIcon className="h-3 w-3" />
              Publikacja: {format(new Date(project.publicationDate), 'dd.MM.yyyy', { locale: pl })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- VIEW 5: Project detail page ---
  const renderProjectView = () => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return <div className="text-center py-16 text-muted-foreground">Pomysł nie znaleziony.</div>;

    const projectTasks = getTasksForProject(project.id);
    const isFrozen = project.status === 'frozen';
    const allTasksDone = projectTasks.every(t => t.status === 'done');
    const isProjectComplete = allTasksDone && projectTasks.length > 0;
    const adminTasks = getAdminTasksForProject(project.id);
    const blockingAdminTasks = adminTasks.filter(t => isAdminTaskBlocking(t));
    const clientEntity = resolveProjectClient(project);

    const doneTasks = projectTasks.filter(t => t.status === 'done' || isAdminTaskDone(t)).length;
    const total = projectTasks.length;
    const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0;

    return (
      <div className="space-y-4">
        {/* Project header card */}
        <div className={`rounded-xl border shadow-sm bg-card ${isProjectComplete ? 'border-success bg-success/5' : isFrozen ? 'border-muted opacity-70' : 'border-border'}`}>
          <div className="px-4 py-4 md:px-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h2 className={cn("text-xl font-bold", isProjectComplete ? "text-success" : "text-foreground")}>{project.name}</h2>
                {clientEntity && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <Building2 className="inline h-3.5 w-3.5 mr-1" />
                    {clientEntity.companyName} · {clientEntity.contactName}
                    {clientEntity.phone && ` · ${clientEntity.phone}`}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {isProjectComplete && <Badge variant="secondary" className="gap-1 border-0 bg-success/15 text-success"><CheckCircle2 className="h-3 w-3" />Pomysł zakończony</Badge>}
                {isFrozen && <Badge variant="secondary" className="gap-1 border-0 bg-muted text-muted-foreground"><Snowflake className="h-3 w-3" />Zamrożony</Badge>}
                {project.priority && project.priority !== 'medium' && (
                  <Badge variant="secondary" className={`${PRIORITY_COLORS[project.priority]} border-0 gap-1`}><Flag className="h-3 w-3" />{PRIORITY_LABELS[project.priority]}</Badge>
                )}
                {blockingAdminTasks.length > 0 && (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 animate-pulse">{blockingAdminTasks.length} blokuje!</Badge>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-2 flex-1 max-w-sm overflow-hidden rounded-full bg-secondary">
                <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{doneTasks}/{total} ({pct}%)</span>
            </div>
          </div>

          {/* Assignment selects */}
          {!readOnly && (
            <div className="border-t border-border px-4 pt-2 pb-3 md:px-6 bg-muted/20 space-y-2">
              {/* Role assignments */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {([
                  { label: 'Klient',            field: 'assignedClientId',      options: clientUsers },
                  { label: 'Influencer',        field: 'assignedInfluencerId',  options: influencers },
                  { label: 'Kierownik Planu',   field: 'assignedKierownikId',   options: kierownicy },
                  { label: 'Operator',          field: 'assignedOperatorId',    options: users.filter(u => u.role === 'operator') },
                  { label: 'Montażysta',        field: 'assignedEditorId',      options: editors },
                  { label: 'Publikator',        field: 'assignedPublikatorId',  options: users.filter(u => u.role === 'publikator') },
                ] as const).map(({ label, field, options }) => (
                  <div key={field} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                    <Select
                      value={(project as unknown as Record<string, unknown>)[field] as string || 'none'}
                      onValueChange={v => assignToProject(project.id, field, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="h-8 text-xs font-medium w-full">
                        <SelectValue placeholder="— Brak —" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="none">— Brak —</SelectItem>
                        {(options as { id: string; name: string }[]).map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Menu */}
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover z-50">
                    <DropdownMenuItem onClick={() => toggleFreezeProject(project.id)}>
                      <Snowflake className="mr-2 h-4 w-4" />{isFrozen ? 'Odmroź' : 'Zamroź'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setDeleteConfirm(project.id); }}>
                      <Trash2 className="mr-2 h-4 w-4" />Usuń pomysł
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>

        {/* Admin Tasks Panel */}
        {!readOnly && adminTasks.length > 0 && (
          <div className="rounded-xl border border-border border-b bg-primary/5 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Zadania Admina</span>
              {blockingAdminTasks.length > 0 && <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs animate-pulse">{blockingAdminTasks.length} blokuje proces!</Badge>}
              {blockingAdminTasks.length === 0 && adminTasks.filter(t => isAdminTaskActionable(t)).length > 0 && <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">{adminTasks.filter(t => isAdminTaskActionable(t)).length} do zrobienia</Badge>}
              {adminTasks.filter(t => isAdminTaskActionable(t)).length === 0 && <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">Wszystko gotowe ✓</Badge>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {adminTasks.map(task => {
                const actionable = isAdminTaskActionable(task);
                const done = isAdminTaskDone(task);
                const blocking = isAdminTaskBlocking(task);
                // Filming date is always accessible to admin, regardless of pipeline status
                const isFilmingTask = task.title === 'Ustaw termin planu zdjęciowego';
                const alwaysActionable = actionable || isFilmingTask;
                return (
                  <div key={task.id} className={cn("flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    blocking && "border-destructive/60 bg-destructive/10 shadow-md ring-1 ring-destructive/20",
                    !blocking && alwaysActionable && !done && "border-primary/40 bg-primary/10 shadow-sm",
                    done && "border-success/40 bg-success/10",
                    !alwaysActionable && !done && !blocking && "border-border bg-card opacity-60")}>
                    {done ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> :
                     blocking ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0 animate-pulse" /> :
                     alwaysActionable ? <Circle className="h-4 w-4 text-primary shrink-0 animate-pulse" /> :
                     <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-xs font-medium truncate", blocking ? "text-destructive" : "text-foreground")}>
                        {task.order + 1}. {task.title}
                        {blocking && <span className="ml-1 text-[10px] font-bold">(Proces czeka!)</span>}
                      </div>
                      <div className="mt-1">{(alwaysActionable || done) && renderAdminAction(task)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Source idea (if project came from campaign) */}
        {(() => {
          const sourceIdea = ideas.find(i => i.resultingProjectId === project.id);
          if (!sourceIdea) return null;
          return (
            <div className="rounded-xl border border-border bg-muted/20 shadow-sm p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold text-foreground">Źródłowy pomysł</span>
                <Badge variant="secondary" className="border-0 bg-success/10 text-success text-xs">Zaakceptowany</Badge>
              </div>
              <p className="font-medium text-sm">{sourceIdea.title}</p>
              {sourceIdea.description && <p className="text-sm text-muted-foreground mt-1">{sourceIdea.description}</p>}
              {sourceIdea.clientNotes && <p className="text-xs text-muted-foreground mt-1 italic">Uwagi klienta: „{sourceIdea.clientNotes}"</p>}
            </div>
          );
        })()}

        {/* Pipeline table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Etap</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rola</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kiedy</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Szczegóły</th>
              </tr>
            </thead>
            <tbody>
              {projectTasks.map(task => {
                const isAdminTask = task.assignedRoles.includes('admin');
                const adminActionable = isAdminTask && isAdminTaskActionable(task);
                const adminDone = isAdminTask && isAdminTaskDone(task);
                const adminBlocking = isAdminTask && isAdminTaskBlocking(task);
                return (
                  <tr key={task.id} className={cn("border-b border-border last:border-0",
                    !isAdminTask && task.status === 'locked' && 'opacity-40',
                    adminBlocking && 'bg-destructive/5 border-l-2 border-l-destructive',
                    !adminBlocking && adminActionable && 'bg-primary/5 border-l-2 border-l-primary',
                    adminDone && 'bg-success/5 border-l-2 border-l-success')}>
                    <td className="flex items-center gap-2 px-4 py-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{task.order + 1}.</span>
                      {isAdminTask ? (adminDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : adminBlocking ? <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" /> : adminActionable ? <Circle className="h-4 w-4 text-primary" /> : statusIcon(task.status)) : statusIcon(task.status)}
                      <span className={cn("font-medium", adminBlocking && "text-destructive font-semibold", !adminBlocking && adminActionable && "text-primary", adminDone && "text-success", !isAdminTask && "text-foreground")}>{task.title}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-1">
                        {task.assignedRoles.map(r => {
                          const person = getPersonForRole(r, task.projectId);
                          return (
                            <div key={r} className="flex flex-col gap-0.5">
                              <Badge variant="secondary" className={`${ROLE_COLORS[r]} border-0 text-xs w-fit`}>{ROLE_LABELS[r]}</Badge>
                              {person && <span className="text-[11px] text-muted-foreground pl-0.5">{person}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {isAdminTask ? (adminDone ? <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">Gotowe</Badge> : adminBlocking ? <Badge variant="destructive" className="border-0 text-xs animate-pulse">Proces czeka!</Badge> : adminActionable ? <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">Do zrobienia</Badge> : statusBadge(task.status)) : statusBadge(task.status)}
                    </td>
                    <td className="px-4 py-2.5">{renderSlaColumn(task)}</td>
                    <td className="px-4 py-2.5">{renderValueColumn(task)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- VIEW 0: Kampanie ---
  const renderCampaignsView = () => {
    const getSlaRemaining = (campaign: typeof campaigns[0]) => {
      const deadline = new Date(campaign.createdAt).getTime() + campaign.slaHours * 3600000;
      return deadline - Date.now();
    };

    const getCampaignIdeas = (campaignId: string) => ideas.filter(i => i.campaignId === campaignId);
    const getCampaignClient = (campaign: typeof campaigns[0]) => clients.find(c => c.id === campaign.clientId);
    const getCampaignInfluencer = (campaign: typeof campaigns[0]) => users.find(u => u.id === campaign.assignedInfluencerId);

    if (campaigns.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground opacity-40" />
          <p className="text-lg font-semibold text-foreground">Brak kampanii</p>
          <p className="text-sm text-muted-foreground">Utwórz kampanię, aby zlecić influencerowi przygotowanie pomysłów.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {campaigns.map(campaign => {
          const client = getCampaignClient(campaign);
          const influencer = getCampaignInfluencer(campaign);
          const campaignIdeas = getCampaignIdeas(campaign.id);
          const pendingCount = campaignIdeas.filter(i => i.status === 'pending').length;
          const acceptedCount = campaignIdeas.filter(i => i.status === 'accepted' || i.status === 'accepted_with_notes').length;
          const msTilDeadline = getSlaRemaining(campaign);
          const hoursLeft = Math.floor(Math.abs(msTilDeadline) / 3600000);
          const minutesLeft = Math.floor((Math.abs(msTilDeadline) % 3600000) / 60000);
          const isOverdue = msTilDeadline < 0;
          const isExpanded = expandedCampaignId === campaign.id;
          const clientUsersForCampaign = users.filter(u => u.role === 'klient' && u.clientId === campaign.clientId);
          const currentReviewer = users.find(u => u.id === campaign.assignedClientUserId);

          return (
            <div key={campaign.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Campaign header */}
              <div className="px-4 py-4 md:px-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground">{client?.companyName || 'Nieznany klient'}</h3>
                      <Badge variant="secondary" className={`border-0 text-xs ${campaign.status === 'awaiting_ideas' ? 'bg-warning/10 text-warning' : campaign.status === 'in_review' ? 'bg-primary/10 text-primary' : campaign.status === 'completed' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {campaign.status === 'awaiting_ideas' ? 'Oczekuje na pomysły' :
                         campaign.status === 'in_review' ? 'Klient ocenia' :
                         campaign.status === 'completed' ? 'Zakończona' : 'Anulowana'}
                      </Badge>
                      {!campaign.assignedClientUserId && pendingCount > 0 && (
                        <Badge variant="secondary" className="border-0 text-xs bg-destructive/10 text-destructive animate-pulse">
                          Brak oceniającego — ustaw poniżej
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {influencer?.name || 'Brak influencera'}
                      </span>
                      {client?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {client.phone}
                        </span>
                      )}
                    </div>
                    {/* Reviewer selector */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Oceniający:</span>
                      {clientUsersForCampaign.length > 0 ? (
                        <Select
                          value={campaign.assignedClientUserId || 'none'}
                          onValueChange={v => updateCampaign(campaign.id, { assignedClientUserId: v === 'none' ? null : v })}
                        >
                          <SelectTrigger className="h-6 text-xs border-0 bg-transparent px-1.5 py-0 shadow-none hover:bg-muted/50 focus:ring-0 w-auto gap-1 text-foreground font-medium">
                            <SelectValue placeholder="— admin —" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="none" className="text-xs">— Ocenia admin —</SelectItem>
                            {clientUsersForCampaign.map(u => (
                              <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">admin (brak kont klienta)</span>
                      )}
                    </div>
                    {campaign.briefNotes && (
                      <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">Brief: {campaign.briefNotes}</p>
                    )}
                  </div>

                  <div className="flex gap-3 items-start shrink-0">
                    {/* SLA countdown */}
                    <div className={`text-center rounded-lg border px-3 py-1.5 ${isOverdue ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30'}`}>
                      <div className={`text-sm font-bold tabular-nums ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                        {isOverdue ? '−' : ''}{String(hoursLeft).padStart(2, '0')}h {String(minutesLeft).padStart(2, '0')}m
                      </div>
                      <div className="text-[10px] text-muted-foreground">{isOverdue ? 'po terminie' : 'pozostało'}</div>
                    </div>

                    {/* Idea count */}
                    <div className="text-center rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                      <div className="text-sm font-bold tabular-nums text-foreground">
                        {campaignIdeas.length}/{campaign.targetIdeaCount}
                      </div>
                      <div className="text-[10px] text-muted-foreground">pomysłów</div>
                    </div>

                    {/* Expand button */}
                    <Button
                      variant="ghost" size="sm" className="h-8 text-xs gap-1"
                      onClick={() => setExpandedCampaignId(isExpanded ? null : campaign.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {isExpanded ? 'Zwiń' : 'Pomysły'}
                    </Button>

                    {/* Status change */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover z-50">
                        <DropdownMenuItem onClick={() => updateCampaign(campaign.id, { status: 'awaiting_ideas' })}>Oczekuje na pomysły</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateCampaign(campaign.id, { status: 'in_review' })}>Klient ocenia</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateCampaign(campaign.id, { status: 'completed' })}>Zakończona</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteCampaignConfirm(campaign.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Usuń kampanię
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Progress bar for ideas */}
                <div className="mt-3 space-y-1">
                  <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (campaignIdeas.length / campaign.targetIdeaCount) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{pendingCount > 0 ? `${pendingCount} oczekuje na ocenę klienta` : acceptedCount > 0 ? `${acceptedCount} zaakceptowanych → stało się pomysłami` : 'Brak pomysłów'}</span>
                    <span>{campaignIdeas.length} z {campaign.targetIdeaCount}</span>
                  </div>
                </div>
              </div>

              {/* Expanded ideas panel */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-4 md:px-6 bg-muted/10">
                  <IdeasPanel campaignId={campaign.id} role="admin" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // --- VIEW 1: Moje Zadania ---
  const renderTasksView = () => {
    // Helper: filming urgency for a given project
    const getFilmingUrgency = (project: typeof projects[0]) => {
      const projectTasks = getTasksForProject(project.id);
      const isComplete = projectTasks.length > 0 && projectTasks.every(t => t.status === 'done');
      const filmingTask = projectTasks.find(t => t.title === 'Ustaw termin planu zdjęciowego');
      if (!filmingTask) return 'none' as const;
      if (filmingTask.value) return 'set' as const;
      const activeTask = projectTasks.find(t =>
        t.status === 'todo' || t.status === 'pending_client_approval' || t.status === 'needs_influencer_revision'
      );
      const activeOrder = activeTask?.order ?? -1;
      if (!isComplete && activeOrder >= 7) return 'required' as const;
      if (!isComplete && activeOrder >= 5) return 'soon' as const;
      return 'none' as const;
    };

    const projectsWithWork = projects.filter(project => {
      const adminTasks = getAdminTasksForProject(project.id);
      if (adminTasks.some(t => isAdminTaskActionable(t))) return true;
      const urgency = getFilmingUrgency(project);
      return urgency === 'required' || urgency === 'soon';
    });

    // Campaigns where admin is the reviewer (no client reviewer assigned) and there are pending ideas
    const reviewerCampaigns = campaigns.filter(c => {
      if (c.assignedClientUserId) return false;
      if (c.status !== 'awaiting_ideas' && c.status !== 'in_review') return false;
      return ideas.some(i => i.campaignId === c.id && i.status === 'pending');
    });

    if (projectsWithWork.length === 0 && reviewerCampaigns.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-success opacity-60" />
          <p className="text-lg font-semibold text-success">Wszystko gotowe ✓</p>
          <p className="text-sm text-muted-foreground">Brak oczekujących zadań admina.</p>
        </div>
      );
    }

    const groups = getProjectGroups(projectsWithWork);

    // Render "Pomysły do oceny" section (when admin acts as reviewer)
    const renderReviewerSection = () => {
      if (reviewerCampaigns.length === 0) return null;
      const totalPending = reviewerCampaigns.reduce((sum, c) =>
        sum + ideas.filter(i => i.campaignId === c.id && i.status === 'pending').length, 0);
      return (
        <div className="rounded-xl border border-warning/40 bg-card shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-border bg-warning/5 rounded-t-xl">
            <Lightbulb className="h-4 w-4 text-warning shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-foreground">Pomysły do oceny</span>
              <span className="text-xs text-muted-foreground ml-2">
                Oceniasz jako admin — w tych kampaniach nie wyznaczono osoby z klienta.
              </span>
            </div>
            <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs shrink-0">
              {totalPending} do oceny
            </Badge>
          </div>
          <div className="divide-y divide-border">
            {reviewerCampaigns.map(campaign => {
              const campClient = clients.find(c => c.id === campaign.clientId);
              return (
                <div key={campaign.id} className="px-4 py-3 md:px-6 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{campClient?.companyName || 'Nieznany klient'}</span>
                    <Badge variant="secondary" className="bg-warning/10 text-warning border-0 text-[10px]">
                      {campaign.status === 'awaiting_ideas' ? 'Oczekuje na pomysły' : 'Klient ocenia'}
                    </Badge>
                  </div>
                  <IdeasPanel campaignId={campaign.id} role="admin" />
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {renderReviewerSection()}
        {groups.map(group => {
          const groupAdminTaskCount = group.projects.reduce((sum, project) => {
            const adminTasks = getAdminTasksForProject(project.id);
            const regularCount = adminTasks.filter(t => isAdminTaskActionable(t)).length;
            const urgency = getFilmingUrgency(project);
            const hasFilmingCard = (urgency === 'required' || urgency === 'soon')
              && !adminTasks.filter(t => isAdminTaskActionable(t)).some(t => t.title === 'Ustaw termin planu zdjęciowego');
            return sum + regularCount + (hasFilmingCard ? 1 : 0);
          }, 0);

          return (
            <div key={group.key} className="rounded-xl border border-border bg-card shadow-sm">
              {/* Client section header */}
              <div className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-border bg-muted/20 rounded-t-xl">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground">{group.label}</span>
                  {group.client && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {group.client.contactName}
                      {group.client.phone ? ` · ${group.client.phone}` : ''}
                    </span>
                  )}
                </div>
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0 text-xs shrink-0">
                  {groupAdminTaskCount} do zrobienia
                </Badge>
              </div>

              {/* Projects within this client group */}
              <div className="divide-y divide-border">
                {group.projects.map(project => {
                  const adminTasks = getAdminTasksForProject(project.id);
                  const pendingTasks = adminTasks.filter(t => isAdminTaskActionable(t));
                  const filmingUrgency = getFilmingUrgency(project);
                  // Show filming card only if not already covered by a regular pending task
                  const showFilmingCard = (filmingUrgency === 'required' || filmingUrgency === 'soon')
                    && !pendingTasks.some(t => t.title === 'Ustaw termin planu zdjęciowego');
                  const hasBlocking = pendingTasks.some(t => isAdminTaskBlocking(t)) || filmingUrgency === 'required';

                  const projectTasks = getTasksForProject(project.id);
                  const filmingTask = projectTasks.find(t => t.title === 'Ustaw termin planu zdjęciowego');
                  const filmingDateParsed = filmingTask?.value ? new Date(filmingTask.value) : null;

                  return (
                    <div key={project.id} className="px-4 py-3 md:px-6">
                      <div className="mb-2">
                        <span className={cn("font-medium text-sm cursor-pointer hover:underline", hasBlocking ? "text-destructive" : "text-primary")}
                          onClick={() => navigateToProject(project.id)}>
                          {project.name}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
                        {hasBlocking && (
                          <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-0 text-xs animate-pulse">
                            blokuje!
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {pendingTasks.map(task => {
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

                        {/* Filming date card — controlled Popover to preserve open state across re-renders */}
                        {showFilmingCard && filmingTask && (() => {
                          const ftId = filmingTask.id;
                          const setup = filmingSetup[ftId];
                          const isPast = setup ? (() => { const t = new Date(); t.setHours(0,0,0,0); return setup.date < t; })() : false;
                          const isOpen = filmingDateOpen[project.id] ?? false;
                          return (
                            <div className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                              filmingUrgency === 'required'
                                ? "border-destructive/60 bg-destructive/10 shadow-md ring-1 ring-destructive/20"
                                : "border-warning/60 bg-warning/10 shadow-sm"
                            )}>
                              {filmingUrgency === 'required' ? (
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 animate-pulse" />
                              ) : (
                                <CalendarClock className="h-4 w-4 text-warning shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className={cn("text-xs font-medium truncate mb-1", filmingUrgency === 'required' ? "text-destructive" : "text-warning")}>
                                  Ustaw termin nagrania
                                  {filmingUrgency === 'required' && <span className="ml-1 text-[10px] font-bold">(Warto ustalić!)</span>}
                                </div>
                                <Popover
                                  open={isOpen}
                                  onOpenChange={open => {
                                    setFilmingDateOpen(prev => ({ ...prev, [project.id]: open }));
                                    if (!open) setFilmingSetup(prev => { const n = { ...prev }; delete n[ftId]; return n; });
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button size="sm" variant="default" className="h-7 gap-1 text-xs">
                                      <CalendarClock className="h-3 w-3" />
                                      Wybierz datę
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    {!setup ? (
                                      <Calendar
                                        mode="single"
                                        selected={undefined}
                                        onSelect={date => {
                                          if (date) {
                                            const pendingIds = tasks
                                              .filter(t => {
                                                if (t.title !== 'Ustaw termin planu zdjęciowego' || t.value) return false;
                                                const relatedProject = projects.find(p => p.id === t.projectId);
                                                return relatedProject?.clientId === project.clientId;
                                              })
                                              .map(t => t.projectId);
                                            setFilmingSetup(prev => ({
                                              ...prev,
                                              [ftId]: {
                                                date,
                                                kierownikId: project.assignedKierownikId ?? '',
                                                operatorId: project.assignedOperatorId ?? '',
                                                selectedProjectIds: pendingIds,
                                              },
                                            }));
                                          }
                                        }}
                                        disabled={(date) => { const t = new Date(); t.setHours(0, 0, 0, 0); return date < t; }}
                                        locale={pl}
                                        initialFocus
                                        className={cn('p-3 pointer-events-auto')}
                                      />
                                    ) : (
                                      <div className="p-4 w-72 space-y-4 pointer-events-auto">
                                        <div className="flex items-center gap-2">
                                          <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                                          <span className="text-sm font-semibold text-foreground">
                                            {format(setup.date, 'EEEE, dd.MM.yyyy', { locale: pl })}
                                          </span>
                                          <button
                                            type="button"
                                            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
                                            onClick={() => setFilmingSetup(prev => { const n = { ...prev }; delete n[ftId]; return n; })}
                                          >
                                            Zmień datę
                                          </button>
                                        </div>
                                        {/* KP selector */}
                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kierownik Planu</label>
                                          <Select
                                            value={setup.kierownikId || 'none'}
                                            onValueChange={v => setFilmingSetup(prev => ({ ...prev, [ftId]: { ...prev[ftId], kierownikId: v === 'none' ? '' : v } }))}
                                          >
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                                            <SelectContent className="bg-popover z-50">
                                              <SelectItem value="none">— Brak —</SelectItem>
                                              {kierownicy.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        {/* Operator selector */}
                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Operator</label>
                                          <Select
                                            value={setup.operatorId || 'none'}
                                            onValueChange={v => setFilmingSetup(prev => ({ ...prev, [ftId]: { ...prev[ftId], operatorId: v === 'none' ? '' : v } }))}
                                          >
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                                            <SelectContent className="bg-popover z-50">
                                              <SelectItem value="none">— Brak —</SelectItem>
                                              {users.filter(u => u.role === 'operator').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        {/* Project selection */}
                                        {(() => {
                                          const allClientFilmingIds = tasks
                                            .filter(t => {
                                              if (t.title !== 'Ustaw termin planu zdjęciowego') return false;
                                              const relatedProject = projects.find(p => p.id === t.projectId);
                                              return relatedProject?.clientId === project.clientId;
                                            })
                                            .map(t => t.projectId)
                                            .filter((id, i, a) => a.indexOf(id) === i);
                                          if (!allClientFilmingIds.length) return null;
                                          return (
                                            <div className="space-y-1.5">
                                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pomysły w tej sesji</label>
                                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                                {allClientFilmingIds.map(projId => {
                                                  const proj = projects.find(p => p.id === projId);
                                                  if (!proj) return null;
                                                  const isChecked = setup.selectedProjectIds.includes(projId);
                                                  return (
                                                    <label key={projId} className="flex items-center gap-2 cursor-pointer">
                                                      <input type="checkbox" className="rounded" checked={isChecked}
                                                        onChange={e => setFilmingSetup(prev => ({
                                                          ...prev,
                                                          [ftId]: {
                                                            ...prev[ftId],
                                                            selectedProjectIds: e.target.checked
                                                              ? [...prev[ftId].selectedProjectIds, projId]
                                                              : prev[ftId].selectedProjectIds.filter(id => id !== projId),
                                                          },
                                                        }))}
                                                      />
                                                      <span className="text-xs truncate">{proj.name}</span>
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                        <div className="flex gap-2 pt-1">
                                          <Button size="sm" className="flex-1" disabled={!setup.selectedProjectIds?.length}
                                            onClick={() => {
                                              setup.selectedProjectIds.forEach(projId => {
                                                if (setup.kierownikId) assignToProject(projId, 'assignedKierownikId', setup.kierownikId);
                                                if (setup.operatorId) assignToProject(projId, 'assignedOperatorId', setup.operatorId);
                                                setFilmingDate(projId, setup.date.toISOString());
                                              });
                                              setFilmingSetup(prev => { const n = { ...prev }; delete n[ftId]; return n; });
                                              setFilmingDateOpen(prev => ({ ...prev, [project.id]: false }));
                                            }}
                                          >
                                            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                                            Zatwierdź termin
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- VIEW 2: Widok Klienta ---
  const renderClientView = () => {
    const selectedClient = clients.find(c => c.id === clientViewId) || null;
    const clientProjects = clientViewId
      ? projects.filter(p => {
          if (p.clientId === clientViewId) return true;
          // Legacy: project has no clientId but company name matches
          if (!p.clientId && selectedClient && p.company === selectedClient.companyName) return true;
          return false;
        })
      : [];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="client-select" className="text-sm font-medium whitespace-nowrap">Wybierz klienta:</Label>
          <Select value={clientViewId} onValueChange={setClientViewId}>
            <SelectTrigger id="client-select" className="h-9 w-72 text-sm">
              <SelectValue placeholder="— Wybierz klienta —" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.companyName} — {c.contactName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!clientViewId && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Wybierz klienta, aby zobaczyć jego pomysły.</p>
          </div>
        )}

        {selectedClient && (
          <>
            {/* Client info card */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-xl font-bold text-foreground">{selectedClient.companyName}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedClient.contactName}</p>
                  {selectedClient.email && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{selectedClient.email}</span>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{selectedClient.phone}</span>
                    </div>
                  )}
                  {selectedClient.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{selectedClient.notes}</p>
                  )}
                </div>
                <div className="flex gap-4 shrink-0">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{clientProjects.length}</div>
                    <div className="text-xs text-muted-foreground">Pomysłów</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {clientProjects.filter(p => p.status !== 'frozen' && !getTasksForProject(p.id).every(t => t.status === 'done')).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Aktywnych</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {clientProjects.filter(p => {
                        const pt = getTasksForProject(p.id);
                        return pt.length > 0 && pt.every(t => t.status === 'done');
                      }).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Ukończonych</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Projects grid */}
            {clientProjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Brak pomysłów dla tego klienta.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {clientProjects.map(project => {
                  const projectTasks = getTasksForProject(project.id);
                  const doneTasks = projectTasks.filter(t => t.status === 'done' || isAdminTaskDone(t)).length;
                  const total = projectTasks.length;
                  const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0;
                  const isFrozen = project.status === 'frozen';
                  const isComplete = total > 0 && projectTasks.every(t => t.status === 'done');
                  const adminTasks = getAdminTasksForProject(project.id);
                  const pendingAdminCount = adminTasks.filter(t => isAdminTaskActionable(t)).length;

                  // Active stage: first task with active status (or blocked by final rejection)
                  const rejectedFinalTask = projectTasks.find(t => t.status === 'rejected_final');
                  const activeTask = rejectedFinalTask ?? projectTasks.find(t =>
                    t.status === 'todo' || t.status === 'pending_client_approval' || t.status === 'needs_influencer_revision'
                  );

                  const cardBorder = isComplete
                    ? 'border-success bg-success/5'
                    : !!rejectedFinalTask
                    ? 'border-destructive/60 bg-destructive/5'
                    : pendingAdminCount > 0
                    ? 'border-destructive/50 bg-destructive/5'
                    : isFrozen
                    ? 'border-muted bg-muted/10 opacity-60'
                    : 'border-border bg-card';

                  return (
                    <div
                      key={project.id}
                      className={`rounded-xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${cardBorder}`}
                      onClick={() => navigateToProject(project.id)}
                    >
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground leading-tight">{project.name}</h3>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className={rejectedFinalTask ? 'text-destructive font-medium' : ''}>
                              {rejectedFinalTask ? `⛔ Odrzucono: ${rejectedFinalTask.title}` : activeTask ? activeTask.title : isComplete ? 'Ukończony' : 'Brak aktywnego etapu'}
                            </span>
                            <span>{doneTasks}/{total}</span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1">
                          {project.priority && project.priority !== 'medium' && (
                            <Badge variant="secondary" className={`${PRIORITY_COLORS[project.priority]} border-0 text-xs gap-1`}>
                              <Flag className="h-3 w-3" />
                              {PRIORITY_LABELS[project.priority]}
                            </Badge>
                          )}
                          {isFrozen && (
                            <Badge variant="secondary" className="gap-1 border-0 bg-muted text-muted-foreground text-xs">
                              <Snowflake className="h-3 w-3" />
                              Zamrożony
                            </Badge>
                          )}
                          {isComplete && (
                            <Badge variant="secondary" className="gap-1 border-0 bg-success/15 text-success text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              Ukończony
                            </Badge>
                          )}
                          {!isComplete && pendingAdminCount > 0 && (
                            <Badge variant="secondary" className="border-0 bg-destructive/10 text-destructive text-xs animate-pulse">
                              {pendingAdminCount} zadań admina czeka
                            </Badge>
                          )}
                        </div>

                        {project.publicationDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            <span>Publikacja: {format(new Date(project.publicationDate), 'dd.MM.yyyy', { locale: pl })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // --- VIEW 3: Opóźnienia ---
  const renderDelaysView = () => {
    const overdueTasks: Array<{ task: typeof tasks[0]; project: typeof projects[0]; elapsed: number }> = [];

    for (const task of tasks) {
      const isActive = task.status === 'todo' || task.status === 'pending_client_approval' || task.status === 'needs_influencer_revision';
      if (!isActive || !task.assignedAt) continue;

      const project = projects.find(p => p.id === task.projectId);
      if (!project) continue;

      const SLA_MS = project.slaHours ? project.slaHours * 3600000 : DEFAULT_SLA_MS;
      const elapsed = Date.now() - new Date(task.assignedAt).getTime();

      if (elapsed > SLA_MS) {
        overdueTasks.push({ task, project, elapsed });
      }
    }

    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground italic">
          Widok w przygotowaniu — szczegóły opóźnień zostaną rozbudowane.
        </p>

        {overdueTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-success opacity-60" />
            <p className="text-lg font-semibold text-success">Brak opóźnień ✓</p>
            <p className="text-sm text-muted-foreground">Wszystkie aktywne zadania są w terminie.</p>
          </div>
        ) : (
          (() => {
            // Group overdue tasks by client
            const overdueProjects = Array.from(new Set(overdueTasks.map(o => o.project)));
            const groups = getProjectGroups(overdueProjects);

            return (
              <div className="space-y-4">
                {groups.map(group => {
                  const groupOverdue = overdueTasks.filter(o => group.projects.some(p => p.id === o.project.id));
                  return (
                    <div key={group.key} className="rounded-xl border border-destructive/30 bg-card shadow-sm">
                      <div className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-border bg-muted/20 rounded-t-xl">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground">{group.label}</span>
                        {group.client && (
                          <span className="text-xs text-muted-foreground">
                            {group.client.contactName}
                            {group.client.phone ? ` · ${group.client.phone}` : ''}
                          </span>
                        )}
                        <Badge variant="secondary" className="ml-auto bg-destructive/10 text-destructive border-0 text-xs">
                          {groupOverdue.length} opóźnionych
                        </Badge>
                      </div>
                      <div className="divide-y divide-border">
                        {groupOverdue.map(({ task, project, elapsed }) => {
                          const SLA_MS = project.slaHours ? project.slaHours * 3600000 : DEFAULT_SLA_MS;
                          const overdueBy = elapsed - SLA_MS;
                          return (
                            <div key={task.id} className="flex items-center gap-4 px-4 py-3 md:px-6">
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{task.title}</div>
                                <div className="text-xs text-muted-foreground">{project.name} · {group.label}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex gap-1 flex-wrap justify-end">
                                  {task.assignedRoles.map(r => (
                                    <Badge key={r} variant="secondary" className={`${ROLE_COLORS[r]} border-0 text-xs`}>
                                      {ROLE_LABELS[r]}
                                    </Badge>
                                  ))}
                                </div>
                                <span className="text-xs font-medium text-destructive whitespace-nowrap">
                                  +{formatDurationFromMs(overdueBy)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    );
  };

  // --- VIEW 4: Wszystkie pomysły ---
  const renderDetailsView = () => {
    const groups = getProjectGroups(filteredProjects);

    const allVisibleIds = filteredProjects.map(p => p.id);
    const allSelected = bulkSelectMode && allVisibleIds.length > 0 && allVisibleIds.every(id => bulkSelected.has(id));

    return (
      <div className="space-y-4">
        {/* Client filter bar (moved inside this view) */}
        {!readOnly && clients.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Filtruj po kliencie:</span>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-7 w-52 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">— Wszyscy klienci —</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.companyName} — {c.contactName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setClientFilter('all')}>
                Wyczyść
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{filteredProjects.length} pomysł{filteredProjects.length === 1 ? '' : filteredProjects.length < 5 ? 'y' : 'ów'}</span>
          </div>
        )}

        {/* Bulk-select toolbar */}
        {!readOnly && filteredProjects.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
            {!bulkSelectMode ? (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setBulkSelectMode(true)}>
                <Check className="h-3.5 w-3.5" />
                Zaznacz wiele
              </Button>
            ) : (
              <>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={checked => {
                    if (checked) setBulkSelected(new Set(allVisibleIds));
                    else setBulkSelected(new Set());
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  Zaznaczono: <span className="font-semibold text-foreground">{bulkSelected.size}</span>
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exitBulkMode}>
                    Anuluj
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={bulkSelected.size === 0}
                    onClick={() => setBulkDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Usuń zaznaczone ({bulkSelected.size})
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Projects grouped by client */}
        {groups.map((group, groupIdx) => (
          <div key={group.key}>
            {/* Group divider/header */}
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-bold text-foreground">{group.label}</span>
              {group.client && (
                <span className="text-xs text-muted-foreground">
                  {group.client.contactName}
                  {group.client.phone ? ` · ${group.client.phone}` : ''}
                </span>
              )}
              <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground text-xs">
                {group.projects.length} pomysł{group.projects.length === 1 ? '' : group.projects.length < 5 ? 'y' : 'ów'}
              </Badge>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Projects in this group */}
            {group.projects.map(project => {
              if (bulkSelectMode) {
                const checked = bulkSelected.has(project.id);
                return (
                  <div
                    key={project.id}
                    className={cn(
                      "mb-3 flex items-start gap-3 rounded-xl border p-2 transition-colors cursor-pointer",
                      checked ? "border-primary/60 bg-primary/5" : "border-transparent hover:bg-muted/30"
                    )}
                    onClick={() => toggleBulkSelected(project.id)}
                  >
                    <div className="pt-4 pl-1" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleBulkSelected(project.id)} />
                    </div>
                    <div className="flex-1 min-w-0 pointer-events-none">
                      {renderProjectSummaryCard(project, () => {})}
                    </div>
                  </div>
                );
              }
              return renderProjectSummaryCard(project, () => navigateToProject(project.id));
            })}

            {/* Spacer between groups */}
            {groupIdx < groups.length - 1 && <div className="mb-4" />}
          </div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <LayoutList className="h-10 w-10 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground text-sm">Brak projektów do wyświetlenia.</p>
          </div>
        )}
      </div>
    );
  };

  // --- Main render ---
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <img src="/images/yads-logo.png" alt="YADS" className="h-8 w-auto rounded" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">{roleLabel}</h1>
            <p className="text-xs text-muted-foreground">{roleSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && <IdeasBankDialog />}
          {!readOnly && <ClientManagementDialog />}
          {!readOnly && <TeamManagementDialog />}
          {!readOnly && <AddCampaignDialog onCreated={() => setActiveView('campaigns')} />}
          <span className="hidden text-sm text-muted-foreground sm:inline">{currentUser.name}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentUser(null)} title="Zmień użytkownika">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Tab bar — hidden in readOnly mode */}
      {!readOnly && (
        <div className="border-b border-border bg-background px-4 md:px-6">
          {activeView === 'project' ? (
            <div className="flex items-center gap-2 py-2">
              <Button variant="ghost" size="sm" className="gap-1.5 text-sm" onClick={navigateBack}>
                <ChevronLeft className="h-4 w-4" />
                {previousView === 'campaigns' ? 'Kampanie' :
                 previousView === 'client' ? 'Widok Klienta' :
                 previousView === 'tasks' ? 'Moje Zadania' :
                 previousView === 'delays' ? 'Opóźnienia' : 'Wszystkie pomysły'}
              </Button>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-sm font-medium text-foreground truncate">
                {projects.find(p => p.id === selectedProjectId)?.name || ''}
              </span>
            </div>
          ) : (
            <div className="flex gap-1 py-1">
              {(() => {
                const activeProjectIds = new Set(projects.filter(p => p.status === 'active').map(p => p.id));
                const adminTasksAll = tasks.filter(t => t.assignedRoles.includes('admin') && activeProjectIds.has(t.projectId));
                const adminBlockingCount = adminTasksAll.filter(t => isAdminTaskBlocking(t)).length;
                const adminActionableCount = adminTasksAll.filter(t => isAdminTaskActionable(t)).length;
                const adminReviewerIdeasCount = ideas.filter(i => {
                  if (i.status !== 'pending') return false;
                  const camp = campaigns.find(c => c.id === i.campaignId);
                  return !!camp && !camp.assignedClientUserId
                    && (camp.status === 'awaiting_ideas' || camp.status === 'in_review');
                }).length;
                const tasksBadgeCount = adminActionableCount + adminReviewerIdeasCount;
                const tasksHasBlocking = adminBlockingCount > 0;

                return VIEWS.filter(v => v.id !== 'project').map(v => {
                  let badgeCount = 0;
                  let badgeBlocking = false;
                  if (v.id === 'tasks') {
                    badgeCount = tasksBadgeCount;
                    badgeBlocking = tasksHasBlocking;
                  } else if (v.id === 'details') {
                    badgeCount = adminBlockingCount;
                    badgeBlocking = adminBlockingCount > 0;
                  }
                  return (
                    <button
                      key={v.id}
                      onClick={() => setActiveView(v.id)}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
                        ${activeView === v.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                      <v.icon className="h-4 w-4" />
                      {v.label}
                      {badgeCount > 0 && (
                        <span
                          title={badgeBlocking ? `${badgeCount} zadań blokuje proces` : `${badgeCount} do zrobienia`}
                          className={`ml-0.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold min-w-[18px] h-[18px] px-1
                            ${activeView === v.id
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : badgeBlocking
                                ? 'bg-destructive text-destructive-foreground animate-pulse'
                                : 'bg-primary text-primary-foreground'}`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {readOnly ? (
          // readOnly: show only details view (all projects pipeline)
          renderDetailsView()
        ) : (
          <>
            {activeView === 'campaigns' && renderCampaignsView()}
            {activeView === 'tasks' && renderTasksView()}
            {activeView === 'client' && renderClientView()}
            {activeView === 'delays' && renderDelaysView()}
            {activeView === 'details' && renderDetailsView()}
            {activeView === 'project' && renderProjectView()}
          </>
        )}
      </div>

      {priorityDialogTask && (
        <PriorityAssignmentDialog
          task={priorityDialogTask}
          open={!!priorityDialogTask}
          onOpenChange={open => { if (!open) setPriorityDialogTask(null); }}
        />
      )}

      <AlertDialog open={!!deleteCampaignConfirm} onOpenChange={open => !open && setDeleteCampaignConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć kampanię?</AlertDialogTitle>
            <AlertDialogDescription>
              Kampania „{(campaigns.find(c => c.id === deleteCampaignConfirm) as { name?: string } | undefined)?.name || ''}" oraz wszystkie przypisane do niej pomysły zostaną trwale usunięte. Pomysłów utworzonych z tej kampanii to nie dotyczy. Tej akcji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteCampaignConfirm) { deleteCampaign(deleteCampaignConfirm); setDeleteCampaignConfirm(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń kampanię
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!readOnly && (
        <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Czy na pewno chcesz usunąć pomysł?</AlertDialogTitle>
              <AlertDialogDescription>
                Pomysł „{getDeleteProjectName()}" oraz wszystkie przypisane do niego zadania zostaną trwale usunięte. Tej akcji nie można cofnąć.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Usuń pomysł
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
};

export default AdminDashboard;
