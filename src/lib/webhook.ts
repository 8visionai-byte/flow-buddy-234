/**
 * Make.com webhook integration — fire-and-forget POST for every task lifecycle event.
 * All errors are silently swallowed so the app never breaks due to webhook failures.
 */

import { Task, Project, User, UserRole, ROLE_LABELS, Idea, Campaign, Client } from '@/types';

const WEBHOOK_URL = 'https://hook.eu2.make.com/8aati68ojjmdbgu3ef5bvj1xl8jx33il';

export type WebhookEvent =
  | 'task_completed'
  | 'task_approved'
  | 'task_rejected'
  | 'task_rejected_final'
  | 'task_resubmitted'
  | 'task_deferred'
  | 'project_completed'
  | 'idea_submitted'
  | 'idea_accepted'
  | 'idea_rejected'
  | 'idea_saved_for_later'
  | 'idea_accepted_as_project';

// ── Phase label by task order ────────────────────────────────────────────────
const PHASE_MAP: [number, string][] = [
  [1,  'Faza 1 — Pomysł'],
  [3,  'Faza 2 — Scenariusz'],
  [5,  'Faza 3 — Obsada'],
  [9,  'Faza 4 — Przygotowanie do nagrania'],
  [11, 'Faza 4 — Uwagi przed montażem'],
  [17, 'Faza 5 — Montaż'],
  [19, 'Faza 6 — Finalizacja i publikacja'],
];

function getPhase(order: number): string {
  for (const [max, label] of PHASE_MAP) {
    if (order <= max) return label;
  }
  return 'Faza 6 — Finalizacja i publikacja';
}

// ── Role → project assignee field ───────────────────────────────────────────
const ROLE_TO_PROJECT_FIELD: Partial<Record<UserRole, keyof Project>> = {
  influencer:     'assignedInfluencerId',
  klient:         'assignedClientId',
  montazysta:     'assignedEditorId',
  kierownik_planu:'assignedKierownikId',
  operator:       'assignedOperatorId',
  publikator:     'assignedPublikatorId',
};

type WebhookPerson = { name: string; role: string; role_label: string; telegram?: string };

function getAssignees(
  roles: UserRole[],
  project: Project,
  users: User[],
): WebhookPerson[] {
  return roles.flatMap<WebhookPerson>(role => {
    if (role === 'admin') {
      const admins = users.filter(u => u.role === 'admin');
      return admins.map(u => ({ name: u.name, role, role_label: ROLE_LABELS[role], telegram: u.telegramContact }));
    }
    const field = ROLE_TO_PROJECT_FIELD[role];
    if (!field) return [];
    const userId = project[field] as string | null;
    if (!userId) return [];
    const user = users.find(u => u.id === userId);
    if (!user) return [];
    return [{ name: user.name, role, role_label: ROLE_LABELS[role], telegram: user.telegramContact }];
  });
}

// ── Value summary — human-readable snippet ───────────────────────────────────
function summarizeValue(value: string | null, inputType: string): string | undefined {
  if (!value || value === 'true' || value === 'approved' || value === 'skipped') return undefined;
  try {
    const parsed = JSON.parse(value);
    if (inputType === 'publication_confirm') {
      const LABELS: Record<string, string> = { facebook: 'FB', tiktok: 'TT', instagram: 'IG', youtube: 'YT' };
      return Object.entries(parsed as Record<string, unknown>)
        .map(([k, v]) => `${LABELS[k] || k}: ${v ? '✓' : '–'}`)
        .join(', ');
    }
    if (inputType === 'social_dates') {
      const LABELS: Record<string, string> = { facebookDate: 'FB', tiktokDate: 'TT', instagramDate: 'IG', youtubeDate: 'YT' };
      return Object.entries(parsed as Record<string, string>)
        .filter(([, v]) => v)
        .map(([k, v]) => `${LABELS[k] || k}: ${v.slice(0, 10)}`)
        .join(', ');
    }
    if (inputType === 'social_descriptions') {
      const LABELS: Record<string, string> = { facebook: 'FB', tiktok: 'TT', instagram: 'IG', youtube: 'YT' };
      return Object.entries(parsed as Record<string, string>)
        .filter(([, v]) => v)
        .map(([k, v]) => `${LABELS[k] || k}: "${v.slice(0, 40)}${v.length > 40 ? '…' : ''}"`)
        .join(' | ');
    }
    if (inputType === 'raw_footage' && parsed.recordingNumber) {
      return `Nagranie #${parsed.recordingNumber}${parsed.url ? ` — ${parsed.url}` : ''}`;
    }
    if (inputType === 'filming_confirmation' && parsed.recordingNumber) {
      return `Potwierdzone #${parsed.recordingNumber}`;
    }
    if (Array.isArray(parsed) && parsed[0]?.name) {
      return parsed.map((a: { name: string }) => a.name).join(', ');
    }
    if (parsed?.name) return parsed.name;
  } catch {}
  // Plain string
  if (value.startsWith('approved: ')) return value.slice('approved: '.length);
  return value.length > 100 ? value.slice(0, 100) + '…' : value;
}

