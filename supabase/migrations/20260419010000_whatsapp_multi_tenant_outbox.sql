-- supabase/migrations/20260419010000_whatsapp_multi_tenant_outbox.sql
-- Multi-tenant WhatsApp account registry + outbox queue + dead-letter + usage guards.

-- ── WhatsApp account registry (1 active account per owner in V1) ────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  status                    text NOT NULL DEFAULT 'disconnected'
                              CHECK (status IN (
                                'active', 'expiring', 'expired',
                                'revoked', 'reauth_required', 'disconnected'
                              )),
  waba_id                   text,
  meta_business_id          text,
  phone_number_id           text,
  business_number           text,
  display_name              text,
  quality_rating            text,
  messaging_limit_tier      text,
  webhook_subscribed_at     timestamptz,
  quality_last_synced_at    timestamptz,

  token_ciphertext          text,
  token_key_version         text NOT NULL DEFAULT 'enc:v1',
  token_expires_at          timestamptz,
  token_last_verified_at    timestamptz,
  last_send_success_at      timestamptz,
  last_send_error_at        timestamptz,
  disconnect_reason         text,

  sending_enabled           boolean NOT NULL DEFAULT true,
  throttled                 boolean NOT NULL DEFAULT false,
  daily_send_cap            integer,
  burst_per_minute_cap      integer,
  plan_message_limit        integer,

  connected_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT whatsapp_accounts_owner_unique UNIQUE (owner_id),
  CONSTRAINT whatsapp_accounts_phone_number_id_unique UNIQUE (phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_owner_status
  ON public.whatsapp_accounts(owner_id, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_status
  ON public.whatsapp_accounts(status);

-- ── Ordering counters (monotonic sequence per ordering key) ──────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_ordering_counters (
  ordering_key   text PRIMARY KEY,
  last_sequence  bigint NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Outbox queue ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  account_id        uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  phone_number_id   text NOT NULL,
  to_phone          text NOT NULL,
  ordering_key      text NOT NULL,
  sequence_no       bigint NOT NULL,
  payload           jsonb NOT NULL,
  idempotency_key   text NOT NULL,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter', 'cancelled')),
  attempt_count     integer NOT NULL DEFAULT 0,
  next_attempt_at   timestamptz NOT NULL DEFAULT now(),
  last_error        text,
  locked_at         timestamptz,
  locked_by         text,
  lease_expires_at  timestamptz,
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT whatsapp_outbox_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT whatsapp_outbox_ordering_unique UNIQUE (ordering_key, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_due
  ON public.whatsapp_outbox(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_owner_status
  ON public.whatsapp_outbox(owner_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_ordering
  ON public.whatsapp_outbox(ordering_key, sequence_no);

-- ── Dead-letter queue ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_dead_letter (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_job_id     uuid NOT NULL REFERENCES public.whatsapp_outbox(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  account_id        uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  phone_number_id   text NOT NULL,
  to_phone          text NOT NULL,
  ordering_key      text NOT NULL,
  sequence_no       bigint NOT NULL,
  payload           jsonb NOT NULL,
  idempotency_key   text NOT NULL,
  attempt_count     integer NOT NULL DEFAULT 0,
  failure_reason    text,
  disposition       text NOT NULL DEFAULT 'max_attempts',
  status            text NOT NULL DEFAULT 'dead'
                    CHECK (status IN ('dead', 'requeued', 'discarded')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  requeued_at       timestamptz,
  discarded_at      timestamptz,

  CONSTRAINT whatsapp_dead_letter_outbox_unique UNIQUE (outbox_job_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_dead_letter_owner_status
  ON public.whatsapp_dead_letter(owner_id, status, created_at);

-- ── Account events + usage meters ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_account_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  account_id    uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  event_type    text NOT NULL,
  message       text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_account_events_owner_time
  ON public.whatsapp_account_events(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_whatsapp_usage_daily (
  owner_id        uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  usage_date      date NOT NULL,
  sent_count      integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  retried_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, usage_date)
);

-- ── updated_at triggers ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'whatsapp_accounts_updated_at'
  ) THEN
    CREATE TRIGGER whatsapp_accounts_updated_at
      BEFORE UPDATE ON public.whatsapp_accounts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'whatsapp_ordering_counters_updated_at'
  ) THEN
    CREATE TRIGGER whatsapp_ordering_counters_updated_at
      BEFORE UPDATE ON public.whatsapp_ordering_counters
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'whatsapp_outbox_updated_at'
  ) THEN
    CREATE TRIGGER whatsapp_outbox_updated_at
      BEFORE UPDATE ON public.whatsapp_outbox
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'tenant_whatsapp_usage_daily_updated_at'
  ) THEN
    CREATE TRIGGER tenant_whatsapp_usage_daily_updated_at
      BEFORE UPDATE ON public.tenant_whatsapp_usage_daily
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── Helper functions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.next_whatsapp_sequence(p_ordering_key text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
BEGIN
  INSERT INTO public.whatsapp_ordering_counters(ordering_key, last_sequence)
  VALUES (p_ordering_key, 1)
  ON CONFLICT (ordering_key)
  DO UPDATE SET
    last_sequence = public.whatsapp_ordering_counters.last_sequence + 1,
    updated_at = now()
  RETURNING last_sequence INTO v_seq;

  RETURN v_seq;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_outbox(
  p_owner_id uuid,
  p_account_id uuid,
  p_phone_number_id text,
  p_to_phone text,
  p_payload jsonb,
  p_idempotency_key text,
  p_ordering_key text,
  p_available_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
  v_id uuid;
BEGIN
  v_seq := public.next_whatsapp_sequence(p_ordering_key);

  INSERT INTO public.whatsapp_outbox (
    owner_id, account_id, phone_number_id, to_phone,
    ordering_key, sequence_no, payload, idempotency_key, next_attempt_at
  )
  VALUES (
    p_owner_id, p_account_id, p_phone_number_id, p_to_phone,
    p_ordering_key, v_seq, p_payload, p_idempotency_key, COALESCE(p_available_at, now())
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_outbox_jobs(
  p_worker_id text,
  p_limit integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 30
)
RETURNS SETOF public.whatsapp_outbox
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT q.id
    FROM public.whatsapp_outbox q
    WHERE q.status = 'pending'
      AND q.next_attempt_at <= now()
      AND (q.lease_expires_at IS NULL OR q.lease_expires_at <= now())
      AND NOT EXISTS (
        SELECT 1
        FROM public.whatsapp_outbox prior
        WHERE prior.ordering_key = q.ordering_key
          AND prior.id <> q.id
          AND prior.sequence_no < q.sequence_no
          AND (
            prior.status = 'pending'
            OR (
              prior.status = 'processing'
              AND (prior.lease_expires_at IS NULL OR prior.lease_expires_at > now())
            )
          )
      )
    ORDER BY q.next_attempt_at ASC, q.created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 500))
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.whatsapp_outbox outbox
    SET status = 'processing',
        locked_at = now(),
        locked_by = p_worker_id,
        lease_expires_at = now() + make_interval(secs => GREATEST(5, p_lease_seconds)),
        updated_at = now()
    FROM candidate c
    WHERE outbox.id = c.id
    RETURNING outbox.*
  )
  SELECT * FROM updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_whatsapp_outbox_to_dead_letter(
  p_job_id uuid,
  p_failure_reason text,
  p_disposition text DEFAULT 'max_attempts'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.whatsapp_dead_letter (
    outbox_job_id, owner_id, account_id, phone_number_id, to_phone,
    ordering_key, sequence_no, payload, idempotency_key, attempt_count,
    failure_reason, disposition
  )
  SELECT
    o.id, o.owner_id, o.account_id, o.phone_number_id, o.to_phone,
    o.ordering_key, o.sequence_no, o.payload, o.idempotency_key, o.attempt_count,
    p_failure_reason, p_disposition
  FROM public.whatsapp_outbox o
  WHERE o.id = p_job_id
  ON CONFLICT (outbox_job_id) DO UPDATE
    SET failure_reason = EXCLUDED.failure_reason,
        disposition = EXCLUDED.disposition;

  UPDATE public.whatsapp_outbox
  SET status = 'dead_letter',
      last_error = p_failure_reason,
      lease_expires_at = NULL,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_whatsapp_usage(
  p_owner_id uuid,
  p_sent integer DEFAULT 0,
  p_failed integer DEFAULT 0,
  p_retried integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.tenant_whatsapp_usage_daily (
    owner_id, usage_date, sent_count, failed_count, retried_count
  )
  VALUES (
    p_owner_id, CURRENT_DATE, GREATEST(0, p_sent), GREATEST(0, p_failed), GREATEST(0, p_retried)
  )
  ON CONFLICT (owner_id, usage_date)
  DO UPDATE SET
    sent_count = public.tenant_whatsapp_usage_daily.sent_count + GREATEST(0, p_sent),
    failed_count = public.tenant_whatsapp_usage_daily.failed_count + GREATEST(0, p_failed),
    retried_count = public.tenant_whatsapp_usage_daily.retried_count + GREATEST(0, p_retried),
    updated_at = now();
END;
$$;

-- ── Backfill legacy owner credentials into account registry ──────────────────

INSERT INTO public.whatsapp_accounts (
  owner_id,
  status,
  business_number,
  phone_number_id,
  token_ciphertext,
  token_key_version,
  connected_at,
  token_last_verified_at,
  created_at,
  updated_at
)
SELECT
  o.id,
  CASE
    WHEN COALESCE(NULLIF(trim(o.whatsapp_api_token), ''), '') <> ''
      AND COALESCE(NULLIF(trim(o.whatsapp_phone_number_id), ''), '') <> ''
    THEN 'active'
    ELSE 'disconnected'
  END,
  NULLIF(trim(o.whatsapp_business_number), ''),
  NULLIF(trim(o.whatsapp_phone_number_id), ''),
  NULLIF(o.whatsapp_api_token, ''),
  'legacy_plaintext',
  now(),
  CASE
    WHEN COALESCE(NULLIF(trim(o.whatsapp_api_token), ''), '') <> ''
    THEN now()
    ELSE NULL
  END,
  now(),
  now()
FROM public.owners o
WHERE
  COALESCE(NULLIF(trim(o.whatsapp_business_number), ''), '') <> ''
  OR COALESCE(NULLIF(trim(o.whatsapp_phone_number_id), ''), '') <> ''
  OR COALESCE(NULLIF(trim(o.whatsapp_api_token), ''), '') <> ''
ON CONFLICT (owner_id) DO UPDATE
SET
  business_number = COALESCE(EXCLUDED.business_number, public.whatsapp_accounts.business_number),
  phone_number_id = COALESCE(EXCLUDED.phone_number_id, public.whatsapp_accounts.phone_number_id),
  token_ciphertext = COALESCE(EXCLUDED.token_ciphertext, public.whatsapp_accounts.token_ciphertext),
  token_key_version = CASE
    WHEN public.whatsapp_accounts.token_ciphertext IS NULL THEN EXCLUDED.token_key_version
    ELSE public.whatsapp_accounts.token_key_version
  END,
  status = CASE
    WHEN public.whatsapp_accounts.status = 'active' THEN public.whatsapp_accounts.status
    ELSE EXCLUDED.status
  END,
  updated_at = now();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_dead_letter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_account_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_whatsapp_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ordering_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_accounts_tenant_isolation ON public.whatsapp_accounts;
CREATE POLICY whatsapp_accounts_tenant_isolation
  ON public.whatsapp_accounts
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS whatsapp_outbox_tenant_isolation ON public.whatsapp_outbox;
CREATE POLICY whatsapp_outbox_tenant_isolation
  ON public.whatsapp_outbox
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS whatsapp_dead_letter_tenant_isolation ON public.whatsapp_dead_letter;
CREATE POLICY whatsapp_dead_letter_tenant_isolation
  ON public.whatsapp_dead_letter
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS whatsapp_account_events_tenant_isolation ON public.whatsapp_account_events;
CREATE POLICY whatsapp_account_events_tenant_isolation
  ON public.whatsapp_account_events
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_whatsapp_usage_daily_tenant_isolation ON public.tenant_whatsapp_usage_daily;
CREATE POLICY tenant_whatsapp_usage_daily_tenant_isolation
  ON public.tenant_whatsapp_usage_daily
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS whatsapp_ordering_counters_deny_all ON public.whatsapp_ordering_counters;
CREATE POLICY whatsapp_ordering_counters_deny_all
  ON public.whatsapp_ordering_counters
  AS PERMISSIVE FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS admin_select_all_whatsapp_accounts ON public.whatsapp_accounts;
CREATE POLICY admin_select_all_whatsapp_accounts
  ON public.whatsapp_accounts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_whatsapp_outbox ON public.whatsapp_outbox;
CREATE POLICY admin_select_all_whatsapp_outbox
  ON public.whatsapp_outbox
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_whatsapp_dead_letter ON public.whatsapp_dead_letter;
CREATE POLICY admin_select_all_whatsapp_dead_letter
  ON public.whatsapp_dead_letter
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_whatsapp_account_events ON public.whatsapp_account_events;
CREATE POLICY admin_select_all_whatsapp_account_events
  ON public.whatsapp_account_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_tenant_whatsapp_usage_daily ON public.tenant_whatsapp_usage_daily;
CREATE POLICY admin_select_all_tenant_whatsapp_usage_daily
  ON public.tenant_whatsapp_usage_daily
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());
