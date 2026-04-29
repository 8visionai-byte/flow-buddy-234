import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, Task, Project, Client, UserRole, TaskHistoryEntry, Recording, ProjectNote, ProjectPriority, Idea, IdeaStatus, Campaign } from '@/types';
import { INITIAL_USERS, INITIAL_PROJECTS, INITIAL_CLIENTS, INITIAL_CAMPAIGNS, INITIAL_IDEAS, getInitialTasks, createTasksForProject } from '@/data/mockData';
import { sendWebhook, buildWebhookPayload, WebhookEvent, sendIdeaWebhook, buildIdeaWebhookPayload } from '@/lib/webhook';
import { hydrateFromSupabase, useSupabaseSync, type HydratedState } from '@/integrations/supabase/sync';

// localStorage helpers
const STORAGE_KEYS = {
  currentUser: 'yads_currentUser',
  users: 'yads_users',
  clients: 'yads_clients',
  projects: 'yads_projects',
  tasks: 'yads_tasks',
  recordings: 'yads_recordings',
  projectNotes: 'yads_projectNotes',
  ideas: 'yads_ideas',
  campaigns: 'yads_campaigns',
} as const;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage`, e);
  }
  return fallback;
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage`, e);
  }
}

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  recordings: Recording[];
  projectNotes: ProjectNote[];
  completeTask: (taskId: string, value: string, byRole?: UserRole) => void;
  rejectTask: (taskId: string, feedback: string) => void;
  resubmitTask: (taskId: string, newValue: string) => void;
  resubmitTaskAndAutoApprove: (taskId: string, newValue: string) => void;
  updateTaskValue: (taskId: string, newValue: string) => void;
  saveDraftValue: (taskId: string, value: string) => void;
  deferTask: (taskId: string) => void;
  rejectFinalTask: (taskId: string, reason?: string) => void;
  addProject: (project: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId' | 'assignedPublikatorId' | 'publicationDate' | 'priority' | 'slaHours'>) => void;
  reopenTask: (taskId: string) => void;
  deleteProject: (projectId: string) => void;
  toggleFreezeProject: (projectId: string) => void;
  assignToProject: (projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId' | 'assignedPublikatorId', userId: string | null) => void; // ← includes assignedPublikatorId
  addUser: (user: Omit<User, 'id'>) => string;
  updateUser: (id: string, data: Partial<Omit<User, 'id'>>) => void;
  deleteUser: (id: string) => void;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => string;
  updateClient: (id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>) => void;
  deleteClient: (id: string) => void;
  setTaskDeadline: (taskId: string, date: string | null) => void;
  setFilmingDate: (projectId: string, date: string | null) => void;
  addRecording: (projectId: string, url: string, note: string) => void;
  deleteRecording: (recordingId: string) => void;
  addProjectNote: (projectId: string, content: string) => void;
  deleteProjectNote: (noteId: string) => void;
  setPublicationDate: (projectId: string, date: string | null) => void;
  setProjectPriority: (projectId: string, priority: ProjectPriority) => void;
  setProjectSla: (projectId: string, hours: number | null) => void;
  ideas: Idea[];
  addIdea: (campaignId: string, title: string, description: string, createdByUserId: string) => void;
  updateIdea: (ideaId: string, title: string, description: string) => void;
  deleteIdea: (ideaId: string) => void;
  reviewIdea: (ideaId: string, status: IdeaStatus, clientNotes: string | null, reviewedByUserId: string) => void;
  acceptIdeaAsProject: (ideaId: string) => void;
  campaigns: Campaign[];
  addCampaign: (data: Omit<Campaign, 'id' | 'createdAt' | 'status'>) => void;
  updateCampaign: (id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>) => void;
  deleteCampaign: (id: string) => void;
  updatePartyNote: (taskId: string, role: string, note: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromStorage(STORAGE_KEYS.currentUser, null));
  const [users, setUsers] = useState<User[]>(() => {
    const stored: User[] = loadFromStorage(STORAGE_KEYS.users, INITIAL_USERS);
    // migrate: strip "(Role)" suffix from names added by old seed data
    return stored.map(u => ({ ...u, name: u.name.replace(/\s*\([^)]+\)$/, '') }));
  });
  const [clients, setClients] = useState<Client[]>(() => loadFromStorage(STORAGE_KEYS.clients, INITIAL_CLIENTS));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage(STORAGE_KEYS.projects, INITIAL_PROJECTS));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(STORAGE_KEYS.tasks, getInitialTasks()));
  const [recordings, setRecordings] = useState<Recording[]>(() => loadFromStorage(STORAGE_KEYS.recordings, []));
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>(() => loadFromStorage(STORAGE_KEYS.projectNotes, []));
  const [ideas, setIdeas] = useState<Idea[]>(() => loadFromStorage(STORAGE_KEYS.ideas, INITIAL_IDEAS));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadFromStorage(STORAGE_KEYS.campaigns, INITIAL_CAMPAIGNS));

  // Ref always holds latest state — lets zero-dep callbacks access current values without stale closures
  const ctxRef = useRef({ projects, users, currentUser, tasks, clients, campaigns, ideas });
  useEffect(() => { ctxRef.current = { projects, users, currentUser, tasks, clients, campaigns, ideas }; });

  // ── Webhook helper ─────────────────────────────────────────────────────────
  // Fires a webhook after a task state change.
  // nextOrdersHint: task orders that are expected to be unlocked by this action.
  const fireWebhook = useCallback((
    event: WebhookEvent,
    task: Task,
    value: string,
    nextOrdersHint: number[] = [],
    meta?: Record<string, unknown>,
  ) => {
    const { projects, users, currentUser, tasks } = ctxRef.current;
    const project = projects.find(p => p.id === task.projectId);
    if (!project) return;
    // Determine next tasks from current state (before update resolves in React)
    const nextTasks = nextOrdersHint.length > 0
      ? nextOrdersHint.flatMap(o => tasks.filter(t => t.projectId === task.projectId && t.order === o))
      : tasks
          .filter(t => t.projectId === task.projectId && t.order > task.order && t.status === 'locked')
          .sort((a, b) => a.order - b.order)
          .slice(0, 2);
    const payload = buildWebhookPayload(event, task, value, project, users, currentUser, nextTasks, meta);
    sendWebhook(payload);
  }, []);

  // Persist to localStorage on every change
  useEffect(() => { saveToStorage(STORAGE_KEYS.currentUser, currentUser); }, [currentUser]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.users, users); }, [users]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.clients, clients); }, [clients]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.projects, projects); }, [projects]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.tasks, tasks); }, [tasks]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.recordings, recordings); }, [recordings]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.projectNotes, projectNotes); }, [projectNotes]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.ideas, ideas); }, [ideas]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.campaigns, campaigns); }, [campaigns]);

  // ── One-time migration: unify Client.contactName with klient app_users ───
  // Goal: avoid showing the same person twice in dropdowns and avoid creating
  // a duplicate user that breaks `assignedClientId` references.
  // Strategy:
  //   1) If a klient user with matching name already exists → do nothing.
  //   2) Else if the client has exactly ONE klient user → rename that user to
  //      contactName (and copy phone if missing). This preserves user IDs that
  //      are already referenced by `assignedClientId` on projects.
  //   3) Else (0 users for this client) → create a new user.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current) return;
    if (clients.length === 0) return; // wait until clients are loaded
    migratedRef.current = true;
    const toCreate: User[] = [];
    const toRename: { id: string; name: string; phone?: string }[] = [];
    clients.forEach(c => {
      const name = (c.contactName || '').trim();
      if (!name) return;
      const linked = users.filter(u => u.role === 'klient' && u.clientId === c.id);
      const exists = linked.some(u => u.name.trim().toLowerCase() === name.toLowerCase());
      if (exists) return;
      if (linked.length === 1) {
        // Rename the single existing klient user to match the contact, preserving its ID
        const existing = linked[0];
        toRename.push({
          id: existing.id,
          name,
          phone: (existing as User & { phone?: string }).phone || c.phone || undefined,
        });
      } else if (linked.length === 0) {
        toCreate.push({
          id: `u-mig-${c.id}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          role: 'klient',
          clientId: c.id,
          phone: c.phone || undefined,
        });
      }
      // If linked.length > 1, do nothing — admin must resolve manually.
    });
    if (toCreate.length === 0 && toRename.length === 0) {
      // Still run dedupe pass even if nothing to create/rename
    }
    setUsers(prev => {
      const renamed = prev.map(u => {
        const r = toRename.find(x => x.id === u.id);
        return r ? { ...u, name: r.name, phone: r.phone } : u;
      });
      const combined = [...renamed, ...toCreate];
      // Dedupe: drop any klient user whose id starts with "u-mig-" if there's
      // already another klient user with the same (clientId, name).
      const seen = new Set<string>();
      const keep: User[] = [];
      // Prefer non-"u-mig-" ids first so they win deduplication.
      const ordered = [...combined].sort((a, b) => {
        const am = a.id.startsWith('u-mig-') ? 1 : 0;
        const bm = b.id.startsWith('u-mig-') ? 1 : 0;
        return am - bm;
      });
      ordered.forEach(u => {
        if (u.role !== 'klient') { keep.push(u); return; }
        const key = `${u.clientId ?? ''}::${u.name.trim().toLowerCase()}`;
        if (seen.has(key)) return; // duplicate — drop
        seen.add(key);
        keep.push(u);
      });
      return keep;
    });
  }, [clients, users]);

  // ── One-time backfill: assign reviewer to campaigns missing one ─────────
  // For active campaigns (awaiting_ideas / in_review) with assignedClientUserId === null,
  // pick the first (by id) klient user of the campaign's client as the reviewer.
  // Without this, ideas stall: the client filter (c.assignedClientUserId !== currentUser.id)
  // hides the campaign from every klient user.
  const reviewerBackfillRef = useRef(false);
  useEffect(() => {
    if (reviewerBackfillRef.current) return;
    if (campaigns.length === 0) return;
    if (users.length === 0) return;
    reviewerBackfillRef.current = true;
    const updates: { id: string; userId: string }[] = [];
    campaigns.forEach(c => {
      if (c.assignedClientUserId) return;
      if (c.status !== 'awaiting_ideas' && c.status !== 'in_review') return;
      const candidates = users
        .filter(u => u.role === 'klient' && u.clientId === c.clientId)
        .sort((a, b) => a.id.localeCompare(b.id));
      if (candidates.length > 0) {
        updates.push({ id: c.id, userId: candidates[0].id });
      }
    });
    if (updates.length > 0) {
      setCampaigns(prev => prev.map(c => {
        const u = updates.find(x => x.id === c.id);
        return u ? { ...c, assignedClientUserId: u.userId } : c;
      }));
    }
  }, [campaigns, users]);

  const isApprovalType = (inputType: string) => inputType === 'approval' || inputType === 'actor_approval';

  // When a pre-valued filming task gets unlocked by the pipeline (locked → todo), auto-complete it
  // and cascade-unlock the next task, so the pipeline doesn't stall.
  useEffect(() => {
    const preValued = tasks.find(t =>
      t.status === 'todo' &&
      t.title === 'Ustaw termin planu zdjęciowego' &&
      !!t.value
    );
    if (!preValued) return;
    const now = new Date().toISOString();
    setTasks(prev => {
      const task = prev.find(t => t.id === preValued.id);
      if (!task || task.status !== 'todo' || !task.value) return prev;
      const projTasks = prev.filter(t => t.projectId === task.projectId).sort((a, b) => a.order - b.order);
      // PARALLEL GATE: don't unlock next task until "Określ rekwizyty" is also done.
      const rekwizyty = projTasks.find(t => t.title === 'Określ rekwizyty');
      const rekwizytyDone = rekwizyty?.status === 'done';
      const nextLocked = rekwizytyDone
        ? projTasks.find(t => t.order === task.order + 1 && t.status === 'locked')
        : null;
      return prev.map(t => {
        if (t.id === task.id) return { ...t, status: 'done' as const, completedAt: now, completedBy: 'admin' };
        if (nextLocked && t.id === nextLocked.id) {
          const ns = isApprovalType(t.inputType) ? 'pending_client_approval' as const : 'todo' as const;
          return { ...t, status: ns, assignedAt: now };
        }
        return t;
      });
    });
  }, [tasks]);

  const completeTask = useCallback((taskId: string, value: string, byRole?: UserRole) => {
    setTasks(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const role = byRole || task.assignedRole;
      const isMultiRole = task.assignedRoles.length > 1;

      // Script review with file notes → mark client's decision as completed, bounce back to influencer, don't advance
      if (task.inputType === 'script_review' && value === 'approved_with_file_notes') {
        const scriptTask = prev.find(t => t.projectId === task.projectId && t.order === task.order - 1);
        const bounceEntry: TaskHistoryEntry = { action: 'file_notes', by: 'klient', feedback: 'Klient dodał uwagi bezpośrednio w pliku. Przejrzyj komentarze i wprowadź poprawki.', timestamp: now };
        return prev.map(t => {
          if (t.id === taskId) return {
            ...t,
            status: 'done' as const,
            value,
            completedAt: now,
            completedBy: 'klient',
            history: [...t.history, bounceEntry],
          };
          if (scriptTask && t.id === scriptTask.id) return {
            ...t,
            status: 'needs_influencer_revision' as const,
            clientFeedback: 'Klient dodał uwagi bezpośrednio w pliku. Przejrzyj komentarze i wprowadź poprawki.',
            assignedAt: now,
            completedAt: null,
            completedBy: null,
            history: [...t.history, bounceEntry],
          };
          return t;
        });
      }

      const entry: TaskHistoryEntry = { action: task.inputType === 'approval' ? 'approved' : 'submitted', by: role, value, timestamp: now };

      // Propagate approval history to the source non-approval task (not just order-1)
      let prevTask: Task | undefined = undefined;
      if (task.inputType === 'approval') {
        for (let o = task.order - 1; o >= 0; o--) {
          const candidate = prev.find(t => t.projectId === task.projectId && t.order === o);
          if (candidate && candidate.inputType !== 'approval') {
            prevTask = candidate;
            break;
          }
        }
      }

      if (isMultiRole) {
        const newCompletions = { ...task.roleCompletions, [role]: value };
        const allDone = task.assignedRoles.every(r => newCompletions[r]);

        if (allDone) {
          // All roles completed — mark done and advance
          const updated = prev.map(t => {
            if (t.id === taskId) {
              return { ...t, status: 'done' as const, value: JSON.stringify(newCompletions), completedAt: now, completedBy: role, history: [...t.history, entry], roleCompletions: newCompletions };
            }
            if (prevTask && t.id === prevTask.id) {
              return { ...t, history: [...t.history, entry] };
            }
            return t;
          });

          const completedTask = updated.find(t => t.id === taskId)!;
          const projectTasks = updated.filter(t => t.projectId === completedTask.projectId).sort((a, b) => a.order - b.order);
          // Unlock consecutive approval tasks together
          const nextToUnlock: string[] = [];
          for (let o = completedTask.order + 1; ; o++) {
            const t = projectTasks.find(pt => pt.order === o);
            if (!t || t.status !== 'locked') break;
            if (!isApprovalType(t.inputType) && nextToUnlock.length > 0) break;
            nextToUnlock.push(t.id);
            if (!isApprovalType(t.inputType)) break;
          }
          if (nextToUnlock.length > 0) {
            const unlockSet = new Set(nextToUnlock);
            return updated.map(t => {
              if (unlockSet.has(t.id)) {
                const ns = isApprovalType(t.inputType) ? 'pending_client_approval' as const : 'todo' as const;
                return { ...t, status: ns, previousValue: completedTask.value || value, assignedAt: now };
              }
              return t;
            });
          }
          return updated;
        } else {
          // Partial completion — just update roleCompletions
          return prev.map(t => {
            if (t.id === taskId) {
              return { ...t, roleCompletions: newCompletions, history: [...t.history, entry] };
            }
            return t;
          });
        }
      }

      // Single-role task — original logic
      let operatorNote: string | null = null;
      if (task.inputType === 'raw_footage') {
        try { const p = JSON.parse(value); operatorNote = p.notes?.trim() || null; } catch {}
      }
      const uwagTaskId = operatorNote
        ? prev.find(t => t.projectId === task.projectId && t.title === 'Wnieś uwagi przed montażem' && !t.roleCompletions['operator'])?.id
        : null;

      const updated = prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'done' as const, value, completedAt: now, completedBy: t.assignedRole, history: [...t.history, entry] };
        }
        if (prevTask && t.id === prevTask.id) {
          return { ...t, history: [...t.history, entry] };
        }
        if (uwagTaskId && t.id === uwagTaskId) {
          return { ...t, roleCompletions: { ...t.roleCompletions, operator: operatorNote! } };
        }
        return t;
      });

      const completedTask = updated.find(t => t.id === taskId)!;
      const projectTasks = updated.filter(t => t.projectId === completedTask.projectId).sort((a, b) => a.order - b.order);

      // If this is an approval task, check if it's part of a group of consecutive approvals
      if (isApprovalType(completedTask.inputType)) {
        // Find all sibling approvals (consecutive approval tasks around this one)
        let groupStart = completedTask.order;
        while (groupStart > 0) {
          const prev = projectTasks.find(t => t.order === groupStart - 1);
          if (prev && isApprovalType(prev.inputType)) groupStart--;
          else break;
        }
        let groupEnd = completedTask.order;
        while (true) {
          const next = projectTasks.find(t => t.order === groupEnd + 1);
          if (next && isApprovalType(next.inputType)) groupEnd++;
          else break;
        }

        // Check if ALL approvals in the group are done
        const allGroupDone = projectTasks
          .filter(t => t.order >= groupStart && t.order <= groupEnd)
          .every(t => t.status === 'done');

        if (allGroupDone) {
          // Unlock next task after the approval group
          const nextAfterGroup = projectTasks.find(t => t.order === groupEnd + 1);
          if (nextAfterGroup && nextAfterGroup.status === 'locked') {
            const newStatus = isApprovalType(nextAfterGroup.inputType) ? 'pending_client_approval' as const : 'todo' as const;

            // PARALLEL UNLOCK: After "Zaakceptuj przypisanie osoby" → unlock both
            // "Określ rekwizyty" (influencer) AND "Ustaw termin planu zdjęciowego" (admin) together,
            // so admin sees the task in "Moje Zadania" immediately and influencer doesn't have to wait.
            const parallelMate = (nextAfterGroup.title === 'Określ rekwizyty')
              ? projectTasks.find(t => t.title === 'Ustaw termin planu zdjęciowego' && t.status === 'locked')
              : null;

            return updated.map(t => {
              if (t.id === nextAfterGroup.id) {
                return { ...t, status: newStatus, previousValue: completedTask.value || value, assignedAt: now };
              }
              if (parallelMate && t.id === parallelMate.id) {
                return { ...t, status: 'todo' as const, previousValue: completedTask.value || value, assignedAt: now };
              }
              return t;
            });
          }
        }
        return updated;
      }

      // PARALLEL GROUP GATE: "Określ rekwizyty" + "Ustaw termin planu zdjęciowego" run in parallel.
      // Don't unlock the next task ("Potwierdź nagranie") until BOTH are done.
      const PARALLEL_PAIR = ['Określ rekwizyty', 'Ustaw termin planu zdjęciowego'];
      if (PARALLEL_PAIR.includes(completedTask.title)) {
        const mate = projectTasks.find(t => PARALLEL_PAIR.includes(t.title) && t.id !== completedTask.id);
        const mateInUpdated = updated.find(t => t.id === mate?.id);
        const mateDone = mateInUpdated?.status === 'done' || (mateInUpdated?.title === 'Ustaw termin planu zdjęciowego' && !!mateInUpdated?.value);
        if (mate && !mateDone) {
          // Hold off: parallel mate is still active. Don't unlock anything downstream.
          return updated;
        }
      }

      // Non-approval task: unlock all consecutive approval tasks together (but NOT non-approval tasks after them)
      const nextTasksToUnlock: { id: string; prevValue: string }[] = [];
      for (let o = completedTask.order + 1; ; o++) {
        const t = projectTasks.find(pt => pt.order === o);
        if (!t || t.status !== 'locked') break;
        if (!isApprovalType(t.inputType) && nextTasksToUnlock.length > 0) break;
        // Each approval gets previousValue from the corresponding source task before the approval group
        const sourceOrder = completedTask.order - nextTasksToUnlock.length;
        const sourceTask = projectTasks.find(pt => pt.order === sourceOrder);
        nextTasksToUnlock.push({ id: t.id, prevValue: sourceTask?.value || completedTask.value || value });
        if (!isApprovalType(t.inputType)) break;
      }

      // Assign correct previousValue to each approval: map approval index to source task
      if (nextTasksToUnlock.length > 0) {
        // Collect done non-approval tasks before this approval group (in reverse order)
        const approvalCount = nextTasksToUnlock.length;
        const sourceTasks: { value: string | null }[] = [];
        for (let o = completedTask.order; o >= 0 && sourceTasks.length < approvalCount; o--) {
          const st = projectTasks.find(pt => pt.order === o);
          if (st && !isApprovalType(st.inputType) && st.status === 'done') {
            sourceTasks.unshift(st);
          }
        }

        const unlockMap = new Map<string, string>();
        nextTasksToUnlock.forEach((item, i) => {
          const source = sourceTasks[i];
          unlockMap.set(item.id, source?.value || completedTask.value || value);
        });

        const unlocked = updated.map(t => {
          if (unlockMap.has(t.id)) {
            const newStatus = isApprovalType(t.inputType) ? 'pending_client_approval' as const : 'todo' as const;
            return { ...t, status: newStatus, previousValue: unlockMap.get(t.id)!, assignedAt: now };
          }
          return t;
        });

        // Klient approved film without changes → auto-skip corrections, auto-approve klient part of acceptance
        if (completedTask.title === 'Weryfikuj film na frame.io' && value === 'approved') {
          const poprawki = unlocked.find(t => t.projectId === completedTask.projectId && t.title === 'Wgraj poprawki');
          const akceptacja = unlocked.find(t => t.projectId === completedTask.projectId && t.title === 'Akceptacja materiału');
          if (poprawki && akceptacja) {
            const opisyTask = unlocked.find(t => t.projectId === completedTask.projectId && t.title === 'Opisy i tytuły do publikacji');
            return unlocked.map(t => {
              if (t.id === poprawki.id) return { ...t, status: 'done' as const, value: 'skipped', completedAt: now };
              // Klient approved via frameio — fully auto-complete acceptance, no admin needed
              if (t.id === akceptacja.id) return {
                ...t, status: 'done' as const, value: 'approved', completedAt: now, assignedAt: now,
              };
              // Unlock next task for influencer
              if (opisyTask && t.id === opisyTask.id) return { ...t, status: 'todo' as const, assignedAt: now };
              return t;
            });
          }
        }

        // Set montażysta SLA based on priority
        if (completedTask.title === 'Nadaj priorytet montażu') {
          const slaMap: Record<string, number> = { high: 48, medium: 96, low: 168 };
          const slaHours = slaMap[value] ?? 96;
          const deadline = new Date(Date.now() + slaHours * 3600000).toISOString();
          return unlocked.map(t =>
            (t.title === 'Wgraj zmontowany film' && t.projectId === completedTask.projectId && t.status === 'todo')
              ? { ...t, deadlineDate: deadline }
              : t
          );
        }
        return unlocked;
      }

      // Klient approved without changes (no next task to unlock case)
      if (completedTask.title === 'Weryfikuj film na frame.io' && value === 'approved') {
        const poprawki = updated.find(t => t.projectId === completedTask.projectId && t.title === 'Wgraj poprawki');
        const akceptacja = updated.find(t => t.projectId === completedTask.projectId && t.title === 'Akceptacja materiału');
        if (poprawki && akceptacja) {
          const opisyTask = updated.find(t => t.projectId === completedTask.projectId && t.title === 'Opisy i tytuły do publikacji');
          return updated.map(t => {
            if (t.id === poprawki.id) return { ...t, status: 'done' as const, value: 'skipped', completedAt: now };
            // Klient approved via frameio — fully auto-complete acceptance, no admin needed
            if (t.id === akceptacja.id) return {
              ...t, status: 'done' as const, value: 'approved', completedAt: now, assignedAt: now,
            };
            // Unlock next task for influencer
            if (opisyTask && t.id === opisyTask.id) return { ...t, status: 'todo' as const, assignedAt: now };
            return t;
          });
        }
      }

      return updated;
    });

    // Fire webhook — uses ctxRef snapshot (state before React processes setTasks)
    const taskSnap = ctxRef.current.tasks.find(t => t.id === taskId);
    if (taskSnap) fireWebhook('task_completed', taskSnap, value);
  }, [fireWebhook]);

  // Client rejects: task bounces back to influencer
  const rejectTask = useCallback((taskId: string, feedback: string) => {
    setTasks(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const prevTask = prev.find(
        t => t.projectId === task.projectId && t.order === task.order - 1
      );

      const entry: TaskHistoryEntry = { action: 'rejected', by: task.assignedRole, feedback, timestamp: now };

      return prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'locked' as const, clientFeedback: feedback, assignedAt: null, history: [...t.history, entry] };
        }
        if (prevTask && t.id === prevTask.id) {
          return {
            ...t,
            status: 'needs_influencer_revision' as const,
            clientFeedback: feedback,
            assignedAt: now,
            completedAt: null,
            completedBy: null,
            history: [...t.history, entry],
          };
        }
        return t;
      });
    });

    const taskSnap = ctxRef.current.tasks.find(t => t.id === taskId);
    if (taskSnap) fireWebhook('task_rejected', taskSnap, feedback, [], { feedback });
  }, [fireWebhook]);

  const deferTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const entry: TaskHistoryEntry = { action: 'deferred', by: 'klient', timestamp: new Date().toISOString() };
      return prev.map(t => t.id === taskId ? { ...t, status: 'deferred' as const, history: [...t.history, entry] } : t);
    });

    const taskSnap = ctxRef.current.tasks.find(t => t.id === taskId);
    if (taskSnap) fireWebhook('task_deferred', taskSnap, 'deferred');
  }, [fireWebhook]);

  const rejectFinalTask = useCallback((taskId: string, reason?: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const entry: TaskHistoryEntry = { action: 'rejected_final', by: 'klient', feedback: reason || undefined, timestamp: new Date().toISOString() };
      return prev.map(t => t.id === taskId ? { ...t, status: 'rejected_final' as const, clientFeedback: reason || null, history: [...t.history, entry] } : t);
    });

    const taskSnap = ctxRef.current.tasks.find(t => t.id === taskId);
    if (taskSnap) fireWebhook('task_rejected_final', taskSnap, reason || '', [], { reason });
  }, [fireWebhook]);

  // Influencer resubmits after revision
  const resubmitTask = useCallback((taskId: string, newValue: string) => {
    setTasks(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const entry: TaskHistoryEntry = { action: 'resubmitted', by: task.assignedRole, value: newValue, timestamp: now };

      const nextTask = prev.find(
        t => t.projectId === task.projectId && t.order === task.order + 1
      );

      return prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'done' as const, value: newValue, completedAt: now, completedBy: t.assignedRole, clientFeedback: null, history: [...t.history, entry] };
        }
        if (nextTask && t.id === nextTask.id) {
          return { ...t, status: 'pending_client_approval' as const, previousValue: newValue, clientFeedback: null, assignedAt: now, history: [...t.history, entry] };
        }
        return t;
      });
    });

    const taskSnap = ctxRef.current.tasks.find(t => t.id === taskId);
    if (taskSnap) fireWebhook('task_resubmitted', taskSnap, newValue);
  }, [fireWebhook]);

  // Influencer resubmits AND marks the next client approval as auto-approved (skips client review).
  const resubmitTaskAndAutoApprove = useCallback((taskId: string, newValue: string) => {
    setTasks(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const resubmitEntry: TaskHistoryEntry = {
        action: 'resubmitted_auto_approved',
        by: task.assignedRole,
        value: newValue,
        timestamp: now,
      };
      const autoApproveEntry: TaskHistoryEntry = {
        action: 'auto_approved_by_influencer',
        by: task.assignedRole,
        feedback: 'Influencer oznaczył poprawki jako niewymagające ponownej akceptacji klienta',
        timestamp: now,
      };

      // Find the corresponding client approval task — must be the IMMEDIATELY next task
      // and one of the approval-style input types. We check only order+1 to avoid
      // accidentally auto-approving a far-away approval (e.g. material approval in phase 5)
      // when the immediate next task is something else.
      const projectTasks = prev.filter(t => t.projectId === task.projectId).sort((a, b) => a.order - b.order);
      const nextTask = projectTasks.find(t => t.order === task.order + 1);
      const approvalTask = nextTask && (
        nextTask.inputType === 'approval' ||
        nextTask.inputType === 'script_review' ||
        nextTask.inputType === 'actor_approval'
      ) ? nextTask : null;

      // Determine the task to unlock next (after the auto-approved approval)
      const afterApproval = approvalTask
        ? projectTasks.find(t => t.order === approvalTask.order + 1 && t.status === 'locked')
        : null;

      // PARALLEL UNLOCK (mirror of completeTask): when next task is "Określ rekwizyty" (influencer),
      // also unlock "Ustaw termin planu zdjęciowego" (admin) so admin sees the task immediately.
      const parallelMate = (afterApproval?.title === 'Określ rekwizyty')
        ? projectTasks.find(t => t.title === 'Ustaw termin planu zdjęciowego' && t.status === 'locked')
        : null;

      return prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'done' as const,
            value: newValue,
            completedAt: now,
            completedBy: t.assignedRole,
            clientFeedback: null,
            history: [...t.history, resubmitEntry],
          };
        }
        if (approvalTask && t.id === approvalTask.id) {
          return {
            ...t,
            status: 'done' as const,
            value: 'auto_approved',
            previousValue: newValue,
            completedAt: now,
            completedBy: task.assignedRole,
            assignedAt: t.assignedAt ?? now,
            clientFeedback: null,
            history: [...t.history, autoApproveEntry],
          };
        }
        if (afterApproval && t.id === afterApproval.id) {
          const ns = (t.inputType === 'approval' || t.inputType === 'script_review')
            ? 'pending_client_approval' as const
            : 'todo' as const;
          return { ...t, status: ns, assignedAt: now };
        }
        if (parallelMate && t.id === parallelMate.id) {
          return { ...t, status: 'todo' as const, assignedAt: now };
        }
        return t;
      });
    });

    const taskSnap = ctxRef.current.tasks.find(t => t.id === taskId);
    if (taskSnap) fireWebhook('task_resubmitted', taskSnap, newValue);
  }, [fireWebhook]);
  const updateTaskValue = useCallback((taskId: string, newValue: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const now = new Date().toISOString();
      // Find next pending_client_approval task and update its previousValue
      const nextApproval = prev.find(
        t => t.projectId === task.projectId && t.order === task.order + 1 &&
          (t.status === 'pending_client_approval' || t.status === 'todo')
      );
      return prev.map(t => {
        if (t.id === taskId) return { ...t, value: newValue, completedAt: now };
        if (nextApproval && t.id === nextApproval.id) return { ...t, previousValue: newValue };
        return t;
      });
    });
  }, []);

  // Save partial data to task.value without changing status or completedAt (used for social description drafts)
  const saveDraftValue = useCallback((taskId: string, value: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, value } : t));
  }, []);

  const reopenTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task || task.status !== 'done') return prev;

      if (task.inputType === 'script_review' && task.value === 'approved_with_file_notes') {
        const now = new Date().toISOString();
        const scriptTask = prev.find(t => t.projectId === task.projectId && t.order === task.order - 1);
        return prev.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              status: 'pending_client_approval' as const,
              value: null,
              completedAt: null,
              completedBy: null,
              assignedAt: now,
              previousValue: scriptTask?.value || t.previousValue,
            };
          }
          if (scriptTask && t.id === scriptTask.id && t.status === 'needs_influencer_revision') {
            return { ...t, status: 'done' as const, completedAt: now, completedBy: t.assignedRole, clientFeedback: null };
          }
          return t;
        });
      }

      // If this task has a next approval task, lock it
      return prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'todo' as const, completedAt: null, completedBy: null, value: null, assignedAt: new Date().toISOString() };
        }
        // Lock any subsequent task that was unlocked by this one
        if (t.projectId === task.projectId && t.order === task.order + 1 && t.status !== 'done') {
          return { ...t, status: 'locked' as const, assignedAt: null };
        }
        return t;
      });
    });
  }, []);

  const addProject = useCallback((data: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId' | 'assignedPublikatorId' | 'publicationDate' | 'priority' | 'slaHours'>) => {
    const id = `p${Date.now()}`;
    const newProject: Project = { ...data, id, currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, assignedOperatorId: null, assignedPublikatorId: null, publicationDate: null, priority: 'medium', slaHours: 48 };
    setProjects(prev => [...prev, newProject]);
    const newTasks = createTasksForProject(id, 0);
    setTasks(prev => [...prev, ...newTasks]);
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setTasks(prev => prev.filter(t => t.projectId !== projectId));
  }, []);

  const toggleFreezeProject = useCallback((projectId: string) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, status: p.status === 'frozen' ? 'active' as const : 'frozen' as const } : p
    ));
  }, []);

  const assignToProject = useCallback((projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId' | 'assignedPublikatorId', userId: string | null) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === projectId ? { ...p, [field]: userId } : p);
      // Persist immediately — same belt-and-suspenders as addUser,
      // so HMR reloads in dev don't lose role assignments before the useEffect fires
      saveToStorage(STORAGE_KEYS.projects, next);
      return next;
    });
  }, []);

  const addUser = useCallback((data: Omit<User, 'id'>): string => {
    const id = `u${Date.now()}`;
    setUsers(prev => {
      const next = [...prev, { ...data, id }];
      // Persist immediately (belt-and-suspenders alongside the useEffect)
      // so HMR reloads in dev don't lose newly created users before the effect fires
      saveToStorage(STORAGE_KEYS.users, next);
      return next;
    });
    return id;
  }, []);

  const updateUser = useCallback((id: string, data: Partial<Omit<User, 'id'>>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  const addClient = useCallback((data: Omit<Client, 'id' | 'createdAt'>): string => {
    const id = `c${Date.now()}`;
    setClients(prev => [...prev, { ...data, id, createdAt: new Date().toISOString() }]);
    return id;
  }, []);

  const updateClient = useCallback((id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  }, []);

  const setTaskDeadline = useCallback((taskId: string, date: string | null) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, deadlineDate: date } : t
    ));
  }, []);

  // Set (or clear) filming date on a project at any time — works regardless of task status
  const setFilmingDate = useCallback((projectId: string, date: string | null) => {
    setTasks(prev => prev.map(t => {
      if (t.projectId !== projectId) return t;
      if (t.title === 'Określ rekwizyty') return { ...t, deadlineDate: date };
      if (t.title === 'Potwierdź nagranie') return { ...t, deadlineDate: date };
      if (t.title === 'Ustaw termin planu zdjęciowego') {
        if (date === null) {
          // Clear: revert to locked if was done via this quick-set, otherwise keep done
          return { ...t, value: null };
        }
        if (t.status === 'todo') {
          return { ...t, value: date, status: 'done' as const, completedAt: new Date().toISOString(), completedBy: 'admin' };
        }
        return { ...t, value: date };
      }
      return t;
    }));
  }, []);

  const addRecording = useCallback((projectId: string, url: string, note: string) => {
    const newRec: Recording = { id: `rec${Date.now()}`, projectId, url, note, createdAt: new Date().toISOString() };
    setRecordings(prev => [...prev, newRec]);
  }, []);

  const deleteRecording = useCallback((recordingId: string) => {
    setRecordings(prev => prev.filter(r => r.id !== recordingId));
  }, []);

  const addProjectNote = useCallback((projectId: string, content: string) => {
    const newNote: ProjectNote = { id: `note${Date.now()}`, projectId, content, createdAt: new Date().toISOString() };
    setProjectNotes(prev => [...prev, newNote]);
  }, []);

  const deleteProjectNote = useCallback((noteId: string) => {
    setProjectNotes(prev => prev.filter(n => n.id !== noteId));
  }, []);

  const setPublicationDate = useCallback((projectId: string, date: string | null) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, publicationDate: date } : p));
  }, []);

  const setProjectPriority = useCallback((projectId: string, priority: ProjectPriority) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, priority } : p));
  }, []);

  const setProjectSla = useCallback((projectId: string, hours: number | null) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, slaHours: hours } : p));
  }, []);

  const addIdea = useCallback((campaignId: string, title: string, description: string, createdByUserId: string) => {
    const idea: Idea = {
      id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      campaignId,
      resultingProjectId: null,
      title, description, createdByUserId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      clientNotes: null, reviewedAt: null, reviewedByUserId: null,
    };
    setIdeas(prev => [...prev, idea]);

    // Webhook: notify client that a new idea awaits review
    const { users, clients, campaigns } = ctxRef.current;
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      const actor = users.find(u => u.id === createdByUserId) ?? null;
      const clientUser = campaign.assignedClientUserId
        ? users.find(u => u.id === campaign.assignedClientUserId) ?? null
        : null;
      sendIdeaWebhook(buildIdeaWebhookPayload('idea_submitted', idea, campaign, users, clients, actor, clientUser));
    }
  }, []);

  const updateIdea = useCallback((ideaId: string, title: string, description: string) => {
    setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, title, description } : i));
  }, []);

  const deleteIdea = useCallback((ideaId: string) => {
    setIdeas(prev => prev.filter(i => i.id !== ideaId));
  }, []);

  const reviewIdea = useCallback((ideaId: string, status: IdeaStatus, clientNotes: string | null, reviewedByUserId: string) => {
    const now = new Date().toISOString();
    setIdeas(prev => prev.map(i => i.id === ideaId
      ? { ...i, status, clientNotes, reviewedAt: now, reviewedByUserId }
      : i
    ));

    // Webhook: idea reviewed by client
    const { users, clients, campaigns, ideas } = ctxRef.current;
    const idea = ideas.find(i => i.id === ideaId);
    if (idea) {
      const campaign = campaigns.find(c => c.id === idea.campaignId);
      if (campaign) {
        const actor = users.find(u => u.id === reviewedByUserId) ?? null;
        const influencer = users.find(u => u.id === campaign.assignedInfluencerId) ?? null;
        const eventMap: Record<IdeaStatus, WebhookEvent> = {
          accepted: 'idea_accepted',
          accepted_with_notes: 'idea_accepted',
          rejected: 'idea_rejected',
          saved_for_later: 'idea_saved_for_later',
          pending: 'idea_submitted',
        };
        const updatedIdea = { ...idea, status, clientNotes, reviewedAt: now, reviewedByUserId };
        sendIdeaWebhook(buildIdeaWebhookPayload(eventMap[status], updatedIdea, campaign, users, clients, actor, influencer));
      }
    }
  }, []);

  const acceptIdeaAsProject = useCallback((ideaId: string) => {
    // Defer all state updates to the next tick to avoid nested setState calls
    setTimeout(() => {
      setIdeas(prevIdeas => {
        const idea = prevIdeas.find(i => i.id === ideaId);
        if (!idea || idea.resultingProjectId) return prevIdeas;

        const newProjectId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date().toISOString();
        // Pipeline: 0=pomysł ✅, 1=zaakceptuj pomysł ✅, 2=scenariusz 🔵 (first active)
        // Actor assignment (stage 4) comes AFTER script approval — correct per 5W2H flow
        const SCRIPT_STAGE = 2;

        setCampaigns(prevCamps => {
          const camp = prevCamps.find(c => c.id === idea.campaignId);
          if (camp) {
            const newProject: Project = {
              id: newProjectId,
              name: idea.title,
              clientId: camp.clientId,
              clientName: '',
              company: '',
              clientEmail: '',
              clientPhone: '',
              currentStageIndex: SCRIPT_STAGE,
              status: 'active',
              assignedInfluencerId: camp.assignedInfluencerId,
              assignedEditorId: null,
              assignedClientId: camp.assignedClientUserId,
              assignedKierownikId: null,
              assignedOperatorId: null,
              assignedPublikatorId: null,
              publicationDate: null,
              priority: 'medium',
              slaHours: camp.slaHours || 48,
            };
            setProjects(p => [...p, newProject]);

            const ideaText = [idea.title, idea.description].filter(Boolean).join('\n\n');
            const baseTasks = createTasksForProject(newProjectId, SCRIPT_STAGE);

            const patchedTasks = baseTasks.map(t => {
              // Stage 0: "Dodaj pomysł / temat" — pre-fill from accepted idea
              if (t.order === 0) return {
                ...t,
                value: ideaText,
                completedAt: now,
                completedBy: 'influencer',
                history: [{ action: 'submitted' as const, by: 'influencer' as const, value: ideaText, timestamp: now }],
              };
              // Stage 1: "Zaakceptuj pomysł" — pre-approved (client already approved in IdeasPanel)
              if (t.order === 1) return {
                ...t,
                value: 'approved',
                previousValue: ideaText,
                completedAt: now,
                completedBy: 'klient',
                history: [{ action: 'approved' as const, by: 'klient' as const, value: 'approved', timestamp: now }],
              };
              return t;
            });

            setTasks(t => [...t, ...patchedTasks]);
          }
          return prevCamps;
        });

        // Webhook: idea converted to project — notify influencer to start working on script
        const { users, clients, campaigns } = ctxRef.current;
        const campaign = campaigns.find(c => c.id === idea.campaignId);
        if (campaign) {
          const admin = users.find(u => u.role === 'admin') ?? null;
          const influencer = users.find(u => u.id === campaign.assignedInfluencerId) ?? null;
          sendIdeaWebhook(buildIdeaWebhookPayload('idea_accepted_as_project', idea, campaign, users, clients, admin, influencer));
        }

        return prevIdeas.map(i => i.id === ideaId ? { ...i, resultingProjectId: newProjectId } : i);
      });
    }, 0);
  }, []);

  const addCampaign = useCallback((data: Omit<Campaign, 'id' | 'createdAt' | 'status'>) => {
    const campaign: Campaign = {
      ...data,
      id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'awaiting_ideas',
    };
    setCampaigns(prev => [...prev, campaign]);
  }, []);

  const updateCampaign = useCallback((id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setIdeas(prev => prev.filter(i => i.campaignId !== id));
  }, []);

  const updatePartyNote = useCallback((taskId: string, role: string, note: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, roleCompletions: { ...t.roleCompletions, [role]: note } };
    }));
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, clients, projects, tasks, recordings, projectNotes,
      completeTask, rejectTask, resubmitTask, resubmitTaskAndAutoApprove, updateTaskValue, saveDraftValue, deferTask, rejectFinalTask, reopenTask,
      addProject, deleteProject, toggleFreezeProject, assignToProject,
      addUser, updateUser, deleteUser, addClient, updateClient, deleteClient, setTaskDeadline, setFilmingDate,
      addRecording, deleteRecording, addProjectNote, deleteProjectNote, setPublicationDate, setProjectPriority, setProjectSla,
      ideas, addIdea, updateIdea, deleteIdea, reviewIdea, acceptIdeaAsProject,
      campaigns, addCampaign, updateCampaign, deleteCampaign,
      updatePartyNote,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
