/**
 * Local Reminder Scheduler
 * Run: node scheduler.mjs
 * Checks every 60s for due reminders and sends them via Evolution API
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tbfmturpclqponehhdjq.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const EVOLUTION_URL = 'http://localhost:8081'
const EVOLUTION_KEY = 'alachat-evolution-dev-key'
const INSTANCE_NAME = 'alachat-admin'

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY env variable')
  console.error('   Run: SUPABASE_SERVICE_KEY=your_key node scheduler.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function processReminders() {
  const now = new Date().toISOString()
  console.log(`[${new Date().toLocaleTimeString()}] Checking for due reminders...`)

  const { data: reminders, error } = await supabase
    .from('evolution_reminders')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .limit(50)

  if (error) { console.error('DB error:', error.message); return }
  if (!reminders || reminders.length === 0) {
    console.log('  No pending reminders due.')
    return
  }

  console.log(`  Found ${reminders.length} reminder(s) to send`)

  for (const reminder of reminders) {
    try {
      let phone = reminder.phone.replace(/[\s\-\(\)\+]/g, '')
      if (!phone.startsWith('91') && phone.length === 10) phone = `91${phone}`

      const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text: reminder.message }),
      })

      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)

      // Save in inbox as outbound
      await supabase.from('evolution_messages').insert({
        phone: reminder.phone,
        direction: 'outbound',
        content: reminder.message,
        msg_type: 'text',
      })

      // Mark sent
      await supabase
        .from('evolution_reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', reminder.id)

      console.log(`  ✅ Sent to ${reminder.phone}`)
    } catch (err) {
      await supabase
        .from('evolution_reminders')
        .update({ status: 'failed', error: String(err) })
        .eq('id', reminder.id)
      console.error(`  ❌ Failed for ${reminder.phone}:`, err.message)
    }
  }
}

// Run immediately, then every 60 seconds
processReminders()
setInterval(processReminders, 60_000)
console.log('🕐 Scheduler running — checking every 60 seconds. Press Ctrl+C to stop.\n')
