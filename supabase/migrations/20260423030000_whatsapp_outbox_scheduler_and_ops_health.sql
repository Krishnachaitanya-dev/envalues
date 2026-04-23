-- Ensure outbox worker runs continuously after queue migration.
-- Schedules process-whatsapp-outbox every minute with run_seconds=60.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  v_job_name constant text := 'process-whatsapp-outbox-every-minute';
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid
      INTO v_job_id
      FROM cron.job
     WHERE jobname = v_job_name
     LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      v_job_name,
      '* * * * *',
      $cmd$
      SELECT net.http_post(
        url := 'https://tbfmturpclqponehhdjq.supabase.co/functions/v1/process-whatsapp-outbox?run_seconds=60',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
      $cmd$
    );
  END IF;
END $$;

-- Lightweight ops health check for incident triage.
CREATE OR REPLACE VIEW public.whatsapp_ops_health AS
WITH pending AS (
  SELECT
    owner_id,
    count(*)::bigint AS pending_jobs,
    min(created_at) AS oldest_pending_at
  FROM public.whatsapp_outbox
  WHERE status = 'pending'
  GROUP BY owner_id
),
dead AS (
  SELECT
    owner_id,
    count(*)::bigint AS dead_letter_jobs
  FROM public.whatsapp_dead_letter
  WHERE status = 'dead'
  GROUP BY owner_id
)
SELECT
  a.owner_id,
  a.status AS account_status,
  a.sending_enabled,
  a.throttled,
  a.last_send_success_at,
  a.last_send_error_at,
  coalesce(p.pending_jobs, 0) AS pending_jobs,
  p.oldest_pending_at,
  CASE
    WHEN p.oldest_pending_at IS NULL THEN NULL
    ELSE extract(epoch FROM (now() - p.oldest_pending_at))::bigint
  END AS oldest_pending_age_seconds,
  coalesce(d.dead_letter_jobs, 0) AS dead_letter_jobs
FROM public.whatsapp_accounts a
LEFT JOIN pending p ON p.owner_id = a.owner_id
LEFT JOIN dead d ON d.owner_id = a.owner_id;
