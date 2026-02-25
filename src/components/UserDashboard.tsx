import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS } from '@/types';
import TaskCard from '@/components/TaskCard';
import { CheckCircle2, Circle, Lock, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const UserDashboard = () => {
  const { currentUser, setCurrentUser, tasks, projects } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!currentUser) return null;

  const myTasks = tasks.filter(t => t.assignedRole === currentUser.role && t.status !== 'locked');
  const todoTasks = myTasks.filter(t => t.status === 'todo');
  const doneTasks = myTasks.filter(t => t.status === 'done');
  const selectedTask = myTasks.find(t => t.id === selectedTaskId);
  const allDone = todoTasks.length === 0;

  const getProject = (projectId: string) => projects.find(p => p.id === projectId);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <div className="text-sm font-semibold text-foreground">{currentUser.name}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role]}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentUser(null)} title="Zmień użytkownika">
              <LogOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {todoTasks.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Do zrobienia ({todoTasks.length})
              </div>
              {todoTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => { setSelectedTaskId(task.id); setSidebarOpen(false); }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedTaskId === task.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <Circle className="h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1 truncate">
                    <div className="truncate font-medium">{task.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{getProject(task.projectId)?.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {doneTasks.length > 0 && (
            <div>
              <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Ukończone ({doneTasks.length})
              </div>
              {doneTasks.map(task => (
                <div key={task.id} className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col">
        <header className="flex items-center border-b border-border px-4 py-3 md:px-6">
          <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Moje zadania</h1>
        </header>

        <div className="flex flex-1 items-center justify-center p-4 md:p-8">
          {allDone ? (
            <div className="animate-fade-in text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Wszystko gotowe!</h2>
              <p className="mt-2 text-sm text-muted-foreground">Oczekuj na kolejne kroki od zespołu.</p>
            </div>
          ) : selectedTask ? (
            <div className="w-full max-w-lg">
              <TaskCard task={selectedTask} projectName={getProject(selectedTask.projectId)?.name || ''} />
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Wybierz zadanie z listy po lewej</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
