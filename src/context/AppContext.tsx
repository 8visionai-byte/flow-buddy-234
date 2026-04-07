import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, Task, Project, Client, UserRole, TaskHistoryEntry, Recording, ProjectNote, ProjectPriority, Idea, IdeaStatus, Campaign } from '@/types';
import { createTasksForProject } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchAll, upsertTask, upsertTasks, upsertProject, upsertUser, deleteUserDb,
  upsertClient, deleteClientDb, deleteProjectDb, insertRecording, deleteRecordingDb,
  insertProjectNote, deleteProjectNoteDb, upsertCampaign, deleteCampaignDb,
  upsertIdea, deleteIdeaDb, hardDeleteCampaignsDb, bulkRestoreCampaignsDb,
  mapUser, mapClient, mapProject, mapTask, mapRecording, mapProjectNote, mapCampaign, mapIdea,
} from '@/lib/supabaseHelpers';

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
  toggleClientInProject: (projectId: string, userId: string) => void;
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
  addCampaign: (data: Omit<Campaign, 'id' | 'createdAt' | 'status' | 'isDeleted'>) => void;
  createDraftCampaign: (data: Partial<Omit<Campaign, 'id' | 'createdAt' | 'status' | 'isDeleted'>>) => string;
  activateCampaign: (id: string) => void;
  updateCampaign: (id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>) => void;
  deleteCampaign: (id: string) => void;
  softDeleteCampaign: (id: string) => void;
  restoreCampaign: (id: string) => void;
  hardDeleteCampaigns: (ids: string[]) => Promise<void>;
  bulkRestoreCampaigns: (ids: string[]) => Promise<void>;
  updatePartyNote: (taskId: string, role: string, note: string) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Track if realtime update is in progress to avoid echo loops
  const realtimeSkip = useRef(false);

  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserState(user);
    // persist current user selection locally (not sensitive)
    if (user) localStorage.setItem('yads_currentUser', JSON.stringify(user));
    else localStorage.removeItem('yads_currentUser');
  }, []);

  // ─── Initial load ───────────────────────────────────────────
  useEffect(() => {
    fetchAll().then(data => {
      setUsers(data.users);
      setClients(data.clients);
      setProjects(data.projects);
      setTasks(data.tasks);
      setRecordings(data.recordings);
      setProjectNotes(data.projectNotes);
      setCampaigns(data.campaigns);
      setIdeas(data.ideas);

      // Restore current user selection from localStorage
      try {
        const stored = localStorage.getItem('yads_currentUser');
        if (stored) {
          const u = JSON.parse(stored);
          const found = data.users.find(du => du.id === u.id);
          if (found) setCurrentUserState(found);
        }
      } catch {}

      setLoading(false);
    });
  }, []);

  // ─── Realtime subscriptions ─────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel('yads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== (payload.old as any).id));
        } else {
          const mapped = mapUser(payload.new);
          setUsers(prev => {
            const idx = prev.findIndex(u => u.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setClients(prev => prev.filter(c => c.id !== (payload.old as any).id));
        } else {
          const mapped = mapClient(payload.new);
          setClients(prev => {
            const idx = prev.findIndex(c => c.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setProjects(prev => prev.filter(p => p.id !== (payload.old as any).id));
        } else {
          const mapped = mapProject(payload.new);
          setProjects(prev => {
            const idx = prev.findIndex(p => p.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as any).id));
        } else {
          const mapped = mapTask(payload.new);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setRecordings(prev => prev.filter(r => r.id !== (payload.old as any).id));
        } else {
          const mapped = mapRecording(payload.new);
          setRecordings(prev => {
            const idx = prev.findIndex(r => r.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_notes' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setProjectNotes(prev => prev.filter(n => n.id !== (payload.old as any).id));
        } else {
          const mapped = mapProjectNote(payload.new);
          setProjectNotes(prev => {
            const idx = prev.findIndex(n => n.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCampaigns(prev => prev.filter(c => c.id !== (payload.old as any).id));
        } else {
          const mapped = mapCampaign(payload.new);
          setCampaigns(prev => {
            const idx = prev.findIndex(c => c.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setIdeas(prev => prev.filter(i => i.id !== (payload.old as any).id));
        } else {
          const mapped = mapIdea(payload.new);
          setIdeas(prev => {
            const idx = prev.findIndex(i => i.id === mapped.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = mapped; return n; }
            return [...prev, mapped];
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── Helper: update tasks in state + DB ─────────────────────
  const updateTasksAndSync = useCallback((updater: (prev: Task[]) => Task[]) => {
    setTasks(prev => {
      const next = updater(prev);
      // Find changed tasks and sync to DB
      const changed = next.filter(t => {
        const old = prev.find(o => o.id === t.id);
        return !old || old !== t;
      });
      if (changed.length > 0) upsertTasks(changed);
      return next;
    });
  }, []);

  // ─── Task operations (same logic, just using updateTasksAndSync) ──

  const completeTask = useCallback((taskId: string, value: string, byRole?: UserRole) => {
    updateTasksAndSync(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const role = byRole || task.assignedRole;
      const isMultiRole = task.assignedRoles.length > 1;
      const userId = currentUser?.id;

      // Script review with file notes → bounce back to influencer
      if (task.inputType === 'script_review' && value === 'approved_with_file_notes') {
        const scriptTask = prev.find(t => t.projectId === task.projectId && t.order === task.order - 1);
        const bounceEntry: TaskHistoryEntry = { action: 'rejected', by: 'klient', userId, feedback: 'Uwagi naniesione w pliku — popraw scenariusz i prześlij nowy link.', timestamp: now };
        return prev.map(t => {
          if (t.id === taskId) return { ...t, status: 'locked' as const, history: [...t.history, bounceEntry] };
          if (scriptTask && t.id === scriptTask.id) return {
            ...t, status: 'needs_influencer_revision' as const,
            clientFeedback: 'Uwagi naniesione w pliku — popraw scenariusz i prześlij nowy link.',
            assignedAt: now, completedAt: null, completedBy: null,
            history: [...t.history, bounceEntry],
          };
          return t;
        });
      }

      const entry: TaskHistoryEntry = { action: task.inputType === 'approval' ? 'approved' : 'submitted', by: role, userId, value, timestamp: now };

      // ─── CONSENSUS LOGIC for approval tasks with multiple clients ───
      if (task.inputType === 'approval' && task.status === 'pending_client_approval' && userId) {
        const project = projects.find(p => p.id === task.projectId);
        const clientIds = project?.assignedClientIds || [];

        if (clientIds.length > 1) {
          // Block duplicate vote
          if (task.clientVotes[userId]) return prev;

          const comment = value.startsWith('approved:') ? value.slice(9).trim() : '';
          const newVotes = { ...task.clientVotes, [userId]: { decision: 'approved' as const, comment, timestamp: now } };
          const allVoted = clientIds.every(cid => newVotes[cid]);

          if (!allVoted) {
            // Not all voted yet — just record vote
            return prev.map(t => t.id === taskId ? { ...t, clientVotes: newVotes, history: [...t.history, entry] } : t);
          }

          // All voted — check consensus
          const anyRejected = clientIds.some(cid => newVotes[cid]?.decision === 'rejected');
          if (anyRejected) {
            // Bounce back with combined feedback
            const combinedFeedback = clientIds
              .filter(cid => newVotes[cid]?.decision === 'rejected')
              .map(cid => {
                const userName = users.find(u => u.id === cid)?.name || cid;
                return `${userName}: ${newVotes[cid].comment}`;
              })
              .join('\n\n');
            const prevTask = prev.find(t => t.projectId === task.projectId && t.order === task.order - 1);
            const rejectEntry: TaskHistoryEntry = { action: 'rejected', by: 'klient', feedback: combinedFeedback, timestamp: now };
            return prev.map(t => {
              if (t.id === taskId) return { ...t, status: 'locked' as const, clientFeedback: combinedFeedback, clientVotes: {}, assignedAt: null, history: [...t.history, entry, rejectEntry] };
              if (prevTask && t.id === prevTask.id) return { ...t, status: 'needs_influencer_revision' as const, clientFeedback: combinedFeedback, assignedAt: now, completedAt: null, completedBy: null, history: [...t.history, rejectEntry] };
              return t;
            });
          }

          // All approved — update votes and fall through to normal completion logic
          // We need to update the task's clientVotes before proceeding
          prev = prev.map(t => t.id === taskId ? { ...t, clientVotes: newVotes } : t);
          // Re-find the task with updated votes
          // Fall through to normal single-role completion below
        }
      }

      let prevTask: Task | undefined = undefined;
      if (task.inputType === 'approval') {
        for (let o = task.order - 1; o >= 0; o--) {
          const candidate = prev.find(t => t.projectId === task.projectId && t.order === o);
          if (candidate && candidate.inputType !== 'approval') { prevTask = candidate; break; }
        }
      }

      if (isMultiRole) {
        const newCompletions = { ...task.roleCompletions, [role]: value };
        const allDone = task.assignedRoles.every(r => newCompletions[r]);

        if (allDone) {
          const updated = prev.map(t => {
            if (t.id === taskId) return { ...t, status: 'done' as const, value: JSON.stringify(newCompletions), completedAt: now, completedBy: role, history: [...t.history, entry], roleCompletions: newCompletions };
            if (prevTask && t.id === prevTask.id) return { ...t, history: [...t.history, entry] };
            return t;
          });
          const completedTask = updated.find(t => t.id === taskId)!;
          const projectTasks = updated.filter(t => t.projectId === completedTask.projectId).sort((a, b) => a.order - b.order);
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
          return prev.map(t => {
            if (t.id === taskId) return { ...t, roleCompletions: newCompletions, history: [...t.history, entry] };
            return t;
          });
        }
      }

      // Single-role task
      let operatorNote: string | null = null;
      if (task.inputType === 'raw_footage') {
        try { const p = JSON.parse(value); operatorNote = p.notes?.trim() || null; } catch {}
      }
      const uwagTaskId = operatorNote
        ? prev.find(t => t.projectId === task.projectId && t.title === 'Wnieś uwagi przed montażem' && !t.roleCompletions['operator'])?.id
        : null;

      const updated = prev.map(t => {
        if (t.id === taskId) return { ...t, status: 'done' as const, value, completedAt: now, completedBy: t.assignedRole, history: [...t.history, entry] };
        if (prevTask && t.id === prevTask.id) return { ...t, history: [...t.history, entry] };
        if (uwagTaskId && t.id === uwagTaskId) return { ...t, roleCompletions: { ...t.roleCompletions, operator: operatorNote! } };
        return t;
      });

      const completedTask = updated.find(t => t.id === taskId)!;
      const projectTasks = updated.filter(t => t.projectId === completedTask.projectId).sort((a, b) => a.order - b.order);

      if (completedTask.inputType === 'approval') {
        let groupStart = completedTask.order;
        while (groupStart > 0) {
          const p = projectTasks.find(t => t.order === groupStart - 1);
          if (p && p.inputType === 'approval') groupStart--;
          else break;
        }
        let groupEnd = completedTask.order;
        while (true) {
          const next = projectTasks.find(t => t.order === groupEnd + 1);
          if (next && next.inputType === 'approval') groupEnd++;
          else break;
        }
        const allGroupDone = projectTasks.filter(t => t.order >= groupStart && t.order <= groupEnd).every(t => t.status === 'done');
        if (allGroupDone) {
          const nextAfterGroup = projectTasks.find(t => t.order === groupEnd + 1);
          if (nextAfterGroup && nextAfterGroup.status === 'locked') {
            const newStatus = nextAfterGroup.inputType === 'approval' ? 'pending_client_approval' as const : 'todo' as const;
            return updated.map(t => t.id === nextAfterGroup.id ? { ...t, status: newStatus, previousValue: completedTask.value || value, assignedAt: now } : t);
          }
        }
        return updated;
      }

      const nextTasksToUnlock: { id: string; prevValue: string }[] = [];
      for (let o = completedTask.order + 1; ; o++) {
        const t = projectTasks.find(pt => pt.order === o);
        if (!t || t.status !== 'locked') break;
        if (t.inputType !== 'approval' && nextTasksToUnlock.length > 0) break;
        const sourceOrder = completedTask.order - nextTasksToUnlock.length;
        const sourceTask = projectTasks.find(pt => pt.order === sourceOrder);
        nextTasksToUnlock.push({ id: t.id, prevValue: sourceTask?.value || completedTask.value || value });
        if (t.inputType !== 'approval') break;
      }

      if (nextTasksToUnlock.length > 0) {
        const approvalCount = nextTasksToUnlock.length;
        const sourceTasks: { value: string | null }[] = [];
        for (let o = completedTask.order; o >= 0 && sourceTasks.length < approvalCount; o--) {
          const st = projectTasks.find(pt => pt.order === o);
          if (st && st.inputType !== 'approval' && st.status === 'done') sourceTasks.unshift(st);
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

        if (completedTask.title === 'Weryfikuj film na frame.io' && value === 'approved') {
          const poprawki = unlocked.find(t => t.projectId === completedTask.projectId && t.title === 'Wgraj poprawki');
          const akceptacja = unlocked.find(t => t.projectId === completedTask.projectId && t.title === 'Akceptacja materiału');
          if (poprawki && akceptacja) {
            const opisyTask = unlocked.find(t => t.projectId === completedTask.projectId && t.title === 'Opisy i tytuły do publikacji');
            return unlocked.map(t => {
              if (t.id === poprawki.id) return { ...t, status: 'done' as const, value: 'skipped', completedAt: now };
              if (t.id === akceptacja.id) return { ...t, status: 'done' as const, value: 'approved', completedAt: now, assignedAt: now };
              if (opisyTask && t.id === opisyTask.id) return { ...t, status: 'todo' as const, assignedAt: now };
              return t;
            });
          }
        }

        if (completedTask.title === 'Nadaj priorytet montażu') {
          const slaMap: Record<string, number> = { high: 48, medium: 96, low: 168 };
          const slaHours = slaMap[value] ?? 96;
          const deadline = new Date(Date.now() + slaHours * 3600000).toISOString();
          return unlocked.map(t =>
            (t.title === 'Wgraj zmontowany film' && t.projectId === completedTask.projectId && t.status === 'todo')
              ? { ...t, deadlineDate: deadline } : t
          );
        }
        return unlocked;
      }

      if (completedTask.title === 'Weryfikuj film na frame.io' && value === 'approved') {
        const poprawki = updated.find(t => t.projectId === completedTask.projectId && t.title === 'Wgraj poprawki');
        const akceptacja = updated.find(t => t.projectId === completedTask.projectId && t.title === 'Akceptacja materiału');
        if (poprawki && akceptacja) {
          const opisyTask = updated.find(t => t.projectId === completedTask.projectId && t.title === 'Opisy i tytuły do publikacji');
          return updated.map(t => {
            if (t.id === poprawki.id) return { ...t, status: 'done' as const, value: 'skipped', completedAt: now };
            if (t.id === akceptacja.id) return { ...t, status: 'done' as const, value: 'approved', completedAt: now, assignedAt: now };
            if (opisyTask && t.id === opisyTask.id) return { ...t, status: 'todo' as const, assignedAt: now };
            return t;
          });
        }
      }

      return updated;
    });
  }, [updateTasksAndSync, currentUser, projects, users]);

  const rejectTask = useCallback((taskId: string, feedback: string) => {
    updateTasksAndSync(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const userId = currentUser?.id;

      // ─── CONSENSUS: record reject vote ───
      if (task.inputType === 'approval' && task.status === 'pending_client_approval' && userId) {
        const project = projects.find(p => p.id === task.projectId);
        const clientIds = project?.assignedClientIds || [];

        if (clientIds.length > 1) {
          // Block duplicate vote
          if (task.clientVotes[userId]) return prev;

          const newVotes = { ...task.clientVotes, [userId]: { decision: 'rejected' as const, comment: feedback, timestamp: now } };
          const rejectEntry: TaskHistoryEntry = { action: 'rejected', by: task.assignedRole, userId, feedback, timestamp: now };
          const allVoted = clientIds.every(cid => newVotes[cid]);

          if (!allVoted) {
            // Not all voted yet — just record reject vote
            return prev.map(t => t.id === taskId ? { ...t, clientVotes: newVotes, history: [...t.history, rejectEntry] } : t);
          }

          // All voted — bounce back with combined feedback from ALL rejectors
          const combinedFeedback = clientIds
            .filter(cid => newVotes[cid]?.decision === 'rejected')
            .map(cid => {
              const userName = users.find(u => u.id === cid)?.name || cid;
              return `${userName}: ${newVotes[cid].comment}`;
            })
            .join('\n\n');
          const prevTask = prev.find(t => t.projectId === task.projectId && t.order === task.order - 1);
          return prev.map(t => {
            if (t.id === taskId) return { ...t, status: 'locked' as const, clientFeedback: combinedFeedback, clientVotes: {}, assignedAt: null, history: [...t.history, rejectEntry] };
            if (prevTask && t.id === prevTask.id) return { ...t, status: 'needs_influencer_revision' as const, clientFeedback: combinedFeedback, assignedAt: now, completedAt: null, completedBy: null, history: [...t.history, rejectEntry] };
            return t;
          });
        }
      }

      // Single client — original logic
      const prevTask = prev.find(t => t.projectId === task.projectId && t.order === task.order - 1);
      const entry: TaskHistoryEntry = { action: 'rejected', by: task.assignedRole, userId, feedback, timestamp: now };
      return prev.map(t => {
        if (t.id === taskId) return { ...t, status: 'locked' as const, clientFeedback: feedback, clientVotes: {}, assignedAt: null, history: [...t.history, entry] };
        if (prevTask && t.id === prevTask.id) return { ...t, status: 'needs_influencer_revision' as const, clientFeedback: feedback, assignedAt: now, completedAt: null, completedBy: null, history: [...t.history, entry] };
        return t;
      });
    });
  }, [updateTasksAndSync, currentUser, projects, users]);

  const deferTask = useCallback((taskId: string) => {
    updateTasksAndSync(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const entry: TaskHistoryEntry = { action: 'deferred', by: 'klient', timestamp: new Date().toISOString() };
      return prev.map(t => t.id === taskId ? { ...t, status: 'deferred' as const, history: [...t.history, entry] } : t);
    });
  }, [updateTasksAndSync]);

  const rejectFinalTask = useCallback((taskId: string, reason?: string) => {
    updateTasksAndSync(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const entry: TaskHistoryEntry = { action: 'rejected_final', by: 'klient', feedback: reason || undefined, timestamp: new Date().toISOString() };
      return prev.map(t => t.id === taskId ? { ...t, status: 'rejected_final' as const, clientFeedback: reason || null, history: [...t.history, entry] } : t);
    });
  }, [updateTasksAndSync]);

  const resubmitTask = useCallback((taskId: string, newValue: string) => {
    updateTasksAndSync(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const entry: TaskHistoryEntry = { action: 'resubmitted', by: task.assignedRole, value: newValue, timestamp: now };
      const nextTask = prev.find(t => t.projectId === task.projectId && t.order === task.order + 1);
      return prev.map(t => {
        if (t.id === taskId) return { ...t, status: 'done' as const, value: newValue, completedAt: now, completedBy: t.assignedRole, clientFeedback: null, history: [...t.history, entry] };
        if (nextTask && t.id === nextTask.id) return { ...t, status: 'pending_client_approval' as const, previousValue: newValue, clientFeedback: null, clientVotes: {}, assignedAt: now, history: [...t.history, entry] };
        return t;
      });
    });
  }, [updateTasksAndSync]);

  const updateTaskValue = useCallback((taskId: string, newValue: string) => {
    updateTasksAndSync(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const now = new Date().toISOString();
      const nextApproval = prev.find(t => t.projectId === task.projectId && t.order === task.order + 1 && (t.status === 'pending_client_approval' || t.status === 'todo'));
      return prev.map(t => {
        if (t.id === taskId) return { ...t, value: newValue, completedAt: now };
        if (nextApproval && t.id === nextApproval.id) return { ...t, previousValue: newValue };
        return t;
      });
    });
  }, [updateTasksAndSync]);

  const saveDraftValue = useCallback((taskId: string, value: string) => {
    updateTasksAndSync(prev => prev.map(t => t.id === taskId ? { ...t, value } : t));
  }, [updateTasksAndSync]);

  const reopenTask = useCallback((taskId: string) => {
    updateTasksAndSync(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task || task.status !== 'done') return prev;
      return prev.map(t => {
        if (t.id === taskId) return { ...t, status: 'todo' as const, completedAt: null, completedBy: null, value: null, assignedAt: new Date().toISOString() };
        if (t.projectId === task.projectId && t.order === task.order + 1 && t.status !== 'done') return { ...t, status: 'locked' as const, assignedAt: null };
        return t;
      });
    });
  }, [updateTasksAndSync]);

  const setTaskDeadline = useCallback((taskId: string, date: string | null) => {
    updateTasksAndSync(prev => prev.map(t => t.id === taskId ? { ...t, deadlineDate: date } : t));
  }, [updateTasksAndSync]);

  const updatePartyNote = useCallback((taskId: string, role: string, note: string) => {
    updateTasksAndSync(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, roleCompletions: { ...t.roleCompletions, [role]: note } };
    }));
  }, [updateTasksAndSync]);

  // ─── Project operations ─────────────────────────────────────

  const addProject = useCallback((data: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId' | 'publicationDate' | 'priority' | 'slaHours'>) => {
    const id = `p${Date.now()}`;
    const newProject: Project = { ...data, id, currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, assignedOperatorId: null, publicationDate: null, priority: 'medium', slaHours: 48, assignedClientIds: data.assignedClientIds || [] };
    setProjects(prev => [...prev, newProject]);
    upsertProject(newProject);
    const newTasks = createTasksForProject(id, 0);
    setTasks(prev => [...prev, ...newTasks]);
    upsertTasks(newTasks);
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setTasks(prev => prev.filter(t => t.projectId !== projectId));
    deleteProjectDb(projectId);
  }, []);

  const toggleFreezeProject = useCallback((projectId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, status: p.status === 'frozen' ? 'active' as const : 'frozen' as const } : p);
      const changed = updated.find(p => p.id === projectId);
      if (changed) upsertProject(changed);
      return updated;
    });
  }, []);

  const assignToProject = useCallback((projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'assignedOperatorId', userId: string | null) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const newP = { ...p, [field]: userId };
        // Sync assignedClientIds when assignedClientId changes
        if (field === 'assignedClientId') {
          if (userId && !newP.assignedClientIds.includes(userId)) {
            newP.assignedClientIds = [...newP.assignedClientIds, userId];
          }
        }
        return newP;
      });
      const changed = updated.find(p => p.id === projectId);
      if (changed) upsertProject(changed);
      return updated;
    });
  }, []);

  const toggleClientInProject = useCallback((projectId: string, userId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const has = p.assignedClientIds.includes(userId);
        const newIds = has ? p.assignedClientIds.filter(id => id !== userId) : [...p.assignedClientIds, userId];
        return { ...p, assignedClientIds: newIds };
      });
      const changed = updated.find(p => p.id === projectId);
      if (changed) upsertProject(changed);
      return updated;
    });
  }, []);

  const setPublicationDate = useCallback((projectId: string, date: string | null) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, publicationDate: date } : p);
      const changed = updated.find(p => p.id === projectId);
      if (changed) upsertProject(changed);
      return updated;
    });
  }, []);

  const setProjectPriority = useCallback((projectId: string, priority: ProjectPriority) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, priority } : p);
      const changed = updated.find(p => p.id === projectId);
      if (changed) upsertProject(changed);
      return updated;
    });
  }, []);

  const setProjectSla = useCallback((projectId: string, hours: number | null) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, slaHours: hours } : p);
      const changed = updated.find(p => p.id === projectId);
      if (changed) upsertProject(changed);
      return updated;
    });
  }, []);

  // ─── User CRUD ──────────────────────────────────────────────

  const addUser = useCallback((data: Omit<User, 'id'>): string => {
    const id = `u${Date.now()}`;
    const newUser = { ...data, id };
    setUsers(prev => [...prev, newUser]);
    upsertUser(newUser);
    return id;
  }, []);

  const updateUser = useCallback((id: string, data: Partial<Omit<User, 'id'>>) => {
    setUsers(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, ...data } : u);
      const changed = updated.find(u => u.id === id);
      if (changed) upsertUser(changed);
      return updated;
    });
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    deleteUserDb(id);
  }, []);

  // ─── Client CRUD ────────────────────────────────────────────

  const addClient = useCallback((data: Omit<Client, 'id' | 'createdAt'>): string => {
    const id = `c${Date.now()}`;
    const newClient = { ...data, id, createdAt: new Date().toISOString() };
    setClients(prev => [...prev, newClient]);
    upsertClient(newClient);
    return id;
  }, []);

  const updateClient = useCallback((id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>) => {
    setClients(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...data } : c);
      const changed = updated.find(c => c.id === id);
      if (changed) upsertClient(changed);
      return updated;
    });
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    deleteClientDb(id);
  }, []);

  // ─── Recordings ─────────────────────────────────────────────

  const addRecording = useCallback((projectId: string, url: string, note: string) => {
    const newRec: Recording = { id: `rec${Date.now()}`, projectId, url, note, createdAt: new Date().toISOString() };
    setRecordings(prev => [...prev, newRec]);
    insertRecording(newRec);
  }, []);

  const deleteRecording = useCallback((recordingId: string) => {
    setRecordings(prev => prev.filter(r => r.id !== recordingId));
    deleteRecordingDb(recordingId);
  }, []);

  // ─── Project Notes ──────────────────────────────────────────

  const addProjectNote = useCallback((projectId: string, content: string) => {
    const newNote: ProjectNote = { id: `note${Date.now()}`, projectId, content, createdAt: new Date().toISOString() };
    setProjectNotes(prev => [...prev, newNote]);
    insertProjectNote(newNote);
  }, []);

  const deleteProjectNote = useCallback((noteId: string) => {
    setProjectNotes(prev => prev.filter(n => n.id !== noteId));
    deleteProjectNoteDb(noteId);
  }, []);

  // ─── Ideas ──────────────────────────────────────────────────

  const addIdea = useCallback((campaignId: string, title: string, description: string, createdByUserId: string) => {
    const idea: Idea = {
      id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      campaignId, resultingProjectId: null, title, description, createdByUserId,
      createdAt: new Date().toISOString(), status: 'pending',
      clientNotes: null, reviewedAt: null, reviewedByUserId: null,
    };
    setIdeas(prev => [...prev, idea]);
    upsertIdea(idea);
  }, []);

  const updateIdea = useCallback((ideaId: string, title: string, description: string) => {
    setIdeas(prev => {
      const updated = prev.map(i => i.id === ideaId ? { ...i, title, description } : i);
      const changed = updated.find(i => i.id === ideaId);
      if (changed) upsertIdea(changed);
      return updated;
    });
  }, []);

  const deleteIdea = useCallback((ideaId: string) => {
    setIdeas(prev => prev.filter(i => i.id !== ideaId));
    deleteIdeaDb(ideaId);
  }, []);

  const reviewIdea = useCallback((ideaId: string, status: IdeaStatus, clientNotes: string | null, reviewedByUserId: string) => {
    setIdeas(prev => {
      const updated = prev.map(i => i.id === ideaId ? { ...i, status, clientNotes, reviewedAt: new Date().toISOString(), reviewedByUserId } : i);
      const changed = updated.find(i => i.id === ideaId);
      if (changed) upsertIdea(changed);
      return updated;
    });
  }, []);

  const acceptIdeaAsProject = useCallback((ideaId: string) => {
    setTimeout(() => {
      setIdeas(prevIdeas => {
        const idea = prevIdeas.find(i => i.id === ideaId);
        if (!idea || idea.resultingProjectId) return prevIdeas;

        const newProjectId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date().toISOString();
        const SCRIPT_STAGE = 2;

        setCampaigns(prevCamps => {
          const camp = prevCamps.find(c => c.id === idea.campaignId);
          if (camp) {
            const newProject: Project = {
              id: newProjectId, name: idea.title, clientId: camp.clientId,
              clientName: '', company: '', clientEmail: '', clientPhone: '',
              currentStageIndex: SCRIPT_STAGE, status: 'active',
              assignedInfluencerId: camp.assignedInfluencerId, assignedEditorId: null,
              assignedClientId: camp.assignedClientUserId, assignedClientIds: camp.assignedClientUserId ? [camp.assignedClientUserId] : [],
              assignedKierownikId: null,
              assignedOperatorId: null, publicationDate: null, priority: 'medium', slaHours: camp.slaHours || 48,
            };
            setProjects(p => [...p, newProject]);
            upsertProject(newProject);

            const ideaText = [idea.title, idea.description].filter(Boolean).join('\n\n');
            const baseTasks = createTasksForProject(newProjectId, SCRIPT_STAGE);
            const patchedTasks = baseTasks.map(t => {
              if (t.order === 0) return { ...t, value: ideaText, completedAt: now, completedBy: 'influencer', history: [{ action: 'submitted' as const, by: 'influencer' as const, value: ideaText, timestamp: now }] };
              if (t.order === 1) return { ...t, value: 'approved', previousValue: ideaText, completedAt: now, completedBy: 'klient', history: [{ action: 'approved' as const, by: 'klient' as const, value: 'approved', timestamp: now }] };
              return t;
            });
            setTasks(t => [...t, ...patchedTasks]);
            upsertTasks(patchedTasks);
          }
          return prevCamps;
        });

        const updatedIdeas = prevIdeas.map(i => i.id === ideaId ? { ...i, resultingProjectId: newProjectId } : i);
        const changedIdea = updatedIdeas.find(i => i.id === ideaId);
        if (changedIdea) upsertIdea(changedIdea);
        return updatedIdeas;
      });
    }, 0);
  }, []);

  // ─── Campaigns ──────────────────────────────────────────────

  const addCampaign = useCallback((data: Omit<Campaign, 'id' | 'createdAt' | 'status' | 'isDeleted'>) => {
    const campaign: Campaign = {
      ...data, id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(), status: 'awaiting_ideas', isDeleted: false,
    };
    setCampaigns(prev => [...prev, campaign]);
    upsertCampaign(campaign);
  }, []);

  const createDraftCampaign = useCallback((data: Partial<Omit<Campaign, 'id' | 'createdAt' | 'status' | 'isDeleted'>>): string => {
    const id = `camp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const campaign: Campaign = {
      clientId: data.clientId || '',
      assignedInfluencerId: data.assignedInfluencerId || '',
      assignedClientUserId: data.assignedClientUserId ?? null,
      reviewerIds: data.reviewerIds || [],
      targetIdeaCount: data.targetIdeaCount || 12,
      slaHours: data.slaHours || 48,
      briefNotes: data.briefNotes || '',
      id,
      createdAt: new Date().toISOString(),
      status: 'draft',
      isDeleted: false,
    };
    setCampaigns(prev => [...prev, campaign]);
    upsertCampaign(campaign);
    return id;
  }, []);

  const activateCampaign = useCallback((id: string) => {
    setCampaigns(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, status: 'awaiting_ideas' as const, createdAt: new Date().toISOString() } : c);
      const changed = updated.find(c => c.id === id);
      if (changed) upsertCampaign(changed);
      return updated;
    });
  }, []);

  const updateCampaign = useCallback((id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>) => {
    setCampaigns(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...data } : c);
      const changed = updated.find(c => c.id === id);
      if (changed) upsertCampaign(changed);
      return updated;
    });
  }, []);

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setIdeas(prev => prev.filter(i => i.campaignId !== id));
    deleteCampaignDb(id);
  }, []);

  const softDeleteCampaign = useCallback((id: string) => {
    setCampaigns(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, isDeleted: true } : c);
      const changed = updated.find(c => c.id === id);
      if (changed) upsertCampaign(changed);
      return updated;
    });
  }, []);

  const restoreCampaign = useCallback((id: string) => {
    setCampaigns(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, isDeleted: false } : c);
      const changed = updated.find(c => c.id === id);
      if (changed) upsertCampaign(changed);
      return updated;
    });
  }, []);

  const hardDeleteCampaigns = useCallback(async (ids: string[]) => {
    setCampaigns(prev => prev.filter(c => !ids.includes(c.id)));
    setIdeas(prev => prev.filter(i => !ids.includes(i.campaignId)));
    await hardDeleteCampaignsDb(ids);
  }, []);

  const bulkRestoreCampaigns = useCallback(async (ids: string[]) => {
    setCampaigns(prev => prev.map(c => ids.includes(c.id) ? { ...c, isDeleted: false } : c));
    await bulkRestoreCampaignsDb(ids);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Ładowanie danych...</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, clients, projects, tasks, recordings, projectNotes,
      completeTask, rejectTask, resubmitTask, updateTaskValue, saveDraftValue, deferTask, rejectFinalTask, reopenTask,
      addProject, deleteProject, toggleFreezeProject, assignToProject, toggleClientInProject,
      addUser, updateUser, deleteUser, addClient, updateClient, deleteClient, setTaskDeadline,
      addRecording, deleteRecording, addProjectNote, deleteProjectNote, setPublicationDate, setProjectPriority, setProjectSla,
      ideas, addIdea, updateIdea, deleteIdea, reviewIdea, acceptIdeaAsProject,
      campaigns, addCampaign, createDraftCampaign, activateCampaign, updateCampaign, deleteCampaign, softDeleteCampaign, restoreCampaign, hardDeleteCampaigns, bulkRestoreCampaigns,
      updatePartyNote, loading,
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
