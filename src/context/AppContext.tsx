import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, Task } from '@/types';
import { USERS, PROJECTS, getInitialTasks } from '@/data/mockData';
import type { Project } from '@/types';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  projects: Project[];
  tasks: Task[];
  completeTask: (taskId: string, value: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects] = useState<Project[]>(PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(getInitialTasks());

  const completeTask = useCallback((taskId: string, value: string) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'done' as const, value, completedAt: new Date().toISOString(), completedBy: t.assignedRole };
        }
        return t;
      });

      // Unlock next task in same project
      const completedTask = updated.find(t => t.id === taskId);
      if (completedTask) {
        const nextTask = updated.find(
          t => t.projectId === completedTask.projectId && t.order === completedTask.order + 1
        );
        if (nextTask) {
          return updated.map(t =>
            t.id === nextTask.id ? { ...t, status: 'todo' as const } : t
          );
        }
      }

      return updated;
    });

    // Webhook placeholder
    console.log(`[Webhook Ready] Task ${taskId} completed with value: ${value}`);
  }, []);

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, projects, tasks, completeTask }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
