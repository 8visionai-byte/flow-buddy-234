import { supabase } from '@/integrations/supabase/client';
import { User, Client, Project, Task, Recording, ProjectNote, Campaign, Idea, TaskHistoryEntry, UserRole } from '@/types';

// ─── Mappers: DB row → App type ──────────────────────────────

export function mapUser(row: any): User {
  return { id: row.id, name: row.name, role: row.role as UserRole, clientId: row.client_id ?? null };
}

export function mapClient(row: any): Client {
  return { id: row.id, companyName: row.company_name, contactName: row.contact_name, email: row.email, phone: row.phone, notes: row.notes, createdAt: row.created_at };
}

export function mapProject(row: any): Project {
  return {
    id: row.id, name: row.name, clientId: row.client_id, clientName: row.client_name, company: row.company,
    clientEmail: row.client_email, clientPhone: row.client_phone, currentStageIndex: row.current_stage_index,
    status: row.status, assignedInfluencerId: row.assigned_influencer_id, assignedEditorId: row.assigned_editor_id,
    assignedClientId: row.assigned_client_id, assignedClientIds: row.assigned_client_ids ?? [],
    assignedKierownikId: row.assigned_kierownik_id,
    assignedOperatorId: row.assigned_operator_id, publicationDate: row.publication_date, priority: row.priority, slaHours: row.sla_hours,
  };
}

export function mapTask(row: any): Task {
  return {
    id: row.id, projectId: row.project_id, order: row.order, assignedRole: row.assigned_role as UserRole,
    assignedRoles: (row.assigned_roles || []) as UserRole[], title: row.title, description: row.description,
    status: row.status, inputType: row.input_type, value: row.value, previousValue: row.previous_value,
    clientFeedback: row.client_feedback, assignedAt: row.assigned_at, completedAt: row.completed_at,
    completedBy: row.completed_by, deadlineDate: row.deadline_date,
    history: (row.history || []) as TaskHistoryEntry[],
    roleCompletions: (row.role_completions || {}) as Record<string, string>,
    clientVotes: (row.client_votes || {}) as Record<string, any>,
  };
}

export function mapRecording(row: any): Recording {
  return { id: row.id, projectId: row.project_id, url: row.url, note: row.note, createdAt: row.created_at };
}

export function mapProjectNote(row: any): ProjectNote {
  return { id: row.id, projectId: row.project_id, content: row.content, createdAt: row.created_at };
}

export function mapCampaign(row: any): Campaign {
  return {
    id: row.id, clientId: row.client_id, assignedInfluencerId: row.assigned_influencer_id,
    assignedClientUserId: row.assigned_client_user_id, reviewerIds: row.reviewer_ids ?? [],
    targetIdeaCount: row.target_idea_count,
    status: row.status, createdAt: row.created_at, slaHours: row.sla_hours, briefNotes: row.brief_notes,
    isDeleted: row.is_deleted ?? false,
    requireCastApproval: row.require_cast_approval ?? false,
  };
}

export function mapIdea(row: any): Idea {
  return {
    id: row.id, campaignId: row.campaign_id, resultingProjectId: row.resulting_project_id,
    title: row.title, description: row.description, createdByUserId: row.created_by_user_id,
    createdAt: row.created_at, status: row.status, clientNotes: row.client_notes,
    reviewedAt: row.reviewed_at, reviewedByUserId: row.reviewed_by_user_id,
    evaluations: (row.evaluations || {}) as Record<string, any>,
  };
}

// ─── Fetch all ────────────────────────────────────────────────

export async function fetchAll() {
  const [usersRes, clientsRes, projectsRes, tasksRes, recordingsRes, notesRes, campaignsRes, ideasRes] = await Promise.all([
    supabase.from('app_users').select('*'),
    supabase.from('clients').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('tasks').select('*').order('order'),
    supabase.from('recordings').select('*'),
    supabase.from('project_notes').select('*'),
    supabase.from('campaigns').select('*'),
    supabase.from('ideas').select('*'),
  ]);
  return {
    users: (usersRes.data || []).map(mapUser),
    clients: (clientsRes.data || []).map(mapClient),
    projects: (projectsRes.data || []).map(mapProject),
    tasks: (tasksRes.data || []).map(mapTask),
    recordings: (recordingsRes.data || []).map(mapRecording),
    projectNotes: (notesRes.data || []).map(mapProjectNote),
    campaigns: (campaignsRes.data || []).map(mapCampaign),
    ideas: (ideasRes.data || []).map(mapIdea),
  };
}

// ─── Upsert helpers (write back to DB) ───────────────────────

export async function upsertTask(task: Task) {
  await supabase.from('tasks').upsert({
    id: task.id, project_id: task.projectId, order: task.order, assigned_role: task.assignedRole,
    assigned_roles: task.assignedRoles, title: task.title, description: task.description,
    status: task.status, input_type: task.inputType, value: task.value, previous_value: task.previousValue,
    client_feedback: task.clientFeedback, assigned_at: task.assignedAt, completed_at: task.completedAt,
    completed_by: task.completedBy, deadline_date: task.deadlineDate,
    history: task.history as any, role_completions: task.roleCompletions as any,
    client_votes: task.clientVotes as any,
  });
}

