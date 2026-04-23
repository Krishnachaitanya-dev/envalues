# WhatsApp Ops Runbooks

## 1) Token Failure Surge (401/403)

1. Confirm `whatsapp_account_events` has `token_invalid` spikes.
2. Check impacted tenants in `whatsapp_accounts` with `status = 'reauth_required'`.
3. Notify tenants to reconnect via Settings.
4. Requeue dead-letter jobs after reconnect using `requeue-dead-letter`.
5. Verify `last_send_success_at` starts moving again.

## 2) Webhook Outage

1. Verify Meta webhook verification and function health.
2. Check signature failures / malformed payload logs.
3. Confirm inbound inserts in `conversation_logs` and `processed_message_ids`.
4. If recoverable, resume and monitor backlog and duplicate rate.

## 3) Queue Backlog / Drain

1. Inspect `whatsapp_outbox` by status and `next_attempt_at`.
2. Confirm cron job `process-whatsapp-outbox-every-minute` exists in `cron.job`.
3. Run `process-whatsapp-outbox` with backlog drain window `run_seconds=300`.
4. Confirm leases are rotating (`locked_by`, `lease_expires_at`).
5. Investigate high retry reasons in `last_error`.

## 4) Meta API Degradation

1. Check failure codes distribution (429/5xx).
2. Keep retries enabled; do not disable idempotency.
3. Temporarily lower dispatch pressure if required.
4. Monitor dead-letter trend and requeue after Meta recovers.
