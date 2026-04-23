import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260419010000_whatsapp_multi_tenant_outbox.sql', 'utf-8')
const worker = readFileSync('supabase/functions/process-whatsapp-outbox/index.ts', 'utf-8')
const webhook = readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf-8')
const sendMessageFn = readFileSync('supabase/functions/send-message/index.ts', 'utf-8')

describe('whatsapp multi-tenant outbox contract', () => {
  it('adds account/outbox/dead-letter schema with queue lease and idempotency fields', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.whatsapp_accounts')
    expect(migration).toContain('token_last_verified_at')
    expect(migration).toContain('sending_enabled')
    expect(migration).toContain('throttled')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.whatsapp_outbox')
    expect(migration).toContain('idempotency_key')
    expect(migration).toContain('ordering_key')
    expect(migration).toContain('sequence_no')
    expect(migration).toContain('locked_at')
    expect(migration).toContain('locked_by')
    expect(migration).toContain('lease_expires_at')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.whatsapp_dead_letter')
  })

  it('defines enqueue + claim SQL helpers with ordering gate and SKIP LOCKED', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_outbox')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.claim_whatsapp_outbox_jobs')
    expect(migration).toContain('FOR UPDATE SKIP LOCKED')
    expect(migration).toContain('prior.sequence_no < q.sequence_no')
    expect(migration).toContain("prior.status = 'pending'")
    expect(migration).toContain("prior.status = 'processing'")
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.move_whatsapp_outbox_to_dead_letter')
  })

  it('implements deterministic worker semantics and retry ladder', () => {
    expect(worker).toContain('const TICK_MS = 15000')
    expect(worker).toContain('const CLAIM_LIMIT = 50')
    expect(worker).toContain('const LEASE_SECONDS = 30')
    expect(worker).toContain('const MAX_ATTEMPTS = 5')
    expect(worker).toContain('const RETRY_DELAYS_SECONDS = [30, 120, 600, 1800, 7200]')
    expect(worker).toContain("supabase.rpc('claim_whatsapp_outbox_jobs'")
    expect(worker).toContain("supabase.rpc('move_whatsapp_outbox_to_dead_letter'")
  })

  it('routes inbound by phone_number_id and enqueues outbound from webhook runtime', () => {
    expect(webhook).toContain('const incomingPhoneNumberId: string | null = value.metadata?.phone_number_id ?? null')
    expect(webhook).toContain('resolveTenantAccountByInbound')
    expect(webhook).toContain("await supabase.rpc('enqueue_whatsapp_outbox'")
    expect(webhook).toContain('process-whatsapp-outbox?run_seconds=15')
    expect(webhook).toContain("const interrupt = session?.status === 'active' ? resolveTrigger(triggers, text)")
  })

  it('queues agent manual replies instead of direct WhatsApp send bypass', () => {
    expect(sendMessageFn).toContain("resolveTenantAccountByOwnerId")
    expect(sendMessageFn).toContain("supabase.rpc('enqueue_whatsapp_outbox'")
    expect(sendMessageFn).toContain("status is ${account.status}. Reconnect required.")
  })
})
