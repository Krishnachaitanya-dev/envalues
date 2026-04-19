import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  decryptToken,
  getCorsHeaders,
  markAccountReauthRequired,
  resolveTenantAccountByOwnerId,
  sendWhatsAppApiMessage,
  type OutboundMessage,
} from '../_shared/whatsapp.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const TICK_MS = 15000
const CLAIM_LIMIT = 50
const LEASE_SECONDS = 30
const MAX_ATTEMPTS = 5
const RETRY_DELAYS_SECONDS = [30, 120, 600, 1800, 7200]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function pickRetryDelay(attemptCount: number): number {
  const index = Math.max(0, Math.min(RETRY_DELAYS_SECONDS.length - 1, attemptCount - 1))
  return RETRY_DELAYS_SECONDS[index]
}

function outboundMessageText(message: OutboundMessage): string {
  if (message.type === 'text') return message.text ?? ''
  if (message.type === 'interactive' || message.type === 'list') return message.body ?? `[${message.type}]`
  return `[${message.type}] ${message.url ?? ''}`
}

async function getOwnerDailySent(ownerId: string): Promise<number> {
  const { data } = await (supabase
    .from('tenant_whatsapp_usage_daily') as any)
    .select('sent_count')
    .eq('owner_id', ownerId)
    .eq('usage_date', new Date().toISOString().slice(0, 10))
    .maybeSingle()
  return Number(data?.sent_count ?? 0)
}

async function getOwnerMinuteSent(ownerId: string): Promise<number> {
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await (supabase
    .from('whatsapp_outbox') as any)
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('status', 'sent')
    .gte('sent_at', since)
  return Number(count ?? 0)
}

async function throttleOwner(ownerId: string, accountId: string | null, reason: string) {
  if (accountId) {
    await (supabase.from('whatsapp_accounts') as any)
      .update({ throttled: true, updated_at: new Date().toISOString() })
      .eq('id', accountId)
  }
  await (supabase.from('whatsapp_account_events') as any).insert({
    owner_id: ownerId,
    account_id: accountId,
    event_type: 'throttled',
    message: reason,
    metadata: { reason },
  })
}

