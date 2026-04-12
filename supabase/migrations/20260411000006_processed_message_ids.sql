-- supabase/migrations/20260411000006_processed_message_ids.sql
-- Idempotency table: tracks processed WhatsApp message IDs.

CREATE TABLE IF NOT EXISTS public.processed_message_ids (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   text NOT NULL,
  owner_id     uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  processed_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_message_ids_unique
  ON public.processed_message_ids(message_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_processed_message_ids_time
  ON public.processed_message_ids(processed_at);

ALTER TABLE public.processed_message_ids ENABLE ROW LEVEL SECURITY;
