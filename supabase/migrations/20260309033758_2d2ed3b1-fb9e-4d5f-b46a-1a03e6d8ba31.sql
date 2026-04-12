
-- 1. Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- owners table
DROP POLICY IF EXISTS "Owners can update own data" ON public.owners;
DROP POLICY IF EXISTS "Owners can view own data" ON public.owners;

CREATE POLICY "Owners can view own data" ON public.owners
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Owners can update own data" ON public.owners
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- chatbots table
DROP POLICY IF EXISTS "Owners can create own chatbot" ON public.chatbots;
DROP POLICY IF EXISTS "Owners can delete own chatbot" ON public.chatbots;
DROP POLICY IF EXISTS "Owners can update own chatbot" ON public.chatbots;
DROP POLICY IF EXISTS "Owners can view own chatbot" ON public.chatbots;

CREATE POLICY "Owners can view own chatbot" ON public.chatbots
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can create own chatbot" ON public.chatbots
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own chatbot" ON public.chatbots
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete own chatbot" ON public.chatbots
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- qa_pairs table
DROP POLICY IF EXISTS "Owners can create own qa_pairs" ON public.qa_pairs;
DROP POLICY IF EXISTS "Owners can delete own qa_pairs" ON public.qa_pairs;
DROP POLICY IF EXISTS "Owners can update own qa_pairs" ON public.qa_pairs;
DROP POLICY IF EXISTS "Owners can view own qa_pairs" ON public.qa_pairs;

CREATE POLICY "Owners can view own qa_pairs" ON public.qa_pairs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can create own qa_pairs" ON public.qa_pairs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can update own qa_pairs" ON public.qa_pairs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can delete own qa_pairs" ON public.qa_pairs
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

-- customer_sessions table
DROP POLICY IF EXISTS "Owners can view own chatbot sessions" ON public.customer_sessions;

CREATE POLICY "Owners can view own chatbot sessions" ON public.customer_sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (chatbot_id IN (SELECT id FROM public.chatbots WHERE owner_id = auth.uid()));

-- subscriptions table: remove INSERT/UPDATE from authenticated, keep only SELECT
DROP POLICY IF EXISTS "owners_insert_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "owners_select_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "owners_update_own_subscriptions" ON public.subscriptions;

CREATE POLICY "owners_select_own_subscriptions" ON public.subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Revoke password_hash from being readable by authenticated/anon
REVOKE SELECT (password_hash) ON public.owners FROM authenticated, anon;
