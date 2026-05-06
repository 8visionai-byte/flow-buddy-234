// Mappery DB ↔ aplikacja. Kolumny w bazie używają snake_case, typy aplikacji camelCase.
// Pliki konsumujące: src/context/AppContext.tsx (sync layer).

import type {
  User, Task, Project, Client, Recording, ProjectNote, Idea, Campaign,
  TaskStatus, InputType, UserRole, TaskHistoryEntry, ProjectPriority, ProjectStatus,
  IdeaStatus, CampaignStatus,
} from '@/types';
import type { Json } from '@/integrations/supabase/types';

// ── Tasks ───────────────────────────────────────────────────────────────────
export type TaskRow = {
  id: string; project_id: string; order: number;
  assigned_role: UserRole; assigned_roles: UserRole[];
  title: string; description: string;
  status: TaskStatus; input_type: InputType;
  value: string | null; previous_value: string | null;
  client_feedback: string | null;
  assigned_at: string | null; completed_at: string | null; completed_by: string | null;
  deadline_date: string | null;
  history: Json; role_completions: Json;
  client_votes: Json;
};

export const taskFromRow = (r: TaskRow): Task => ({
  id: r.id, projectId: r.project_id, order: r.order,
  assignedRole: r.assigned_role, assignedRoles: r.assigned_roles ?? [],
  title: r.title, description: r.description,
  status: r.status, inputType: r.input_type,
  value: r.value, previousValue: r.previous_value,
  clientFeedback: r.client_feedback,
  assignedAt: r.assigned_at, completedAt: r.completed_at, completedBy: r.completed_by,
  deadlineDate: r.deadline_date,
  history: (r.history ?? []) as unknown as TaskHistoryEntry[], roleCompletions: (r.role_completions ?? {}) as unknown as Record<string, string>,
});

export const taskToRow = (t: Task): TaskRow => ({
  id: t.id, project_id: t.projectId, order: t.order,
  assigned_role: t.assignedRole, assigned_roles: t.assignedRoles ?? [],
  title: t.title, description: t.description ?? '',
  status: t.status, input_type: t.inputType,
  value: t.value, previous_value: t.previousValue,
  client_feedback: t.clientFeedback,
  assigned_at: t.assignedAt, completed_at: t.completedAt, completed_by: t.completedBy,
  deadline_date: t.deadlineDate,
  history: (t.history ?? []) as unknown as Json, role_completions: (t.roleCompletions ?? {}) as unknown as Json,
  client_votes: {} as Json,
});

// ── Projects ────────────────────────────────────────────────────────────────
export type ProjectRow = {
  id: string; name: string;
  client_id: string | null; client_name: string; company: string;
  client_email: string; client_phone: string;
  current_stage_index: number; status: ProjectStatus;
  assigned_influencer_id: string | null; assigned_editor_id: string | null;
  assigned_client_id: string | null; assigned_kierownik_id: string | null;
  assigned_operator_id: string | null;
  assigned_publikator_id: string | null;
  publication_date: string | null;
  priority: ProjectPriority; sla_hours: number | null;
  assigned_client_ids: string[];
};

export const projectFromRow = (r: ProjectRow): Project => ({
  id: r.id, name: r.name,
  clientId: r.client_id, clientName: r.client_name, company: r.company,
  clientEmail: r.client_email, clientPhone: r.client_phone,
  currentStageIndex: r.current_stage_index, status: r.status,
  assignedInfluencerId: r.assigned_influencer_id, assignedEditorId: r.assigned_editor_id,
  assignedClientId: r.assigned_client_id, assignedKierownikId: r.assigned_kierownik_id,
  assignedOperatorId: r.assigned_operator_id,
  assignedPublikatorId: r.assigned_publikator_id ?? null,
  publicationDate: r.publication_date,
  priority: r.priority, slaHours: r.sla_hours,
});

export const projectToRow = (p: Project): ProjectRow => ({
  id: p.id, name: p.name,
  client_id: p.clientId, client_name: p.clientName ?? '', company: p.company ?? '',
  client_email: p.clientEmail ?? '', client_phone: p.clientPhone ?? '',
  current_stage_index: p.currentStageIndex, status: p.status,
  assigned_influencer_id: p.assignedInfluencerId, assigned_editor_id: p.assignedEditorId,
  assigned_client_id: p.assignedClientId, assigned_kierownik_id: p.assignedKierownikId,
  assigned_operator_id: p.assignedOperatorId,
  assigned_publikator_id: p.assignedPublikatorId,
  publication_date: p.publicationDate,
  priority: p.priority, sla_hours: p.slaHours,
  assigned_client_ids: [],
});

