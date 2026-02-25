export type UserRole = 'admin' | 'klient' | 'influencer' | 'montazysta' | 'kierownik_planu';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type TaskStatus = 'locked' | 'todo' | 'done' | 'pending_client_approval' | 'needs_influencer_revision';
export type InputType = 'boolean' | 'text' | 'url' | 'approval';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStatus = 'active' | 'frozen';

export interface TaskHistoryEntry {
  action: 'submitted' | 'approved' | 'rejected' | 'resubmitted';
  by: UserRole;
  value?: string | null;
  feedback?: string | null;
  timestamp: string;
}

export interface Task {
  id: string;
  projectId: string;
  order: number;
  assignedRole: UserRole;
  assignedRoles: UserRole[];
  title: string;
  description: string;
  status: TaskStatus;
  inputType: InputType;
  value: string | null;
  previousValue: string | null;
  clientFeedback: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  deadlineDate: string | null;
  history: TaskHistoryEntry[];
  roleCompletions: Record<string, string>;
}

export interface Recording {
  id: string;
  projectId: string;
  url: string;
  note: string;
  createdAt: string;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  company: string;
  clientEmail: string;
  clientPhone: string;
  currentStageIndex: number;
  status: ProjectStatus;
  assignedInfluencerId: string | null;
  assignedEditorId: string | null;
  publicationDate: string | null;
  priority: ProjectPriority;
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

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: 'Niski',
  medium: 'Średni',
  high: 'Wysoki',
  urgent: 'Pilny',
};

export const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};
