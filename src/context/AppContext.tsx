import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Task, Project, Client, UserRole, TaskHistoryEntry, Recording, ProjectNote, ProjectPriority, Idea, IdeaStatus, Campaign } from '@/types';
import { INITIAL_USERS, INITIAL_PROJECTS, INITIAL_CLIENTS, INITIAL_CAMPAIGNS, INITIAL_IDEAS, getInitialTasks, createTasksForProject } from '@/data/mockData';

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
  updateTaskValue: (taskId: string, newValue: string) => void;
  saveDraftValue: (taskId: string, value: string) => void;
  deferTask: (taskId: string) => void;
  rejectFinalTask: (taskId: string, reason?: string) => void;
  addProject: (project: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId' | 'publicationDate' | 'priority' | 'slaHours'>) => void;
  reopenTask: (taskId: string) => void;
  deleteProject: (projectId: string) => void;
  toggleFreezeProject: (projectId: string) => void;
  assignToProject: (projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId', userId: string | null) => void;
  addUser: (user: Omit<User, 'id'>) => string;
  updateUser: (id: string, data: Partial<Omit<User, 'id'>>) => void;
  deleteUser: (id: string) => void;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => string;
  updateClient: (id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>) => void;
  deleteClient: (id: string) => void;
  setTaskDeadline: (taskId: string, date: string | null) => void;
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
  const [users, setUsers] = useState<User[]>(() => loadFromStorage(STORAGE_KEYS.users, INITIAL_USERS));
  const [clients, setClients] = useState<Client[]>(() => loadFromStorage(STORAGE_KEYS.clients, INITIAL_CLIENTS));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage(STORAGE_KEYS.projects, INITIAL_PROJECTS));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(STORAGE_KEYS.tasks, getInitialTasks()));
  const [recordings, setRecordings] = useState<Recording[]>(() => loadFromStorage(STORAGE_KEYS.recordings, []));
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>(() => loadFromStorage(STORAGE_KEYS.projectNotes, []));
  const [ideas, setIdeas] = useState<Idea[]>(() => loadFromStorage(STORAGE_KEYS.ideas, INITIAL_IDEAS));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadFromStorage(STORAGE_KEYS.campaigns, INITIAL_CAMPAIGNS));

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

  const completeTask = useCallback((taskId: string, value: string, byRole?: UserRole) => {
    setTasks(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const role = byRole || task.assignedRole;
      const isMultiRole = task.assignedRoles.length > 1;

      // Script review with file notes → bounce back to influencer (don't advance)
      if (task.inputType === 'script_review' && value === 'approved_with_file_notes') {
        const scriptTask = prev.find(t => t.projectId === task.projectId && t.order === task.order - 1);
        const bounceEntry: TaskHistoryEntry = { action: 'rejected', by: 'klient', feedback: 'Uwagi naniesione w pliku — popraw scenariusz i prześlij nowy link.', timestamp: now };
        return prev.map(t => {
          if (t.id === taskId) return { ...t, status: 'locked' as const, history: [...t.history, bounceEntry] };
          if (scriptTask && t.id === scriptTask.id) return {
            ...t,
            status: 'needs_influencer_revision' as const,
            clientFeedback: 'Uwagi naniesione w pliku — popraw scenariusz i prześlij nowy link.',
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
            if (t.inputType !== 'approval' && nextToUnlock.length > 0) break;
            nextToUnlock.push(t.id);
            if (t.inputType !== 'approval') break;
          }
          if (nextToUnlock.length > 0) {
            const unlockSet = new Set(nextToUnlock);
            return updated.map(t => {
              if (unlockSet.has(t.id)) {
                const ns = t.inputType === 'approval' ? 'pending_client_approval' as const : 'todo' as const;
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
      if (completedTask.inputType === 'approval') {
        // Find all sibling approvals (consecutive approval tasks around this one)
        let groupStart = completedTask.order;
        while (groupStart > 0) {
          const prev = projectTasks.find(t => t.order === groupStart - 1);
          if (prev && prev.inputType === 'approval') groupStart--;
          else break;
        }
        let groupEnd = completedTask.order;
        while (true) {
          const next = projectTasks.find(t => t.order === groupEnd + 1);
          if (next && next.inputType === 'approval') groupEnd++;
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
            const newStatus = nextAfterGroup.inputType === 'approval' ? 'pending_client_approval' as const : 'todo' as const;
            return updated.map(t =>
              t.id === nextAfterGroup.id ? { ...t, status: newStatus, previousValue: completedTask.value || value, assignedAt: now } : t
            );
          }
        }
        return updated;
      }
      
      // Non-approval task: unlock all consecutive approval tasks together (but NOT non-approval tasks after them)
      const nextTasksToUnlock: { id: string; prevValue: string }[] = [];
      for (let o = completedTask.order + 1; ; o++) {
        const t = projectTasks.find(pt => pt.order === o);
        if (!t || t.status !== 'locked') break;
        if (t.inputType !== 'approval' && nextTasksToUnlock.length > 0) break;
        // Each approval gets previousValue from the corresponding source task before the approval group
        const sourceOrder = completedTask.order - nextTasksToUnlock.length;
        const sourceTask = projectTasks.find(pt => pt.order === sourceOrder);
        nextTasksToUnlock.push({ id: t.id, prevValue: sourceTask?.value || completedTask.value || value });
        if (t.inputType !== 'approval') break;
      }
      
      // Assign correct previousValue to each approval: map approval index to source task
      if (nextTasksToUnlock.length > 0) {
        // Collect done non-approval tasks before this approval group (in reverse order)
        const approvalCount = nextTasksToUnlock.length;
        const sourceTasks: { value: string | null }[] = [];
        for (let o = completedTask.order; o >= 0 && sourceTasks.length < approvalCount; o--) {
          const st = projectTasks.find(pt => pt.order === o);
          if (st && st.inputType !== 'approval' && st.status === 'done') {
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
            const newStatus = t.inputType === 'approval' ? 'pending_client_approval' as const : 'todo' as const;
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
  }, []);

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
  }, []);

  const deferTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const entry: TaskHistoryEntry = { action: 'deferred', by: 'klient', timestamp: new Date().toISOString() };
      return prev.map(t => t.id === taskId ? { ...t, status: 'deferred' as const, history: [...t.history, entry] } : t);
    });
  }, []);

  const rejectFinalTask = useCallback((taskId: string, reason?: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const entry: TaskHistoryEntry = { action: 'rejected_final', by: 'klient', feedback: reason || undefined, timestamp: new Date().toISOString() };
      return prev.map(t => t.id === taskId ? { ...t, status: 'rejected_final' as const, clientFeedback: reason || null, history: [...t.history, entry] } : t);
    });
  }, []);

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
  }, []);

  // Influencer corrects a done URL/text task without resetting downstream approval
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

  const addProject = useCallback((data: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId' | 'publicationDate' | 'priority' | 'slaHours'>) => {
    const id = `p${Date.now()}`;
    const newProject: Project = { ...data, id, currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, assignedOperatorId: null, publicationDate: null, priority: 'medium', slaHours: 48 };
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

  const assignToProject = useCallback((projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId', userId: string | null) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, [field]: userId } : p
    ));
  }, []);

  const addUser = useCallback((data: Omit<User, 'id'>): string => {
    const id = `u${Date.now()}`;
    setUsers(prev => [...prev, { ...data, id }]);
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
  }, []);

  const updateIdea = useCallback((ideaId: string, title: string, description: string) => {
    setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, title, description } : i));
  }, []);

  const deleteIdea = useCallback((ideaId: string) => {
    setIdeas(prev => prev.filter(i => i.id !== ideaId));
  }, []);

  const reviewIdea = useCallback((ideaId: string, status: IdeaStatus, clientNotes: string | null, reviewedByUserId: string) => {
    setIdeas(prev => prev.map(i => i.id === ideaId
      ? { ...i, status, clientNotes, reviewedAt: new Date().toISOString(), reviewedByUserId }
      : i
    ));
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
      completeTask, rejectTask, resubmitTask, updateTaskValue, saveDraftValue, deferTask, rejectFinalTask, reopenTask,
      addProject, deleteProject, toggleFreezeProject, assignToProject,
      addUser, updateUser, deleteUser, addClient, updateClient, deleteClient, setTaskDeadline,
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