// ── Clients ─────────────────────────────────────────────────────────────────
export type ClientRow = {
  id: string; company_name: string; contact_name: string;
  email: string; phone: string; notes: string; created_at: string;
};
export const clientFromRow = (r: ClientRow): Client => ({
  id: r.id, companyName: r.company_name, contactName: r.contact_name,
  email: r.email, phone: r.phone, notes: r.notes, createdAt: r.created_at,
});
export const clientToRow = (c: Client): Omit<ClientRow, 'created_at'> & { created_at?: string } => ({
  id: c.id, company_name: c.companyName, contact_name: c.contactName,
  email: c.email ?? '', phone: c.phone ?? '', notes: c.notes ?? '',
  created_at: c.createdAt,
});

// ── App users ───────────────────────────────────────────────────────────────
export type UserRow = { id: string; name: string; role: UserRole; client_id: string | null };
export const userFromRow = (r: UserRow): User => ({
  id: r.id, name: r.name, role: r.role, clientId: r.client_id,
});
export const userToRow = (u: User): UserRow => ({
  id: u.id, name: u.name, role: u.role, client_id: u.clientId ?? null,
});

// ── Recordings ──────────────────────────────────────────────────────────────
export type RecordingRow = { id: string; project_id: string; url: string; note: string; created_at: string };
export const recordingFromRow = (r: RecordingRow): Recording => ({
  id: r.id, projectId: r.project_id, url: r.url, note: r.note, createdAt: r.created_at,
});
export const recordingToRow = (r: Recording): RecordingRow => ({
  id: r.id, project_id: r.projectId, url: r.url, note: r.note ?? '', created_at: r.createdAt,
});

// ── Project notes ───────────────────────────────────────────────────────────
export type ProjectNoteRow = { id: string; project_id: string; content: string; created_at: string };
export const projectNoteFromRow = (r: ProjectNoteRow): ProjectNote => ({
  id: r.id, projectId: r.project_id, content: r.content, createdAt: r.created_at,
});
export const projectNoteToRow = (n: ProjectNote): ProjectNoteRow => ({
  id: n.id, project_id: n.projectId, content: n.content, created_at: n.createdAt,
});

// ── Ideas ───────────────────────────────────────────────────────────────────
export type IdeaRow = {
  id: string; campaign_id: string; resulting_project_id: string | null;
  title: string; description: string;
  created_by_user_id: string; created_at: string;
  status: IdeaStatus; client_notes: string | null;
  reviewed_at: string | null; reviewed_by_user_id: string | null;
  evaluations: Json;
};
export const ideaFromRow = (r: IdeaRow): Idea => ({
  id: r.id, campaignId: r.campaign_id, resultingProjectId: r.resulting_project_id,
  title: r.title, description: r.description,
  createdByUserId: r.created_by_user_id, createdAt: r.created_at,
  status: r.status, clientNotes: r.client_notes,
  reviewedAt: r.reviewed_at, reviewedByUserId: r.reviewed_by_user_id,
});
export const ideaToRow = (i: Idea): IdeaRow => ({
  id: i.id, campaign_id: i.campaignId, resulting_project_id: i.resultingProjectId,
  title: i.title, description: i.description ?? '',
  created_by_user_id: i.createdByUserId, created_at: i.createdAt,
  status: i.status, client_notes: i.clientNotes,
  reviewed_at: i.reviewedAt, reviewed_by_user_id: i.reviewedByUserId,
  evaluations: {} as Json,
});

// ── Campaigns ───────────────────────────────────────────────────────────────
export type CampaignRow = {
  id: string; client_id: string;
  assigned_influencer_id: string; assigned_client_user_id: string | null;
  target_idea_count: number; status: CampaignStatus;
  created_at: string; sla_hours: number; brief_notes: string;
  require_cast_approval: boolean; reviewer_ids: string[]; is_deleted: boolean;
};
export const campaignFromRow = (r: CampaignRow): Campaign => ({
  id: r.id, clientId: r.client_id,
  assignedInfluencerId: r.assigned_influencer_id,
  assignedClientUserId: r.assigned_client_user_id,
  targetIdeaCount: r.target_idea_count, status: r.status,
  createdAt: r.created_at, slaHours: r.sla_hours, briefNotes: r.brief_notes ?? '',
});
export const campaignToRow = (c: Campaign): CampaignRow => ({
  id: c.id, client_id: c.clientId,
  assigned_influencer_id: c.assignedInfluencerId,
  assigned_client_user_id: c.assignedClientUserId,
  target_idea_count: c.targetIdeaCount, status: c.status,
  created_at: c.createdAt, sla_hours: c.slaHours, brief_notes: c.briefNotes ?? '',
  require_cast_approval: false, reviewer_ids: [], is_deleted: false,
});
