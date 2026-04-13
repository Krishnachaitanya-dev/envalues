import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || 'https://graph.facebook.com/v21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { to, message } = await req.json()
    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, message' }), { status: 400 })
    }

    // Get owner credentials
    const { data: owner, error: ownerErr } = await supabase
      .from('owners')
      .select('whatsapp_api_token, whatsapp_phone_number_id')
      .eq('id', user.id)
      .single()
    if (ownerErr || !owner?.whatsapp_api_token || !owner?.whatsapp_phone_number_id) {
      return new Response(JSON.stringify({ error: 'WhatsApp credentials not configured' }), { status: 400 })
    }

    // Send via WhatsApp API
    const waRes = await fetch(`${WHATSAPP_API_URL}/${owner.whatsapp_phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${owner.whatsapp_api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
    })

    if (!waRes.ok) {
      const errText = await waRes.text()
      return new Response(JSON.stringify({ error: 'WhatsApp API error', detail: errText }), { status: 502 })
    }

    // Log to conversation_logs
    await supabase.from('conversation_logs').insert({
      owner_id: user.id,
      phone: to,
      direction: 'outbound',
      content: message,
      msg_type: 'agent',
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    console.error('send-message error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
