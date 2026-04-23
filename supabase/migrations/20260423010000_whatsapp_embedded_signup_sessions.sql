-- supabase/migrations/20260423010000_whatsapp_embedded_signup_sessions.sql
-- Session integrity table for Meta Embedded Signup state/nonce validation.

CREATE TABLE IF NOT EXISTS public.whatsapp_connect_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  state            text NOT NULL UNIQUE,
  nonce            text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  meta_config_id   text,
  expires_at       timestamptz NOT NULL,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connect_sessions_owner_status
  ON public.whatsapp_connect_sessions(owner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connect_sessions_expires
  ON public.whatsapp_connect_sessions(expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'whatsapp_connect_sessions_updated_at'
  ) THEN
    CREATE TRIGGER whatsapp_connect_sessions_updated_at
      BEFORE UPDATE ON public.whatsapp_connect_sessions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.whatsapp_connect_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_connect_sessions_tenant_isolation ON public.whatsapp_connect_sessions;
CREATE POLICY whatsapp_connect_sessions_tenant_isolation
  ON public.whatsapp_connect_sessions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS admin_select_all_whatsapp_connect_sessions ON public.whatsapp_connect_sessions;
CREATE POLICY admin_select_all_whatsapp_connect_sessions
  ON public.whatsapp_connect_sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());
