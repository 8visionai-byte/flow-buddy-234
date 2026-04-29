// Warstwa synchronizacji stanu React ↔ Supabase + Realtime.
// Podejście: 1) hydratacja przy starcie, 2) write-through przez diff stanu, 3) realtime merge.

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  taskFromRow, taskToRow, projectFromRow, projectToRow,
  clientFromRow, clientToRow, userFromRow, userToRow,
  recordingFromRow, recordingToRow, projectNoteFromRow, projectNoteToRow,
  ideaFromRow, ideaToRow, campaignFromRow, campaignToRow,
} from './mappers';
import type { User, Task, Project, Client, Recording, ProjectNote, Idea, Campaign } from '@/types';

type EntityName = 'tasks' | 'projects' | 'clients' | 'app_users' | 'recordings' | 'project_notes' | 'ideas' | 'campaigns';

export interface HydratedState {
  users: User[]; clients: Client[]; projects: Project[]; tasks: Task[];
  recordings: Recording[]; projectNotes: ProjectNote[];
  ideas: Idea[]; campaigns: Campaign[];
}

export async function hydrateFromSupabase(): Promise<HydratedState> {
  const [tasksR, projectsR, clientsR, usersR, recsR, notesR, ideasR, campsR] = await Promise.all([
    supabase.from('tasks').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('clients').select('*'),
    supabase.from('app_users').select('*'),
    supabase.from('recordings').select('*'),
    supabase.from('project_notes').select('*'),
    supabase.from('ideas').select('*'),
    supabase.from('campaigns').select('*'),
  ]);
  const err = (r: { error: unknown; data: unknown }) => {
    if (r.error) console.error('[hydrate] supabase error:', r.error);
  };
  [tasksR, projectsR, clientsR, usersR, recsR, notesR, ideasR, campsR].forEach(err);
  return {
    tasks: (tasksR.data ?? []).map(taskFromRow as any),
    projects: (projectsR.data ?? []).map(projectFromRow as any),
    clients: (clientsR.data ?? []).map(clientFromRow as any),
    users: (usersR.data ?? []).map(userFromRow as any),
    recordings: (recsR.data ?? []).map(recordingFromRow as any),
    projectNotes: (notesR.data ?? []).map(projectNoteFromRow as any),
    ideas: (ideasR.data ?? []).map(ideaFromRow as any),
    campaigns: (campsR.data ?? []).map(campaignFromRow as any),
  };
}

// ── Diff & write ────────────────────────────────────────────────────────────
function diffById<T extends { id: string }>(prev: T[], next: T[]): { upserts: T[]; deletes: string[] } {
  const prevMap = new Map(prev.map(x => [x.id, x]));
  const nextMap = new Map(next.map(x => [x.id, x]));
  const upserts: T[] = [];
  next.forEach(n => {
    const p = prevMap.get(n.id);
    if (!p || JSON.stringify(p) !== JSON.stringify(n)) upserts.push(n);
  });
  const deletes: string[] = [];
  prev.forEach(p => { if (!nextMap.has(p.id)) deletes.push(p.id); });
  return { upserts, deletes };
}

async function persistDiff(table: EntityName, upsertRows: any[], deleteIds: string[]) {
  if (upsertRows.length > 0) {
    const { error } = await supabase.from(table).upsert(upsertRows);
    if (error) console.error(`[persist] ${table} upsert error:`, error, upsertRows.slice(0, 1));
  }
  if (deleteIds.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', deleteIds);
    if (error) console.error(`[persist] ${table} delete error:`, error);
  }
}

