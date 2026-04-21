
-- Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'klient', 'influencer', 'montazysta', 'kierownik_planu', 'operator', 'publikator');
CREATE TYPE public.task_status AS ENUM ('locked', 'todo', 'done', 'pending_client_approval', 'needs_influencer_revision', 'deferred', 'rejected_final');
CREATE TYPE public.input_type AS ENUM ('boolean', 'text', 'url', 'approval', 'social_descriptions', 'social_dates', 'publication_confirm', 'actor_assignment', 'filming_confirmation', 'raw_footage', 'multi_party_notes', 'frameio_review', 'script_review');
CREATE TYPE public.project_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.project_status AS ENUM ('active', 'frozen');
CREATE TYPE public.idea_status AS ENUM ('pending', 'accepted', 'accepted_with_notes', 'saved_for_later', 'rejected');
CREATE TYPE public.campaign_status AS ENUM ('awaiting_ideas', 'in_review', 'completed', 'cancelled');

-- Clients
CREATE TABLE public.clients (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- App Users
CREATE TABLE public.app_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role public.user_role NOT NULL,
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL
);
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to app_users" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

-- Projects
CREATE TABLE public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_phone TEXT NOT NULL DEFAULT '',
  current_stage_index INTEGER NOT NULL DEFAULT 0,
  status public.project_status NOT NULL DEFAULT 'active',
  assigned_influencer_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL,
  assigned_editor_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL,
  assigned_client_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL,
  assigned_kierownik_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL,
  assigned_operator_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL,
  publication_date TIMESTAMPTZ,
  priority public.project_priority NOT NULL DEFAULT 'medium',
  sla_hours INTEGER DEFAULT 48
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- Tasks
CREATE TABLE public.tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  assigned_role public.user_role NOT NULL,
  assigned_roles public.user_role[] NOT NULL DEFAULT '{}',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status public.task_status NOT NULL DEFAULT 'locked',
  input_type public.input_type NOT NULL,
  value TEXT,
  previous_value TEXT,
  client_feedback TEXT,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  deadline_date TIMESTAMPTZ,
  history JSONB NOT NULL DEFAULT '[]',
  role_completions JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- Recordings
CREATE TABLE public.recordings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to recordings" ON public.recordings FOR ALL USING (true) WITH CHECK (true);

-- Project Notes
CREATE TABLE public.project_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_notes" ON public.project_notes FOR ALL USING (true) WITH CHECK (true);

-- Campaigns
CREATE TABLE public.campaigns (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_influencer_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  assigned_client_user_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL,
  target_idea_count INTEGER NOT NULL DEFAULT 12,
  status public.campaign_status NOT NULL DEFAULT 'awaiting_ideas',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sla_hours INTEGER NOT NULL DEFAULT 48,
  brief_notes TEXT NOT NULL DEFAULT ''
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);

-- Ideas
CREATE TABLE public.ideas (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  resulting_project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.idea_status NOT NULL DEFAULT 'pending',
  client_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL
);
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to ideas" ON public.ideas FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;
