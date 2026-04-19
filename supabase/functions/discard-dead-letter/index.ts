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
    if (jobIds.length === 0) {
      return new Response(JSON.stringify({ error: 'job_ids is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { data: rows, error: rowsErr } = await (supabase.from('whatsapp_dead_letter') as any)
      .select('outbox_job_id')
      .eq('owner_id', user.id)
      .in('outbox_job_id', jobIds)
      .eq('status', 'dead')

    if (rowsErr) throw rowsErr
    const outboxIds = (rows ?? []).map((r: any) => r.outbox_job_id)
    if (outboxIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, discarded: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await (supabase.from('whatsapp_dead_letter') as any)
      .update({
        status: 'discarded',
        discarded_at: new Date().toISOString(),
      })
      .eq('owner_id', user.id)
      .in('outbox_job_id', outboxIds)

    await (supabase.from('whatsapp_outbox') as any)
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        lease_expires_at: null,
        locked_at: null,
        locked_by: null,
      })
      .eq('owner_id', user.id)
      .in('id', outboxIds)

    await (supabase.from('whatsapp_account_events') as any).insert({
      owner_id: user.id,
      event_type: 'dead_letter_discarded',
      message: `Discarded ${outboxIds.length} dead-letter messages`,
      metadata: { outbox_job_ids: outboxIds },
    })

    return new Response(JSON.stringify({ ok: true, discarded: outboxIds.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[discard-dead-letter] error:', error)
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
