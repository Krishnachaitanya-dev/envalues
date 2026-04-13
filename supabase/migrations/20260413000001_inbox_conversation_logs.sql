-- Conversation log for inbox — owner-scoped, replaces dropped chatbot-scoped tables
CREATE TABLE IF NOT EXISTS public.conversation_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  phone      text NOT NULL,
  direction  text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content    text NOT NULL,
  msg_type   text NOT NULL DEFAULT 'bot', -- 'bot' | 'agent' | 'system'
  session_id uuid REFERENCES public.flow_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_convo_logs_owner_phone ON public.conversation_logs(owner_id, phone, created_at DESC);
ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_convo_logs" ON public.conversation_logs
  FOR ALL TO authenticated USING (owner_id = auth.uid());