export function useSupabaseSync(state: HydratedState, applyRemote: (next: Partial<HydratedState>) => void, hydrated: boolean) {
  // Snapshots of last persisted state — used for diffing on each change.
  const snap = useRef<HydratedState | null>(null);
  // Track ids we just sent so realtime echo doesn't trigger re-render churn (optional optimization — skipped).

  // Initialize snapshot once after hydration, so first user mutation diffs vs DB.
  useEffect(() => {
    if (hydrated && !snap.current) {
      snap.current = { ...state };
    }
  }, [hydrated, state]);

  // Tasks
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.tasks, state.tasks);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('tasks', d.upserts.map(taskToRow), d.deletes);
      snap.current = { ...snap.current, tasks: state.tasks };
    }
  }, [state.tasks, hydrated]);

  // Projects
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.projects, state.projects);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('projects', d.upserts.map(projectToRow), d.deletes);
      snap.current = { ...snap.current, projects: state.projects };
    }
  }, [state.projects, hydrated]);

  // Clients
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.clients, state.clients);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('clients', d.upserts.map(clientToRow), d.deletes);
      snap.current = { ...snap.current, clients: state.clients };
    }
  }, [state.clients, hydrated]);

  // Users (app_users)
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.users, state.users);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('app_users', d.upserts.map(userToRow), d.deletes);
      snap.current = { ...snap.current, users: state.users };
    }
  }, [state.users, hydrated]);

  // Recordings
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.recordings, state.recordings);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('recordings', d.upserts.map(recordingToRow), d.deletes);
      snap.current = { ...snap.current, recordings: state.recordings };
    }
  }, [state.recordings, hydrated]);

  // Project notes
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.projectNotes, state.projectNotes);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('project_notes', d.upserts.map(projectNoteToRow), d.deletes);
      snap.current = { ...snap.current, projectNotes: state.projectNotes };
    }
  }, [state.projectNotes, hydrated]);

  // Ideas
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.ideas, state.ideas);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('ideas', d.upserts.map(ideaToRow), d.deletes);
      snap.current = { ...snap.current, ideas: state.ideas };
    }
  }, [state.ideas, hydrated]);

  // Campaigns
  useEffect(() => {
    if (!hydrated || !snap.current) return;
    const d = diffById(snap.current.campaigns, state.campaigns);
    if (d.upserts.length || d.deletes.length) {
      persistDiff('campaigns', d.upserts.map(campaignToRow), d.deletes);
      snap.current = { ...snap.current, campaigns: state.campaigns };
    }
  }, [state.campaigns, hydrated]);

  // ── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;

    const merge = <T extends { id: string }>(arr: T[], item: T) => {
      const idx = arr.findIndex(x => x.id === item.id);
      if (idx === -1) return [...arr, item];
      const next = arr.slice();
      next[idx] = item;
      return next;
    };
    const remove = <T extends { id: string }>(arr: T[], id: string) => arr.filter(x => x.id !== id);

    const handleEvent = (table: EntityName, event: 'INSERT' | 'UPDATE' | 'DELETE', row: any) => {
      if (!snap.current) return;
      const id: string = row?.id ?? row?.old?.id;
      if (!id) return;

      const apply = (key: keyof HydratedState, mapper: (r: any) => any) => {
        if (event === 'DELETE') {
          const next = remove(snap.current![key] as any[], id);
          snap.current = { ...snap.current!, [key]: next } as HydratedState;
          applyRemote({ [key]: next } as Partial<HydratedState>);
        } else {
          const mapped = mapper(row);
          const next = merge(snap.current![key] as any[], mapped);
          snap.current = { ...snap.current!, [key]: next } as HydratedState;
          applyRemote({ [key]: next } as Partial<HydratedState>);
        }
      };

      switch (table) {
        case 'tasks': return apply('tasks', taskFromRow);
        case 'projects': return apply('projects', projectFromRow);
        case 'clients': return apply('clients', clientFromRow);
        case 'app_users': return apply('users', userFromRow);
        case 'recordings': return apply('recordings', recordingFromRow);
        case 'project_notes': return apply('projectNotes', projectNoteFromRow);
        case 'ideas': return apply('ideas', ideaFromRow);
        case 'campaigns': return apply('campaigns', campaignFromRow);
      }
    };

    const tables: EntityName[] = ['tasks', 'projects', 'clients', 'app_users', 'recordings', 'project_notes', 'ideas', 'campaigns'];
    const channel = supabase.channel('yads-sync');
    tables.forEach(t => {
      channel.on('postgres_changes' as any, { event: '*', schema: 'public', table: t }, (payload: any) => {
        const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
        handleEvent(t, payload.eventType, row);
      });
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hydrated, applyRemote]);
}
