import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL') ?? 'http://localhost:8081'
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY') ?? 'alachat-evolution-dev-key'
const INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE') ?? 'alachat-admin'

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch all pending reminders due now or in the past
    const { data: reminders, error } = await supabase
      .from('evolution_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50)

    if (error) throw error
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let sent = 0
    let failed = 0

    for (const reminder of reminders) {
      try {
        // Format phone number
        let phone = reminder.phone.replace(/[\s\-\(\)\+]/g, '')
        if (!phone.startsWith('91') && phone.length === 10) phone = `91${phone}`

        const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ number: phone, text: reminder.message }),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`${res.status}: ${errText}`)
        }

        // Save as outbound message in inbox
        await supabase.from('evolution_messages').insert({
          phone: reminder.phone,
          direction: 'outbound',
          content: reminder.message,
          msg_type: 'text',
        })

        // Mark reminder as sent
        await supabase
          .from('evolution_reminders')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', reminder.id)

        sent++
      } catch (err) {
        // Mark as failed with error message
        await supabase
          .from('evolution_reminders')
          .update({ status: 'failed', error: String(err) })
          .eq('id', reminder.id)

        failed++
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('process-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
