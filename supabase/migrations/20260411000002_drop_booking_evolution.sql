-- supabase/migrations/20260411000002_drop_booking_evolution.sql
-- Drop booking bot prototype tables (testing-only, no production data)
-- Drop evolution tables (no owner_id — cannot be multi-tenant safe)

-- Booking tables: drop in FK-safe order
DROP TABLE IF EXISTS public.booking_blocked_slots CASCADE;
DROP TABLE IF EXISTS public.booking_appointments CASCADE;
DROP TABLE IF EXISTS public.booking_patients CASCADE;
DROP TABLE IF EXISTS public.booking_conversation_state CASCADE;
DROP TABLE IF EXISTS public.booking_configs CASCADE;

-- Remove chatbot_type column (booking-only concept, replaced by flow.status)
ALTER TABLE public.chatbots DROP COLUMN IF EXISTS chatbot_type;

-- Evolution tables: no owner_id — violates multi-tenant model
DROP TABLE IF EXISTS public.evolution_messages CASCADE;
DROP TABLE IF EXISTS public.evolution_reminders CASCADE;
