-- Owner-scoped customer contacts for the flow-engine runtime.
-- Contacts are keyed by owner + WhatsApp phone number and updated from the
-- inbound webhook path whenever a customer sends a message.

CREATE TABLE IF NOT EXISTS public.contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  phone           text NOT NULL,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  total_messages  integer NOT NULL DEFAULT 0 CHECK (total_messages >= 0),
  notes           text,
  tags            text[] NOT NULL DEFAULT '{}',
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_owner_phone_unique UNIQUE (owner_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contacts_owner_last_active
  ON public.contacts(owner_id, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_owner_tags
  ON public.contacts USING gin(tags);

DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_owner_all" ON public.contacts;
CREATE POLICY "contacts_owner_all" ON public.contacts
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "admin_select_all_contacts" ON public.contacts;
CREATE POLICY "admin_select_all_contacts" ON public.contacts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.record_contact_message(
  p_owner_id uuid,
  p_phone text
)
RETURNS public.contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := NULLIF(trim(p_phone), '');
  v_contact public.contacts;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'owner id is required';
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'phone is required';
  END IF;

  INSERT INTO public.contacts (
    owner_id,
    phone,
    first_seen_at,
    last_active_at,
    total_messages
  )
  VALUES (
    p_owner_id,
    v_phone,
    now(),
    now(),
    1
  )
  ON CONFLICT (owner_id, phone)
  DO UPDATE SET
    last_active_at = now(),
    total_messages = public.contacts.total_messages + 1,
    updated_at = now()
  RETURNING * INTO v_contact;

  RETURN v_contact;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_contact_message(uuid, text) TO service_role;
