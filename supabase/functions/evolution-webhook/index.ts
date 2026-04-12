import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const payload = await req.json()

    // Log all events for debugging
    const event = payload?.event
    console.log('evolution-webhook received event:', event, JSON.stringify(payload).slice(0, 300))

    // Accept both formats: messages.upsert and MESSAGES_UPSERT
    const isMessageEvent = event === 'messages.upsert' || event === 'MESSAGES_UPSERT'
    if (!isMessageEvent) {
      return new Response(JSON.stringify({ ok: true, skipped: event }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const data = payload?.data
    if (!data) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })

    // Normalise — can be array or single object
    const msgs = Array.isArray(data) ? data : [data]

    for (const msg of msgs) {
      const key = msg?.key
      const msgContent = msg?.message

      if (!key || !msgContent) continue

      // Skip outbound messages we sent (fromMe = true)
      // We already save outbound from the UI
      if (key.fromMe) continue

      // Normalize phone: strip WhatsApp suffix, keep full number with country code
      let phone = key.remoteJid?.replace('@s.whatsapp.net', '')?.replace('@c.us', '') ?? null
      if (!phone) continue
      // Ensure consistent format: always include country code (e.g. 919000451918)
      phone = phone.replace(/\D/g, '')
      if (phone.length === 10) phone = `91${phone}`

      // Extract text content
      const content =
        msgContent.conversation ||
        msgContent.extendedTextMessage?.text ||
        msgContent.imageMessage?.caption ||
        msgContent.videoMessage?.caption ||
        '[media]'

      const contactName = msg?.pushName ?? null
      const evolutionMsgId = key.id ?? null

      await supabase.from('evolution_messages').insert({
        phone,
        contact_name: contactName,
        direction: 'inbound',
        content,
        msg_type: 'text',
        evolution_msg_id: evolutionMsgId,
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('evolution-webhook error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
