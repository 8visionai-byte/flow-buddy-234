import { useApp } from '@/context/AppContext';
import { ROLE_LABELS } from '@/types';
import { User, ChevronRight, Bell } from 'lucide-react';

const RoleSelector = () => {
  const { setCurrentUser, users, tasks, projects, campaigns, ideas } = useApp();

  const getAssignedProjectIds = (user: typeof users[0]) => {
    return projects.filter(p => {
      if (p.status !== 'active') return false;
      if (user.role === 'admin') return true;
      if (user.role === 'influencer') return p.assignedInfluencerId === user.id;
      if (user.role === 'montazysta') return p.assignedEditorId === user.id;
      if (user.role === 'klient') return p.assignedClientId === user.id || p.assignedClientIds?.includes(user.id);
      if (user.role === 'kierownik_planu') return p.assignedKierownikId === user.id;
      if (user.role === 'operator') return p.assignedOperatorId === user.id;
      if (user.role === 'publikator') return tasks.some(t => t.projectId === p.id && t.assignedRoles.includes('publikator') && t.status === 'todo');
      return false;
    }).map(p => p.id);
  };

  const getActiveTaskCount = (user: typeof users[0]) => {
    // 1. Count tasks from projects
    const assignedProjectIds = getAssignedProjectIds(user);
    const taskCount = tasks.filter(t =>
      assignedProjectIds.includes(t.projectId) &&
      t.assignedRoles.includes(user.role as any) &&
      (t.status === 'todo' || t.status === 'pending_client_approval' || t.status === 'needs_influencer_revision') &&
      !(t.assignedRoles.length > 1 && t.roleCompletions[user.role])
    ).length;

    // 2. For influencers: count campaigns awaiting ideas where they need to submit
    let campaignCount = 0;
    if (user.role === 'influencer') {
      campaignCount = campaigns.filter(c =>
        !c.isDeleted &&
        c.assignedInfluencerId === user.id &&
        c.status === 'awaiting_ideas'
      ).filter(c => {
        // Only count if influencer hasn't reached target accepted ideas yet
        const acceptedIdeas = ideas.filter(i => i.campaignId === c.id && (i.status === 'accepted' || i.status === 'accepted_with_notes'));
        return acceptedIdeas.length < c.targetIdeaCount;
      }).length;
    }

    // 3. For clients: count campaigns in_review where they are a reviewer and have pending ideas
    if (user.role === 'klient') {
      campaignCount = campaigns.filter(c =>
        !c.isDeleted &&
        c.status !== 'completed' && c.status !== 'cancelled' && c.status !== 'draft' &&
        (c.reviewerIds?.includes(user.id) || c.assignedClientUserId === user.id)
      ).filter(c => {
        const pendingIdeas = ideas.filter(i => i.campaignId === c.id && i.status === 'pending');
        return pendingIdeas.length > 0;
      }).length;
    }

    return taskCount + campaignCount;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <img src="/images/yads-logo.png" alt="YADS" className="mx-auto mb-4 h-16 w-auto rounded-2xl" />
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
