import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, Task, Project, UserRole, TaskHistoryEntry } from '@/types';
import { INITIAL_USERS, INITIAL_PROJECTS, getInitialTasks, createTasksForProject } from '@/data/mockData';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  projects: Project[];
  tasks: Task[];
  completeTask: (taskId: string, value: string) => void;
  rejectTask: (taskId: string, feedback: string) => void;
  resubmitTask: (taskId: string, newValue: string) => void;
  addProject: (project: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId'>) => void;
  reopenTask: (taskId: string) => void;
  deleteProject: (projectId: string) => void;
  toggleFreezeProject: (projectId: string) => void;
  assignToProject: (projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId', userId: string | null) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, data: Partial<Omit<User, 'id'>>) => void;
  deleteUser: (id: string) => void;
  setTaskDeadline: (taskId: string, date: string | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(getInitialTasks());

  const completeTask = useCallback((taskId: string, value: string) => {
    setTasks(prev => {
      const now = new Date().toISOString();
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const entry: TaskHistoryEntry = { action: task.inputType === 'approval' ? 'approved' : 'submitted', by: task.assignedRole, value, timestamp: now };
      
      // Also propagate approval history back to the previous task (so influencer sees it)
      const prevTask = task.inputType === 'approval' ? prev.find(
        t => t.projectId === task.projectId && t.order === task.order - 1
      ) : null;

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
      const nextTask = updated.find(
        t => t.projectId === completedTask.projectId && t.order === completedTask.order + 1
      );
      if (nextTask) {
        const newStatus = nextTask.inputType === 'approval' ? 'pending_client_approval' as const : 'todo' as const;
        return updated.map(t =>
          t.id === nextTask.id ? { ...t, status: newStatus, previousValue: completedTask.value || value, assignedAt: now, history: [...t.history, entry] } : t
        );
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

  const addProject = useCallback((data: Omit<Project, 'id' | 'currentStageIndex' | 'status' | 'assignedInfluencerId' | 'assignedEditorId'>) => {
    const id = `p${Date.now()}`;
    const newProject: Project = { ...data, id, currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null };
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

  const assignToProject = useCallback((projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId', userId: string | null) => {
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

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, projects, tasks,
      completeTask, rejectTask, resubmitTask, reopenTask,
      addProject, deleteProject, toggleFreezeProject, assignToProject,
      addUser, updateUser, deleteUser, setTaskDeadline,
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
