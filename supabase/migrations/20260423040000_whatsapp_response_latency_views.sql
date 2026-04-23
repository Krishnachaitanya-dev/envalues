-- Response latency telemetry from inbound enqueue -> outbound send.
-- Useful to monitor current reply speed (avg, p50, p95) for every owner and globally.

CREATE OR REPLACE VIEW public.whatsapp_response_latency_owner_24h AS
SELECT
  owner_id,
  count(*)::bigint AS sent_count,
  round(avg(extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS avg_ms,
  round(percentile_cont(0.50) WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS p50_ms,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS p95_ms,
  round(min(extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS min_ms,
  round(max(extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS max_ms
FROM public.whatsapp_outbox
WHERE status = 'sent'
  AND sent_at IS NOT NULL
  AND created_at >= now() - interval '24 hours'
GROUP BY owner_id;

CREATE OR REPLACE VIEW public.whatsapp_response_latency_global_24h AS
SELECT
  count(*)::bigint AS sent_count,
  round(avg(extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS avg_ms,
  round(percentile_cont(0.50) WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS p50_ms,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS p95_ms,
  round(min(extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS min_ms,
  round(max(extract(epoch FROM (sent_at - created_at)) * 1000)::numeric, 2) AS max_ms
FROM public.whatsapp_outbox
WHERE status = 'sent'
  AND sent_at IS NOT NULL
  AND created_at >= now() - interval '24 hours';