// ── Main payload builder ─────────────────────────────────────────────────────
export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  app: string;
  project: {
    id: string;
    name: string;
    client_name: string;
    influencer_name: string;
    publication_date: string | null;
  };
  task: {
    id: string;
    title: string;
    phase: string;
    order: number;
    input_type: string;
    assigned_roles: string[];
    value_summary?: string;
    deadline?: string;
  };
  actor: {
    name: string;
    role: string;
    role_label: string;
    telegram?: string;
  };
  next_tasks: {
    title: string;
    phase: string;
    order: number;
    assigned_roles: string[];
    assignees: { name: string; role: string; role_label: string; telegram?: string }[];
  }[];
  meta?: Record<string, unknown>;
}

export function buildWebhookPayload(
  event: WebhookEvent,
  task: Task,
  value: string,
  project: Project,
  users: User[],
  actor: User | null,
  nextTasks: Task[],
  meta?: Record<string, unknown>,
): WebhookPayload {
  const influencer = project.assignedInfluencerId
    ? users.find(u => u.id === project.assignedInfluencerId)
    : null;

  return {
    event,
    timestamp: new Date().toISOString(),
    app: 'CreativeFlow YADS',
    project: {
      id: project.id,
      name: project.name,
      client_name: project.clientName || project.company || '—',
      influencer_name: influencer?.name || '—',
      publication_date: project.publicationDate ?? null,
    },
    task: {
      id: task.id,
      title: task.title,
      phase: getPhase(task.order),
      order: task.order,
      input_type: task.inputType,
      assigned_roles: task.assignedRoles,
      value_summary: summarizeValue(value, task.inputType),
      deadline: task.deadlineDate ?? undefined,
    },
    actor: actor
      ? { name: actor.name, role: actor.role, role_label: ROLE_LABELS[actor.role], telegram: actor.telegramContact }
      : { name: 'System', role: 'admin', role_label: 'Admin' },
    next_tasks: nextTasks.map(t => ({
      title: t.title,
      phase: getPhase(t.order),
      order: t.order,
      assigned_roles: t.assignedRoles,
      assignees: getAssignees(t.assignedRoles as UserRole[], project, users),
    })),
    meta,
  };
}

// ── Sender — fire and forget ─────────────────────────────────────────────────
export function sendWebhook(payload: WebhookPayload): void {
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently ignore — webhook failures must never break the app
  });
}

// ── Idea payload ─────────────────────────────────────────────────────────────
export interface IdeaWebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  app: string;
  campaign: {
    id: string;
    client_name: string;
    influencer_name: string;
    target_idea_count: number;
  };
  idea: {
    id: string;
    title: string;
    description: string;
    status: string;
    client_notes: string | null;
    created_at: string;
    reviewed_at: string | null;
  };
  actor: {
    name: string;
    role: string;
    role_label: string;
    telegram?: string;
  };
  next_actor?: {
    name: string;
    role: string;
    role_label: string;
    telegram?: string;
  };
}

export function buildIdeaWebhookPayload(
  event: WebhookEvent,
  idea: Idea,
  campaign: Campaign,
  users: User[],
  clients: Client[],
  actor: User | null,
  nextActor?: User | null,
): IdeaWebhookPayload {
  const influencer = users.find(u => u.id === campaign.assignedInfluencerId);
  const clientUser = campaign.assignedClientUserId
    ? users.find(u => u.id === campaign.assignedClientUserId)
    : null;
  const client = clients.find(c => c.id === campaign.clientId);

  return {
    event,
    timestamp: new Date().toISOString(),
    app: 'CreativeFlow YADS',
    campaign: {
      id: campaign.id,
      client_name: client?.companyName || clientUser?.name || '—',
      influencer_name: influencer?.name || '—',
      target_idea_count: campaign.targetIdeaCount,
    },
    idea: {
      id: idea.id,
      title: idea.title,
      description: idea.description,
      status: idea.status,
      client_notes: idea.clientNotes,
      created_at: idea.createdAt,
      reviewed_at: idea.reviewedAt,
    },
    actor: actor
      ? { name: actor.name, role: actor.role, role_label: ROLE_LABELS[actor.role], telegram: actor.telegramContact }
      : { name: 'System', role: 'admin', role_label: 'Admin' },
    next_actor: nextActor
      ? { name: nextActor.name, role: nextActor.role, role_label: ROLE_LABELS[nextActor.role], telegram: nextActor.telegramContact }
      : undefined,
  };
}

export function sendIdeaWebhook(payload: IdeaWebhookPayload): void {
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
