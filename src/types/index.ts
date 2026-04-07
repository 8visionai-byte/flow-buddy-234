export type UserRole = 'admin' | 'klient' | 'influencer' | 'montazysta' | 'kierownik_planu' | 'operator' | 'publikator';

export interface Client {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  clientId?: string | null; // for klient role: links this login account to a Client (company)
}

export type TaskStatus = 'locked' | 'todo' | 'done' | 'pending_client_approval' | 'needs_influencer_revision' | 'deferred' | 'rejected_final';
export type InputType = 'boolean' | 'text' | 'url' | 'approval' | 'social_descriptions' | 'social_dates' | 'publication_confirm' | 'actor_assignment' | 'filming_confirmation' | 'raw_footage' | 'multi_party_notes' | 'frameio_review' | 'script_review';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStatus = 'active' | 'frozen';

export interface TaskHistoryEntry {
  action: 'submitted' | 'approved' | 'rejected' | 'resubmitted' | 'deferred' | 'rejected_final';
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
  clientId: string | null;
  // legacy inline fields (kept for backward compat with localStorage)
  clientName: string;
  company: string;
  clientEmail: string;
  clientPhone: string;
  currentStageIndex: number;
  status: ProjectStatus;
  assignedInfluencerId: string | null;
  assignedEditorId: string | null;
  assignedClientId: string | null;
  assignedKierownikId: string | null;
  assignedOperatorId: string | null;
  publicationDate: string | null;
  priority: ProjectPriority;
  slaHours: number | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  klient: 'Klient',
  influencer: 'Influencer',
  montazysta: 'Montażysta',
  kierownik_planu: 'Kierownik Planu',
  operator: 'Operator',
  publikator: 'Publikator',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  klient: 'bg-success text-success-foreground',
  influencer: 'bg-warning text-warning-foreground',
  montazysta: 'bg-destructive text-destructive-foreground',
  kierownik_planu: 'bg-secondary text-secondary-foreground',
  operator: 'bg-accent text-accent-foreground',
  publikator: 'bg-purple-500 text-white',
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

// ─── Actor assignment ────────────────────────────────────────────────────────
export type ActorSourceType = 'client_contact' | 'client_user' | 'external';
export type NotifyChannel = 'telegram' | 'none';

export interface ActorEntry {
  id: string;                    // local temp UUID
  sourceType: ActorSourceType;
  sourceId?: string;             // clientId / userId when from DB
  name: string;
  roleLabel: string;             // e.g. "Dentysta", "Pacjent", "Aktor"
  notifyChannel: NotifyChannel;
  telegramHandle: string;        // @username or +48... — used by Make.com webhook
}

export type IdeaStatus = 'pending' | 'accepted' | 'accepted_with_notes' | 'saved_for_later' | 'rejected';

export interface Idea {
  id: string;
  campaignId: string;              // belongs to campaign (not project)
  resultingProjectId: string | null; // set when idea is accepted → project created
  title: string;
  description: string;
  createdByUserId: string;
  createdAt: string;
  status: IdeaStatus;
  clientNotes: string | null;   // for 'accepted_with_notes' or 'rejected' reasons
  reviewedAt: string | null;
  reviewedByUserId: string | null;
}

export type CampaignStatus = 'draft' | 'awaiting_ideas' | 'in_review' | 'completed' | 'cancelled';

export interface Campaign {
  id: string;
  clientId: string;
  assignedInfluencerId: string;
  assignedClientUserId: string | null;  // legacy single reviewer (kept for backward compat)
  reviewerIds: string[];                // multi-reviewer array
  targetIdeaCount: number;              // default 12
  status: CampaignStatus;
  createdAt: string;
  slaHours: number;                     // 48 default — influencer deadline
  briefNotes: string;                   // DZ notes/brief for influencer
  isDeleted: boolean;                   // soft delete flag
}
