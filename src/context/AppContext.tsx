import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Task, Project, UserRole, TaskHistoryEntry, Recording, ProjectNote, ProjectPriority } from '@/types';
import { INITIAL_USERS, INITIAL_PROJECTS, getInitialTasks, createTasksForProject } from '@/data/mockData';

// localStorage helpers
const STORAGE_KEYS = {
  currentUser: 'yads_currentUser',
  users: 'yads_users',
  projects: 'yads_projects',
  tasks: 'yads_tasks',
  recordings: 'yads_recordings',
  projectNotes: 'yads_projectNotes',
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
  projects: Project[];
  tasks: Task[];
  recordings: Recording[];
  projectNotes: ProjectNote[];
  completeTask: (taskId: string, value: string, byRole?: UserRole) => void;
  rejectTask: (taskId: string, feedback: string) => void;
  resubmitTask: (taskId: string, newValue: string) => void;
  addProject: (project: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'publicationDate' | 'priority'>) => void;
  reopenTask: (taskId: string) => void;
  deleteProject: (projectId: string) => void;
  toggleFreezeProject: (projectId: string) => void;
  assignToProject: (projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId', userId: string | null) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, data: Partial<Omit<User, 'id'>>) => void;
  deleteUser: (id: string) => void;
  setTaskDeadline: (taskId: string, date: string | null) => void;
  addRecording: (projectId: string, url: string, note: string) => void;
  deleteRecording: (recordingId: string) => void;
  addProjectNote: (projectId: string, content: string) => void;
  deleteProjectNote: (noteId: string) => void;
  setPublicationDate: (projectId: string, date: string | null) => void;
  setProjectPriority: (projectId: string, priority: ProjectPriority) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromStorage(STORAGE_KEYS.currentUser, null));
  const [users, setUsers] = useState<User[]>(() => loadFromStorage(STORAGE_KEYS.users, INITIAL_USERS));
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage(STORAGE_KEYS.projects, INITIAL_PROJECTS));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(STORAGE_KEYS.tasks, getInitialTasks()));
  const [recordings, setRecordings] = useState<Recording[]>(() => loadFromStorage(STORAGE_KEYS.recordings, []));
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>(() => loadFromStorage(STORAGE_KEYS.projectNotes, []));

  // Persist to localStorage on every change
  useEffect(() => { saveToStorage(STORAGE_KEYS.currentUser, currentUser); }, [currentUser]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.users, users); }, [users]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.projects, projects); }, [projects]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.tasks, tasks); }, [tasks]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.recordings, recordings); }, [recordings]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.projectNotes, projectNotes); }, [projectNotes]);

  const completeTask = useCallback((taskId: string, value: string, byRole?: UserRole) => {
    setTasks(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const role = byRole || task.assignedRole;
      const isMultiRole = task.assignedRoles.length > 1;

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
      const updated = prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'done' as const, value, completedAt: now, completedBy: t.assignedRole, history: [...t.history, entry] };
        }
        if (prevTask && t.id === prevTask.id) {
          return { ...t, history: [...t.history, entry] };
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
        
        return updated.map(t => {
          if (unlockMap.has(t.id)) {
            const newStatus = t.inputType === 'approval' ? 'pending_client_approval' as const : 'todo' as const;
            return { ...t, status: newStatus, previousValue: unlockMap.get(t.id)!, assignedAt: now };
          }
          return t;
        });
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

  const addProject = useCallback((data: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId' | 'publicationDate' | 'priority'>) => {
    const id = `p${Date.now()}`;
    const newProject: Project = { ...data, id, currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, publicationDate: null, priority: 'medium' };
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

  const assignToProject = useCallback((projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId' | 'assignedClientId' | 'assignedKierownikId', userId: string | null) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, [field]: userId } : p
    ));
  }, []);

  const addUser = useCallback((data: Omit<User, 'id'>) => {
    const id = `u${Date.now()}`;
    setUsers(prev => [...prev, { ...data, id }]);
  }, []);

  const updateUser = useCallback((id: string, data: Partial<Omit<User, 'id'>>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
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

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, projects, tasks, recordings, projectNotes,
      completeTask, rejectTask, resubmitTask, reopenTask,
      addProject, deleteProject, toggleFreezeProject, assignToProject,
      addUser, updateUser, deleteUser, setTaskDeadline,
      addRecording, deleteRecording, addProjectNote, deleteProjectNote, setPublicationDate, setProjectPriority,
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
