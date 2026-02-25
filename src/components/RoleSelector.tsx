import { useApp } from '@/context/AppContext';
import { ROLE_LABELS } from '@/types';
import { User, ChevronRight, Bell } from 'lucide-react';

const RoleSelector = () => {
  const { setCurrentUser, users, tasks, projects } = useApp();

  const activeProjectIds = projects.filter(p => p.status === 'active').map(p => p.id);

  const getAssignedProjectIds = (user: typeof users[0]) => {
    return projects.filter(p => {
      if (p.status !== 'active') return false;
      if (user.role === 'admin') return true;
      if (user.role === 'influencer') return p.assignedInfluencerId === user.id;
      if (user.role === 'montazysta') return p.assignedEditorId === user.id;
      if (user.role === 'klient') return p.assignedClientId === user.id;
      return true; // kierownik_planu sees all
    }).map(p => p.id);
  };

  const getActiveTaskCount = (user: typeof users[0]) => {
    const assignedProjectIds = getAssignedProjectIds(user);
    return tasks.filter(t =>
      assignedProjectIds.includes(t.projectId) &&
      t.assignedRoles.includes(user.role as any) &&
      (t.status === 'todo' || t.status === 'pending_client_approval' || t.status === 'needs_influencer_revision') &&
      !(t.assignedRoles.length > 1 && t.roleCompletions[user.role])
    ).length;
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Wybierz użytkownika</h1>
          <p className="mt-2 text-sm text-muted-foreground">Zaloguj się jako jedna z ról, aby zobaczyć odpowiedni widok</p>
        </div>

        <div className="space-y-2">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => setCurrentUser(user)}
              className="group flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-foreground">{user.name}</div>
                <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
              </div>
              {getActiveTaskCount(user) > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {getActiveTaskCount(user)}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoleSelector;
