import { useApp } from '@/context/AppContext';
import { UserRole, ROLE_LABELS } from '@/types';
import { ChevronRight } from 'lucide-react';

const ROLE_GROUPS: { role: UserRole; label: string }[][] = [
  [{ role: 'admin', label: 'Admin' }],
  [{ role: 'klient', label: 'Klienci' }],
  [{ role: 'influencer', label: 'Influencerzy' }],
  [{ role: 'kierownik_planu', label: 'Kierownicy Planu' }],
  [{ role: 'operator', label: 'Operatorzy' }],
  [{ role: 'montazysta', label: 'Montażyści' }],
  [{ role: 'publikator', label: 'Publikatorzy' }],
];

const RoleSelector = () => {
  const { setCurrentUser, users, tasks, projects, campaigns, ideas } = useApp();

  const getAssignedProjectIds = (user: typeof users[0]) => {
    return projects.filter(p => {
      if (p.status !== 'active') return false;
      if (user.role === 'admin') return true;
      if (user.role === 'influencer') return p.assignedInfluencerId === user.id;
      if (user.role === 'montazysta') return p.assignedEditorId === user.id;
      if (user.role === 'klient') return p.assignedClientId === user.id;
      if (user.role === 'kierownik_planu') return p.assignedKierownikId === user.id;
      if (user.role === 'operator') return p.assignedOperatorId === user.id;
      if (user.role === 'publikator') return p.assignedPublikatorId === user.id;
      return false;
    }).map(p => p.id);
  };

  const getActiveTaskCount = (user: typeof users[0]) => {
    const assignedProjectIds = getAssignedProjectIds(user);
    const projectTaskCount = tasks.filter(t =>
      assignedProjectIds.includes(t.projectId) &&
      t.assignedRoles.includes(user.role as any) &&
      (t.status === 'todo' || t.status === 'pending_client_approval' || t.status === 'needs_influencer_revision') &&
      !(t.assignedRoles.length > 1 && t.roleCompletions[user.role])
    ).length;

    const campaignTaskCount = user.role === 'influencer'
      ? campaigns.filter(c => c.assignedInfluencerId === user.id && c.status === 'awaiting_ideas').length
      : 0;

    const clientReviewCount = user.role === 'klient'
      ? campaigns.filter(c => {
          if (c.assignedClientUserId !== user.id) return false;
          if (c.status !== 'awaiting_ideas') return false;
          return ideas.some(i => i.campaignId === c.id && i.status === 'pending');
        }).length
      : 0;

    return projectTaskCount + campaignTaskCount + clientReviewCount;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <img src="/images/yads-logo.png" alt="YADS" className="mx-auto mb-4 h-16 w-auto rounded-2xl" />
          <h1 className="text-2xl font-semibold text-foreground">Wybierz użytkownika</h1>
          <p className="mt-2 text-sm text-muted-foreground">Zaloguj się jako jedna z ról, aby zobaczyć odpowiedni widok</p>
        </div>

        <div className="space-y-5">
          {ROLE_GROUPS.map(group => {
            const groupUsers = users.filter(u => u.role === group[0].role);
            if (groupUsers.length === 0) return null;
            return (
              <div key={group[0].role}>
                <div className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group[0].label}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {groupUsers.map(user => {
                    const count = getActiveTaskCount(user);
                    return (
                      <button
                        key={user.id}
                        onClick={() => setCurrentUser(user)}
                        className="group relative flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-all hover:border-primary/30 hover:shadow-sm"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                          {user.name.charAt(0)}
                        </div>
                        <span className="flex-1 truncate text-sm font-medium text-foreground">{user.name}</span>
                        {count > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                            {count}
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoleSelector;
