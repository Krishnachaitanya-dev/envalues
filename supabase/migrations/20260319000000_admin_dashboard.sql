-- =====================================================
-- ADMIN DASHBOARD MIGRATION
-- Adds is_admin flag + admin-level RLS policies
-- =====================================================

-- 1. Add is_admin column to owners
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Helper function: check if current user is admin (avoids subquery repetition)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.owners WHERE id = auth.uid()),
    false
  );
$$;

-- 2. Admin SELECT policies on every table

-- owners: admin can see all
CREATE POLICY "admin_select_all_owners" ON public.owners
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- owners: admin can update any (for ban/unban)
CREATE POLICY "admin_update_all_owners" ON public.owners
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_admin());

-- chatbots: admin can see all
CREATE POLICY "admin_select_all_chatbots" ON public.chatbots
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- chatbots: admin can update any (force-deactivate)
CREATE POLICY "admin_update_all_chatbots" ON public.chatbots
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_admin());

-- subscriptions: admin can see all
CREATE POLICY "admin_select_all_subscriptions" ON public.subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- customer_sessions: admin can see all
CREATE POLICY "admin_select_all_sessions" ON public.customer_sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- audit_logs: admin can see all
CREATE POLICY "admin_select_all_audit_logs" ON public.audit_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- security_events: admin can see all
CREATE POLICY "admin_select_all_security_events" ON public.security_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- qa_pairs: admin can see all
CREATE POLICY "admin_select_all_qa_pairs" ON public.qa_pairs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

-- 3. Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_owners_is_admin ON public.owners(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_owners_created_at ON public.owners(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON public.subscriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_last_activity ON public.customer_sessions(last_activity_at DESC);
