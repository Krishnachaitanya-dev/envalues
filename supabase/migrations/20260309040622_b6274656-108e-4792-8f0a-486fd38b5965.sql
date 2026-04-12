-- =====================================================
-- SECURITY HARDENING MIGRATION (Fixed)
-- Phase 1: Fix RLS policies + Create security tables
-- =====================================================

-- 1. DROP ALL EXISTING POLICIES (they are RESTRICTIVE)
-- owners
DROP POLICY IF EXISTS "Owners can view own data" ON public.owners;
DROP POLICY IF EXISTS "Owners can update own data" ON public.owners;

-- chatbots
DROP POLICY IF EXISTS "Owners can view own chatbot" ON public.chatbots;
DROP POLICY IF EXISTS "Owners can create own chatbot" ON public.chatbots;
DROP POLICY IF EXISTS "Owners can update own chatbot" ON public.chatbots;
DROP POLICY IF EXISTS "Owners can delete own chatbot" ON public.chatbots;

-- qa_pairs
DROP POLICY IF EXISTS "Owners can view own qa_pairs" ON public.qa_pairs;
DROP POLICY IF EXISTS "Owners can create own qa_pairs" ON public.qa_pairs;
DROP POLICY IF EXISTS "Owners can update own qa_pairs" ON public.qa_pairs;
DROP POLICY IF EXISTS "Owners can delete own qa_pairs" ON public.qa_pairs;

-- customer_sessions
DROP POLICY IF EXISTS "Owners can view own chatbot sessions" ON public.customer_sessions;

-- subscriptions
DROP POLICY IF EXISTS "owners_select_own_subscriptions" ON public.subscriptions;

-- 2. RECREATE ALL POLICIES AS PERMISSIVE

-- owners table
CREATE POLICY "owners_select_own" ON public.owners
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "owners_update_own" ON public.owners
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- chatbots table
CREATE POLICY "chatbots_select_own" ON public.chatbots
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "chatbots_insert_own" ON public.chatbots
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "chatbots_update_own" ON public.chatbots
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "chatbots_delete_own" ON public.chatbots
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- qa_pairs table
CREATE POLICY "qa_pairs_select_own" ON public.qa_pairs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

CREATE POLICY "qa_pairs_insert_own" ON public.qa_pairs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

CREATE POLICY "qa_pairs_update_own" ON public.qa_pairs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

CREATE POLICY "qa_pairs_delete_own" ON public.qa_pairs
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

-- customer_sessions table
CREATE POLICY "sessions_select_own" ON public.customer_sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

-- subscriptions table (SELECT only for authenticated users)
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- 3. CREATE AUDIT_LOGS TABLE (append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_own" ON public.audit_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "audit_logs_insert_own" ON public.audit_logs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (false);

-- 4. CREATE SECURITY_EVENTS TABLE (service-role only for writes)
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  owner_id uuid,
  ip_address text,
  user_agent text,
  request_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_events_select_own" ON public.security_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- 5. CREATE RATE_LIMITS TABLE (service-role only)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, endpoint, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limits(owner_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_audit_logs_owner_time ON public.audit_logs(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_owner_time ON public.security_events(owner_id, created_at);