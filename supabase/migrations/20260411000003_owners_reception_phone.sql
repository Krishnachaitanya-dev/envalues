-- supabase/migrations/20260411000003_owners_reception_phone.sql
-- Add tenant-scoped reception WhatsApp number.
-- Used by handoff node alerts and displayed in Settings.

ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS reception_phone text;

COMMENT ON COLUMN public.owners.reception_phone IS
  'WhatsApp number for handoff alerts and appointment notifications. One per tenant. Format: 919876543210 (no + or spaces).';
