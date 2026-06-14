-- tools_dnd.sql
-- Dedicated table for D&D Hub tools (Character Roster & Arcane VTT)
-- Mirrors the pattern of tools_cardmaker, tools_puzzlemaker, tools_worksheetmaker

CREATE TABLE IF NOT EXISTS public.tools_dnd (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  tool_type text NOT NULL CHECK (tool_type = ANY (ARRAY['character', 'vtt', 'vtt_library'])),
  name text NOT NULL,
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  last_used timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tools_dnd_pkey PRIMARY KEY (id),
  CONSTRAINT tools_dnd_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tools_dnd_user_type ON public.tools_dnd(user_id, tool_type);
CREATE INDEX IF NOT EXISTS idx_tools_dnd_user_id ON public.tools_dnd(user_id);

-- Enable RLS
ALTER TABLE public.tools_dnd ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can only access their own D&D saves"
  ON public.tools_dnd
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
