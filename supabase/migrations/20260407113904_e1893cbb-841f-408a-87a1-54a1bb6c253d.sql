-- Add array of client voter IDs to projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS assigned_client_ids text[] NOT NULL DEFAULT '{}';

-- Populate from existing single assigned_client_id
UPDATE public.projects
SET assigned_client_ids = ARRAY[assigned_client_id]
WHERE assigned_client_id IS NOT NULL AND assigned_client_ids = '{}';

-- Add client_votes JSONB to tasks for tracking individual votes
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS client_votes jsonb NOT NULL DEFAULT '{}';
