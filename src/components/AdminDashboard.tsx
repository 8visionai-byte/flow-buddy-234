import { useApp } from '@/context/AppContext';
import { PROJECTS } from '@/data/mockData';
import { ROLE_LABELS, ROLE_COLORS } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogOut, CheckCircle2, Circle, Lock } from 'lucide-react';

const AdminDashboard = () => {
  const { currentUser, setCurrentUser, tasks, projects } = useApp();

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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Panel Admina</h1>
          <p className="text-xs text-muted-foreground">Widok helikoptera — wszystkie projekty</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{currentUser.name}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentUser(null)} title="Zmień użytkownika">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {projects.map(project => {
          const projectTasks = getTasksForProject(project.id);
          return (
            <div key={project.id} className="mb-6 animate-fade-in rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3 md:px-6">
                <h2 className="font-semibold text-foreground">{project.name}</h2>
                <p className="text-xs text-muted-foreground">Klient: {project.clientName}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Etap</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rola</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
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
    </div>
  );
};

export default AdminDashboard;