async function releaseJob(jobId: string, nextAttemptAt: string, reason: string) {
  await (supabase.from('whatsapp_outbox') as any)
    .update({
      status: 'pending',
      last_error: reason,
      next_attempt_at: nextAttemptAt,
      lease_expires_at: null,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

async function markSent(jobId: string) {
  await (supabase.from('whatsapp_outbox') as any)
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      lease_expires_at: null,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

async function failOrRetry(job: any, reason: string, retryable: boolean) {
  const nextAttempts = Number(job.attempt_count ?? 0) + 1
  const shouldDeadLetter = !retryable || nextAttempts >= MAX_ATTEMPTS

  if (shouldDeadLetter) {
    await supabase.rpc('move_whatsapp_outbox_to_dead_letter', {
      p_job_id: job.id,
      p_failure_reason: reason,
      p_disposition: retryable ? 'max_attempts' : 'permanent_error',
    })
    await (supabase.from('whatsapp_account_events') as any).insert({
      owner_id: job.owner_id,
      account_id: job.account_id,
      event_type: 'dead_letter',
      message: 'Outbox message moved to dead-letter',
      metadata: { job_id: job.id, reason: reason.slice(0, 500), attempt_count: nextAttempts },
    })
    await supabase.rpc('bump_whatsapp_usage', {
      p_owner_id: job.owner_id,
      p_sent: 0,
      p_failed: 1,
      p_retried: 0,
    })
    return
  }

  const delaySeconds = pickRetryDelay(nextAttempts)
  const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
  await (supabase.from('whatsapp_outbox') as any)
    .update({
      status: 'pending',
      attempt_count: nextAttempts,
      next_attempt_at: nextAttemptAt,
      last_error: reason.slice(0, 2000),
      lease_expires_at: null,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
  await supabase.rpc('bump_whatsapp_usage', {
    p_owner_id: job.owner_id,
    p_sent: 0,
    p_failed: 0,
    p_retried: 1,
  })
}

async function processJob(job: any) {
  const account = await resolveTenantAccountByOwnerId(supabase, job.owner_id)
  if (!account) {
    await failOrRetry(job, 'WhatsApp account not configured', false)
    return
  }

  if (!account.sendingEnabled) {
    await releaseJob(job.id, new Date(Date.now() + 60_000).toISOString(), 'Sending disabled for tenant')
    return
  }

  if (account.status === 'reauth_required' || account.status === 'revoked' || account.status === 'expired') {
    await failOrRetry(job, `WhatsApp account status ${account.status}`, false)
    return
  }

  if (account.throttled) {
    await releaseJob(job.id, new Date(Date.now() + 15 * 60_000).toISOString(), 'Tenant throttled')
    return
  }

  if (account.dailySendCap && account.dailySendCap > 0) {
    const dailySent = await getOwnerDailySent(job.owner_id)
    if (dailySent >= account.dailySendCap) {
      await throttleOwner(job.owner_id, account.accountId, 'Daily send cap reached')
      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(0, 0, 0, 0)
      await releaseJob(job.id, tomorrow.toISOString(), 'Daily send cap reached')
      return
    }
  }

  if (account.burstPerMinuteCap && account.burstPerMinuteCap > 0) {
    const sentInMinute = await getOwnerMinuteSent(job.owner_id)
    if (sentInMinute >= account.burstPerMinuteCap) {
      await throttleOwner(job.owner_id, account.accountId, 'Burst per-minute cap reached')
      await releaseJob(job.id, new Date(Date.now() + 60_000).toISOString(), 'Burst cap reached')
      return
    }
  }

  const payload = job.payload as OutboundMessage
  const token = await decryptToken(account.tokenCiphertext, account.tokenKeyVersion)
  const result = await sendWhatsAppApiMessage({
    accessToken: token,
    phoneNumberId: job.phone_number_id,
    to: job.to_phone,
    message: payload,
  })

  if (result.ok) {
    await markSent(job.id)
    await supabase.rpc('bump_whatsapp_usage', {
      p_owner_id: job.owner_id,
      p_sent: 1,
      p_failed: 0,
      p_retried: Number(job.attempt_count ?? 0) > 0 ? 1 : 0,
    })

    await (supabase.from('conversation_logs') as any).insert({
      owner_id: job.owner_id,
      phone: job.to_phone,
      direction: 'outbound',
      content: outboundMessageText(payload),
      msg_type: 'bot',
    })

    if (account.accountId) {
      await (supabase.from('whatsapp_accounts') as any)
        .update({
          last_send_success_at: new Date().toISOString(),
          status: account.status === 'expiring' ? 'expiring' : 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.accountId)
    }
    return
  }

  if (result.status === 401 || result.status === 403) {
    await markAccountReauthRequired(supabase, {
      ownerId: job.owner_id,
      accountId: account.accountId,
      reason: result.errorText,
    })
    await supabase.rpc('move_whatsapp_outbox_to_dead_letter', {
      p_job_id: job.id,
      p_failure_reason: result.errorText,
      p_disposition: 'token_invalid',
    })
    await supabase.rpc('bump_whatsapp_usage', {
      p_owner_id: job.owner_id,
      p_sent: 0,
      p_failed: 1,
      p_retried: 0,
    })
    return
  }

  await failOrRetry(job, result.errorText, result.retryable)
}

async function processBatch(workerId: string) {
  const { data, error } = await supabase.rpc('claim_whatsapp_outbox_jobs', {
    p_worker_id: workerId,
    p_limit: CLAIM_LIMIT,
    p_lease_seconds: LEASE_SECONDS,
  })
  if (error) throw error
  const jobs = data ?? []

  for (const job of jobs) {
    try {
      await processJob(job)
    } catch (err: any) {
      await failOrRetry(job, err?.message ?? 'Unknown worker error', true)
    }
  }

  return jobs.length
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const workerId = `worker-${crypto.randomUUID()}`
  try {
    const url = new URL(req.url)
    const runSeconds = Math.max(15, Math.min(300, Number(url.searchParams.get('run_seconds') ?? '15')))
    const ticks = Math.max(1, Math.floor((runSeconds * 1000) / TICK_MS))
    const startedAt = Date.now()

    let processed = 0
    for (let i = 0; i < ticks; i++) {
      processed += await processBatch(workerId)
      if (i < ticks - 1) await sleep(TICK_MS)
    }

    return new Response(JSON.stringify({
      ok: true,
      worker_id: workerId,
      processed,
      ticks,
      elapsed_ms: Date.now() - startedAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[process-whatsapp-outbox] error:', error)
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
