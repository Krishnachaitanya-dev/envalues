# WhatsApp Delivery SLOs

## Targets

- Webhook accept success: **>= 99.9%**
- Outbox time-to-send (enqueue to sent): **p95 <= 5 minutes**
- Duplicate outbound messages: **< 0.1%**
- Token invalidation recovery: **reconnect alert visible within 1 minute**

## Core Metrics

- `webhook_requests_total`, `webhook_errors_total`
- `whatsapp_outbox_pending_count`, `whatsapp_outbox_processing_count`, `whatsapp_dead_letter_count`
- `whatsapp_send_success_total`, `whatsapp_send_failure_total`
- `whatsapp_retry_total` and average retries per sent message
- `whatsapp_token_invalidations_total`
- top tenants by `tenant_whatsapp_usage_daily.sent_count`

## Alerts

- Webhook failures spike for 5 minutes
- Outbox backlog growth trend > 15 minutes
- Dead-letter count increases continuously for 10 minutes
- Token invalidation events spike above baseline
