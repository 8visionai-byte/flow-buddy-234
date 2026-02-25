export type UserRole = 'admin' | 'klient' | 'influencer' | 'montazysta' | 'kierownik_planu';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type TaskStatus = 'locked' | 'todo' | 'done';
export type InputType = 'boolean' | 'text' | 'url';

export interface Task {
  id: string;
  projectId: string;
  order: number;
  assignedRole: UserRole;
  title: string;
  description: string;
  status: TaskStatus;
  inputType: InputType;
  value: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  company: string;
  clientEmail: string;
  clientPhone: string;
  currentStageIndex: number;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  klient: 'Klient',
  influencer: 'Influencer',
  montazysta: 'Montażysta',
  kierownik_planu: 'Kierownik Planu',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  klient: 'bg-success text-success-foreground',
  influencer: 'bg-warning text-warning-foreground',
  montazysta: 'bg-destructive text-destructive-foreground',
  kierownik_planu: 'bg-secondary text-secondary-foreground',
};
