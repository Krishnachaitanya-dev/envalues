-- supabase/migrations/20260411000005_lock_session_rpc.sql
-- RPC for SELECT FOR UPDATE on flow_sessions (edge functions can't run raw SQL).

CREATE OR REPLACE FUNCTION public.lock_flow_session(
  p_owner_id uuid,
  p_phone    text
)
RETURNS SETOF public.flow_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM public.flow_sessions
    WHERE owner_id = p_owner_id
      AND phone = p_phone
      AND status IN ('active', 'handoff')
    FOR UPDATE SKIP LOCKED;
END;
$$;