export async function upsertTasks(tasks: Task[]) {
  if (tasks.length === 0) return;
  const rows = tasks.map(t => ({
    id: t.id, project_id: t.projectId, order: t.order, assigned_role: t.assignedRole,
    assigned_roles: t.assignedRoles, title: t.title, description: t.description,
    status: t.status, input_type: t.inputType, value: t.value, previous_value: t.previousValue,
    client_feedback: t.clientFeedback, assigned_at: t.assignedAt, completed_at: t.completedAt,
    completed_by: t.completedBy, deadline_date: t.deadlineDate,
    history: t.history as any, role_completions: t.roleCompletions as any,
    client_votes: t.clientVotes as any,
  }));
  await supabase.from('tasks').upsert(rows);
}

export async function upsertProject(project: Project) {
  await supabase.from('projects').upsert({
    id: project.id, name: project.name, client_id: project.clientId, client_name: project.clientName,
    company: project.company, client_email: project.clientEmail, client_phone: project.clientPhone,
    current_stage_index: project.currentStageIndex, status: project.status,
    assigned_influencer_id: project.assignedInfluencerId, assigned_editor_id: project.assignedEditorId,
    assigned_client_id: project.assignedClientId, assigned_client_ids: project.assignedClientIds,
    assigned_kierownik_id: project.assignedKierownikId,
    assigned_operator_id: project.assignedOperatorId, publication_date: project.publicationDate,
    priority: project.priority, sla_hours: project.slaHours,
  });
}

export async function upsertUser(user: User) {
  await supabase.from('app_users').upsert({
    id: user.id, name: user.name, role: user.role, client_id: user.clientId ?? null,
  });
}

export async function deleteUserDb(id: string) {
  await supabase.from('app_users').delete().eq('id', id);
}

export async function upsertClient(client: Client) {
  await supabase.from('clients').upsert({
    id: client.id, company_name: client.companyName, contact_name: client.contactName,
    email: client.email, phone: client.phone, notes: client.notes, created_at: client.createdAt,
  });
}

export async function deleteClientDb(id: string) {
  await supabase.from('clients').delete().eq('id', id);
}

export async function deleteProjectDb(id: string) {
  await supabase.from('projects').delete().eq('id', id);
}

export async function insertRecording(rec: Recording) {
  await supabase.from('recordings').insert({
    id: rec.id, project_id: rec.projectId, url: rec.url, note: rec.note, created_at: rec.createdAt,
  });
}

export async function deleteRecordingDb(id: string) {
  await supabase.from('recordings').delete().eq('id', id);
}

export async function insertProjectNote(note: ProjectNote) {
  await supabase.from('project_notes').insert({
    id: note.id, project_id: note.projectId, content: note.content, created_at: note.createdAt,
  });
}

export async function deleteProjectNoteDb(id: string) {
  await supabase.from('project_notes').delete().eq('id', id);
}

export async function upsertCampaign(campaign: Campaign) {
  await supabase.from('campaigns').upsert({
    id: campaign.id, client_id: campaign.clientId, assigned_influencer_id: campaign.assignedInfluencerId,
    assigned_client_user_id: campaign.assignedClientUserId, reviewer_ids: campaign.reviewerIds ?? [],
    target_idea_count: campaign.targetIdeaCount,
    status: campaign.status, created_at: campaign.createdAt, sla_hours: campaign.slaHours,
    brief_notes: campaign.briefNotes, is_deleted: campaign.isDeleted ?? false,
    require_cast_approval: campaign.requireCastApproval ?? false,
  });
}

export async function deleteCampaignDb(id: string) {
  await supabase.from('campaigns').delete().eq('id', id);
}

export async function hardDeleteCampaignsDb(ids: string[]) {
  // Delete ideas linked to these campaigns first, then delete the campaigns
  await supabase.from('ideas').delete().in('campaign_id', ids);
  await supabase.from('campaigns').delete().in('id', ids);
}

export async function bulkRestoreCampaignsDb(ids: string[]) {
  await supabase.from('campaigns').update({ is_deleted: false }).in('id', ids);
}

export async function upsertIdea(idea: Idea) {
  await supabase.from('ideas').upsert({
    id: idea.id, campaign_id: idea.campaignId, resulting_project_id: idea.resultingProjectId,
    title: idea.title, description: idea.description, created_by_user_id: idea.createdByUserId,
    created_at: idea.createdAt, status: idea.status, client_notes: idea.clientNotes,
    reviewed_at: idea.reviewedAt, reviewed_by_user_id: idea.reviewedByUserId,
    evaluations: idea.evaluations as any,
  });
}

export async function deleteIdeaDb(id: string) {
  await supabase.from('ideas').delete().eq('id', id);
}
