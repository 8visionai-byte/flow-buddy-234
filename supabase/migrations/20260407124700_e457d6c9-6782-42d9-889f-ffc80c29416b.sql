-- Add needs_revision to idea_status enum
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'needs_revision';

-- Add evaluations JSONB column to ideas table
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS evaluations jsonb NOT NULL DEFAULT '{}'::jsonb;