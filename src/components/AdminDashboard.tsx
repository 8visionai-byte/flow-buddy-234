import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS, ROLE_COLORS } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogOut, CheckCircle2, Circle, Lock, MoreVertical, Snowflake, Trash2, Pencil } from 'lucide-react';
import AddProjectDialog from '@/components/AddProjectDialog';
import TeamManagementDialog from '@/components/TeamManagementDialog';
import SlaTimer from '@/components/SlaTimer';
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

const AdminDashboard = () => {
  const { currentUser, setCurrentUser, tasks, projects, users, deleteProject, toggleFreezeProject, assignToProject } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (!currentUser) return null;

  const getTasksForProject = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId).sort((a, b) => a.order - b.order);

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === 'todo') return <Circle className="h-4 w-4 text-primary" />;
    return <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />;
  };

  const statusBadge = (status: string) => {
    if (status === 'done') return <Badge variant="secondary" className="bg-success/10 text-success border-0 text-xs">Gotowe</Badge>;
    if (status === 'todo') return <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">Aktywne</Badge>;
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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Panel Admina</h1>
          <p className="text-xs text-muted-foreground">Widok helikoptera — wszystkie projekty</p>
        </div>
        <div className="flex items-center gap-2">
          <TeamManagementDialog />
          <AddProjectDialog />
          <span className="hidden text-sm text-muted-foreground sm:inline">{currentUser.name}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentUser(null)} title="Zmień użytkownika">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Projects */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
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
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* Inline assignment selects */}
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

                  {/* Actions dropdown */}
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
                        <td className="px-4 py-2.5">
                          {task.status === 'todo' ? (
                            <SlaTimer assignedAt={task.assignedAt} compact />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground capitalize">{task.inputType}</td>
                        <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                          {task.value || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
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
    </div>
  );
};

export default AdminDashboard;
