import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, Task, Project, UserRole } from '@/types';
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
  deleteProject: (projectId: string) => void;
  toggleFreezeProject: (projectId: string) => void;
  assignToProject: (projectId: string, field: 'assignedInfluencerId' | 'assignedEditorId', userId: string | null) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, data: Partial<Omit<User, 'id'>>) => void;
  deleteUser: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(getInitialTasks());

  const completeTask = useCallback((taskId: string, value: string) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id === taskId) {
          // If this is an approval-type task (inputType === 'approval'), accepting means done
          return { ...t, status: 'done' as const, value, completedAt: new Date().toISOString(), completedBy: t.assignedRole };
        }
        return t;
      });

      const completedTask = updated.find(t => t.id === taskId);
      if (completedTask) {
        // For text/url tasks that feed into an approval step:
        // If the NEXT task is an approval task, set it to pending_client_approval
        const nextTask = updated.find(
          t => t.projectId === completedTask.projectId && t.order === completedTask.order + 1
        );
        if (nextTask) {
          const newStatus = nextTask.inputType === 'approval' ? 'pending_client_approval' as const : 'todo' as const;
          return updated.map(t =>
            t.id === nextTask.id ? { ...t, status: newStatus, previousValue: completedTask.value || value, assignedAt: new Date().toISOString() } : t
          );
        }
      }

      return updated;
    });
  }, []);

  // Client rejects: task bounces back to influencer
  const rejectTask = useCallback((taskId: string, feedback: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      // Find the preceding task (the one influencer submitted)
      const prevTask = prev.find(
        t => t.projectId === task.projectId && t.order === task.order - 1
      );

      return prev.map(t => {
        if (t.id === taskId) {
          // Mark current approval task as needing revision (reset it)
          return { ...t, status: 'locked' as const, clientFeedback: feedback, assignedAt: null };
        }
        if (prevTask && t.id === prevTask.id) {
          // Reopen the influencer's task with feedback
          return {
            ...t,
            status: 'needs_influencer_revision' as const,
            clientFeedback: feedback,
            assignedAt: new Date().toISOString(),
            completedAt: null,
            completedBy: null,
          };
        }
        return t;
      });
    });
  }, []);

  // Influencer resubmits after revision
  const resubmitTask = useCallback((taskId: string, newValue: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const nextTask = prev.find(
        t => t.projectId === task.projectId && t.order === task.order + 1
      );

      return prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'done' as const, value: newValue, completedAt: new Date().toISOString(), completedBy: t.assignedRole, clientFeedback: null };
        }
        if (nextTask && t.id === nextTask.id) {
          return { ...t, status: 'pending_client_approval' as const, previousValue: newValue, clientFeedback: null, assignedAt: new Date().toISOString() };
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

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, projects, tasks,
      completeTask, rejectTask, resubmitTask,
      addProject, deleteProject, toggleFreezeProject, assignToProject,
      addUser, updateUser, deleteUser,
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
