import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/whatsapp.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const body = await req.json().catch(() => ({}))
    const jobIds = Array.isArray(body.job_ids) ? body.job_ids.filter((id: unknown) => typeof id === 'string') : []
    const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)))
    const requeueAll = Boolean(body.requeue_all)

    const query = (supabase.from('whatsapp_dead_letter') as any)
      .select('id, outbox_job_id, owner_id')
      .eq('owner_id', user.id)
      .eq('status', 'dead')

    if (!requeueAll && jobIds.length > 0) query.in('outbox_job_id', jobIds)
    query.limit(limit)

    const { data: rows, error: rowsErr } = await query
    if (rowsErr) throw rowsErr

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, requeued: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const outboxIds = rows.map((r: any) => r.outbox_job_id)
    await (supabase.from('whatsapp_outbox') as any)
      .update({
        status: 'pending',
        attempt_count: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
        lease_expires_at: null,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', outboxIds)
      .eq('owner_id', user.id)

    await (supabase.from('whatsapp_dead_letter') as any)
      .update({
        status: 'requeued',
        requeued_at: new Date().toISOString(),
      })
      .in('outbox_job_id', outboxIds)
      .eq('owner_id', user.id)

    await (supabase.from('whatsapp_account_events') as any).insert({
      owner_id: user.id,
      event_type: 'dead_letter_requeued',
      message: `Requeued ${outboxIds.length} dead-letter messages`,
      metadata: { outbox_job_ids: outboxIds },
    })

    return new Response(JSON.stringify({ ok: true, requeued: outboxIds.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[requeue-dead-letter] error:', error)
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
