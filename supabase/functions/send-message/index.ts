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
    // Verify the caller is an authenticated owner
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { to, message, chatbot_id } = await req.json()
    if (!to || !message || !chatbot_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, message, chatbot_id' }), { status: 400 })
    }

    // Verify this chatbot belongs to the calling owner
    const { data: chatbot, error: botErr } = await supabase
      .from('chatbots')
      .select('id, owner_id')
      .eq('id', chatbot_id)
      .eq('owner_id', user.id)
      .single()
    if (botErr || !chatbot) {
      return new Response(JSON.stringify({ error: 'Chatbot not found or unauthorized' }), { status: 403 })
    }

    // Get owner WhatsApp credentials
    const { data: owner } = await supabase
      .from('owners')
      .select('whatsapp_api_token, whatsapp_business_number')
      .eq('id', user.id)
      .single()
    if (!owner?.whatsapp_api_token) {
      return new Response(JSON.stringify({ error: 'WhatsApp credentials not configured' }), { status: 400 })
    }

    // Get phone number ID from env (same as webhook uses)
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
    if (!phoneNumberId) {
      return new Response(JSON.stringify({ error: 'WHATSAPP_PHONE_NUMBER_ID not configured' }), { status: 500 })
    }

    // Send via WhatsApp API
    const waRes = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
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
      console.error('WhatsApp send failed:', errText)
      return new Response(JSON.stringify({ error: 'WhatsApp API error', detail: errText }), { status: 502 })
    }

    // Save to messages table
    await supabase.from('messages').insert({
      chatbot_id,
      customer_phone: to,
      direction: 'outbound',
      content: message,
      msg_type: 'agent',
    })

    // Log to audit
    await supabase.from('audit_logs').insert({
      owner_id: user.id,
      action: 'agent_message_sent',
      resource_type: 'customer_session',
      metadata: { to, chatbot_id, message_preview: message.slice(0, 100) },
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('send-message error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
