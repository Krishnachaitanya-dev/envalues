-- supabase/migrations/20260411000004_drop_deprecated_tables.sql
-- Phase 2: Drop tables replaced by the flow engine.
-- customer_sessions first (FK to chatbots), then qa_pairs, then chatbots.

DROP TABLE IF EXISTS public.customer_sessions CASCADE;
DROP TABLE IF EXISTS public.qa_pairs CASCADE;
DROP TABLE IF EXISTS public.chatbots CASCADE;
