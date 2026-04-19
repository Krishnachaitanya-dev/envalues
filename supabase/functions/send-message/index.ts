import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, resolveTenantAccountByOwnerId } from '../_shared/whatsapp.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { to, message } = await req.json()
    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, message' }), { status: 400, headers: corsHeaders })
    }

    const account = await resolveTenantAccountByOwnerId(supabase, user.id)
    if (!account) {
      return new Response(JSON.stringify({ error: 'WhatsApp credentials not configured' }), { status: 400, headers: corsHeaders })
    }

    if (!account.sendingEnabled) {
      return new Response(JSON.stringify({ error: 'Sending is disabled for this account' }), { status: 409, headers: corsHeaders })
    }

    if (account.throttled) {
      return new Response(JSON.stringify({ error: 'Account is throttled. Try again later.' }), { status: 429, headers: corsHeaders })
    }

    if (['reauth_required', 'revoked', 'expired'].includes(account.status)) {
      return new Response(JSON.stringify({ error: `WhatsApp account status is ${account.status}. Reconnect required.` }), { status: 409, headers: corsHeaders })
    }

    const orderingKey = `${account.ownerId}:${String(to).replace(/[^\d]/g, '')}`
    const idempotencyKey = `manual:${account.ownerId}:${orderingKey}:${crypto.randomUUID()}`
    const { error: enqueueErr } = await supabase.rpc('enqueue_whatsapp_outbox', {
      p_owner_id: account.ownerId,
      p_account_id: account.accountId,
      p_phone_number_id: account.phoneNumberId,
      p_to_phone: to,
      p_payload: { type: 'text', text: message, preview_url: false },
      p_idempotency_key: idempotencyKey,
      p_ordering_key: orderingKey,
      p_available_at: new Date().toISOString(),
    })
    if (enqueueErr) throw enqueueErr

    return new Response(JSON.stringify({ success: true, queued: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    console.error('send-message error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
