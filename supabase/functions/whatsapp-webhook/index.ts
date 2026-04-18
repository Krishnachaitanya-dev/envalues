// supabase/functions/whatsapp-webhook/index.ts
// Phase 2: Graph execution engine — replaces menu-bot logic.
// Reads from: flow_nodes, flow_edges, flow_triggers, flow_sessions, owners.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalize } from './engine/normalize.ts'
import { resolveTrigger, findRestartTrigger } from './engine/trigger-engine.ts'
import { executeTurn, TurnDeps } from './engine/turn-executor.ts'
import type { FlowSession, FlowTrigger, OutboundMessage } from './engine/types.ts'

// ── Config ────────────────────────────────────────────────────────────────────

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || 'https://graph.facebook.com/v21.0'
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tenant lookup ─────────────────────────────────────────────────────────────

async function getOwner(businessNumber: string): Promise<{ id: string; whatsapp_api_token: string; whatsapp_phone_number_id: string | null; reception_phone: string | null } | null> {
  const clean = businessNumber.replace(/[\s\-\+\(\)]/g, '')
  for (const num of [clean, `+${clean}`]) {
    const { data } = await supabase
      .from('owners')
      .select('id, whatsapp_api_token, whatsapp_phone_number_id, reception_phone')
      .eq('whatsapp_business_number', num)
      .single()
    if (data) return data
  }
  return null
}

// ── Session management ────────────────────────────────────────────────────────

async function getActiveSession(ownerId: string, phone: string): Promise<FlowSession | null> {
  const { data } = await supabase
    .from('flow_sessions')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('phone', phone)
    .in('status', ['active', 'handoff'])
    .single()
  return data as FlowSession | null
}

async function createSession(ownerId: string, phone: string, trigger: FlowTrigger): Promise<FlowSession> {
  const entryNodeId = trigger.target_node_id ?? await getFlowEntryNode(trigger.flow_id)
  const { data, error } = await supabase
    .from('flow_sessions')
    .upsert({
      owner_id: ownerId,
      flow_id: trigger.flow_id,
      current_node_id: entryNodeId,
      phone,
      status: 'active',
      context: {},
      call_stack: [],
      step_count: 0,
      max_steps: 100,
      last_message_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,phone' })
    .select()
    .single()
  if (error) throw error
  return data as FlowSession
}

async function getFlowEntryNode(flowId: string): Promise<string> {
  const { data } = await supabase
    .from('flows')
    .select('entry_node_id')
    .eq('id', flowId)
    .single()
  return data?.entry_node_id ?? ''
}

async function isFlowPublished(flowId: string): Promise<boolean> {
  const { data } = await supabase
    .from('flows')
    .select('status')
    .eq('id', flowId)
    .single()
  return data?.status === 'published'
}

async function expireSession(sessionId: string): Promise<void> {
  await supabase
    .from('flow_sessions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

// ── Idempotency ───────────────────────────────────────────────────────────────

async function isDuplicateMessage(messageId: string, ownerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('processed_message_ids')
    .select('id')
    .eq('message_id', messageId)
    .eq('owner_id', ownerId)
    .single()
  if (data) return true
  // Mark as processed (ignore conflict — may race on duplicate delivery)
  await supabase.from('processed_message_ids').insert({
    message_id: messageId,
    owner_id: ownerId,
    processed_at: new Date().toISOString(),
  }).throwOnError()
  return false
}

// ── TurnDeps wiring ───────────────────────────────────────────────────────────

async function logConversation(
  requestId: string,
  ownerId: string,
  phone: string,
  direction: 'inbound' | 'outbound',
  content: string,
  msgType = 'bot',
): Promise<void> {
  const { error } = await supabase.from('conversation_logs').insert({
    owner_id: ownerId,
    phone,
    direction,
    content,
    msg_type: msgType,
  })
  if (error) console.error(`[${requestId}] conversation_logs ${direction} insert error:`, error)
}

async function recordContactMessage(requestId: string, ownerId: string, phone: string): Promise<void> {
  const { error } = await supabase.rpc('record_contact_message', {
    p_owner_id: ownerId,
    p_phone: phone,
  })
  if (error) console.error(`[${requestId}] record_contact_message error:`, error)
}

function buildTurnDeps(
  ownerId: string,
  ownerReceptionPhone: string | null,
  ownerCreds: { accessToken: string; phoneNumberId: string },
  requestId: string,
): TurnDeps {
  return {
    getNode: async (id) => {
      const { data } = await supabase.from('flow_nodes').select('*').eq('id', id).single()
      return data ?? null
    },

    getOutgoingEdges: async (nodeId) => {
      const { data } = await supabase.from('flow_edges').select('*').eq('source_node_id', nodeId)
      return data ?? []
    },

    saveSession: async (session) => {
      await supabase.from('flow_sessions').update({
        flow_id: session.flow_id,
        current_node_id: session.current_node_id,
        status: session.status,
        context: session.context,
        call_stack: session.call_stack,
        step_count: session.step_count,
        last_node_executed_at: session.last_node_executed_at,
        updated_at: new Date().toISOString(),
      }).eq('id', session.id)
    },

    enqueueMessages: async (messages, phone) => {
      for (const msg of messages) {
        await sendWhatsAppMessage(phone, msg, ownerCreds)
        // Log outbound bot message
        const text = msg.type === 'text' ? (msg.text ?? '') : `[${msg.type}] ${msg.url ?? ''}`
        await logConversation(requestId, ownerId, phone, 'outbound', text, 'bot')
      }
    },

    sendHandoffAlert: async (ownerPhone, customerPhone, department) => {
      await sendWhatsAppMessage(ownerPhone, {
        type: 'text',
        text: `New handoff from ${customerPhone}${department ? ` [${department}]` : ''}. Open inbox to reply.`,
      }, ownerCreds)
    },

    closeSession: async (session) => {
      await supabase.from('flow_sessions').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', session.id)
    },

    killSession: async (session, reason) => {
      console.error(`[engine] Session ${session.id} killed: ${reason}`)
      await supabase.from('flow_sessions').update({
        status: 'error',
        context: { ...session.context, __kill_reason: reason },
        updated_at: new Date().toISOString(),
      }).eq('id', session.id)
    },

    fetchFn: fetch,

    getSubflowEntryNode: async (subflowId) => {
      const { data } = await supabase.from('flows').select('entry_node_id').eq('id', subflowId).single()
      return data?.entry_node_id ?? null
    },

    ownerReceptionPhone: ownerReceptionPhone ?? undefined,
  }
}

// ── WhatsApp sender ───────────────────────────────────────────────────────────

async function sendWhatsAppMessage(to: string, msg: OutboundMessage, creds: { accessToken: string; phoneNumberId: string }): Promise<void> {
  const { accessToken, phoneNumberId } = creds

  let payload: Record<string, unknown>

  if (msg.type === 'text') {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: msg.preview_url ?? false, body: msg.text ?? '' },
      }
  } else if (msg.type === 'interactive') {
    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: msg.body ?? '' },
      action: {
        buttons: (msg.buttons ?? []).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    }

    if (msg.header?.url) {
      const headerMedia: Record<string, unknown> = { link: msg.header.url }
      if (msg.header.type === 'document') {
        headerMedia.filename = msg.header.filename ?? msg.header.url.split('/').pop()?.split('?')[0] ?? 'file'
      }
      interactive.header = {
        type: msg.header.type,
        [msg.header.type]: headerMedia,
      }
    }

    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    }
  } else {
    const mediaPayload: Record<string, unknown> = { link: msg.url }
    if (msg.caption) mediaPayload.caption = msg.caption
    if (msg.type === 'document') mediaPayload.filename = (msg.url ?? '').split('/').pop() || 'file'
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: msg.type,
      [msg.type]: mediaPayload,
    }
  }

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error(`[webhook] Send failed (${res.status}):`, await res.text())
  } catch (err) {
    console.error('[webhook] Send error:', err)
  }
}

// ── Signature verification ────────────────────────────────────────────────────

async function verifySignature(body: string, signature: string, appSecret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === signature
}

// ── Main receive_message ──────────────────────────────────────────────────────

async function receiveMessage(
  ownerId: string,
  phone: string,
  rawText: string,
  messageId: string,
  receptionPhone: string | null,
  ownerCreds: { accessToken: string; phoneNumberId: string },
  requestId: string,
): Promise<void> {
  // 1. Idempotency — skip if already processed
  try {
    if (await isDuplicateMessage(messageId, ownerId)) return
  } catch {
    // processed_message_ids table may not exist yet — proceed
  }

  // 2. Normalize input
  const text = normalize(rawText)

  // 3. Load triggers for this owner — only for published flows
  const { data: triggerRows } = await supabase
    .from('flow_triggers')
    .select('id, flow_id, target_node_id, trigger_type, trigger_value, priority, is_active, metadata, flows!inner(status)')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .eq('flows.status', 'published')
    .order('priority', { ascending: true })
  // Strip the nested flows join object before passing to trigger engine
  const triggers: FlowTrigger[] = (triggerRows ?? []).map(({ flows: _f, ...t }) => t as FlowTrigger)

  // 4. Get active session
  let session = await getActiveSession(ownerId, phone)

  if (session?.status === 'active' && !(await isFlowPublished(session.flow_id))) {
    await expireSession(session.id)
    session = null
  }

  // 5. Handoff guard: bot is silent during agent sessions
  if (session?.status === 'handoff') {
    console.log(`[webhook] Handoff session active for ${phone} — routing to inbox`)
    return
  }

  // 6. Restart trigger check (runs even if session active)
  const restart = findRestartTrigger(triggers, text)
  if (restart) {
    if (session) await expireSession(session.id)
    const newSession = await createSession(ownerId, phone, restart)
    const deps = buildTurnDeps(ownerId, receptionPhone, ownerCreds, requestId)
    await executeTurn(newSession, text, deps)
    return
  }

  // 7. Active session → continue
  if (session?.status === 'active') {
    const deps = buildTurnDeps(ownerId, receptionPhone, ownerCreds, requestId)
    await executeTurn(session, text, deps)
    return
  }

  // 8. No session → trigger resolution
  if (triggers.length === 0) {
    return
  }

  const trigger = resolveTrigger(triggers, text)
  if (!trigger) {
    await sendWhatsAppMessage(phone, { type: 'text', text: "Reply 'hi' to get started." }, ownerCreds)
    await logConversation(requestId, ownerId, phone, 'outbound', "Reply 'hi' to get started.", 'bot')
    return
  }
  const newSession = await createSession(ownerId, phone, trigger)
  const deps = buildTurnDeps(ownerId, receptionPhone, ownerCreds, requestId)
  await executeTurn(newSession, text, deps)
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)

  // GET — webhook verification
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log(`[${requestId}] Webhook verified`)
      return new Response(challenge, { status: 200 })
    }
    return new Response('Verification failed', { status: 403 })
  }

  // POST — receive messages
  if (req.method === 'POST') {
    try {
      const rawBody = await req.text()

      // Signature verification
      const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
      if (appSecret) {
        const signature = req.headers.get('x-hub-signature-256') || ''
        const isValid = await verifySignature(rawBody, signature.replace('sha256=', ''), appSecret)
        if (!isValid) {
          console.error(`[${requestId}] Invalid signature`)
          return new Response('Forbidden', { status: 403 })
        }
      }

      const body = JSON.parse(rawBody)
      const entry = body.entry?.[0]
      if (!entry) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

      const change = entry.changes?.[0]
      const value = change?.value
      if (!value?.messages || value.messages.length === 0) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }

      const message = value.messages[0]
      const customerPhone: string = message.from
      const businessNumber: string = value.metadata.display_phone_number
      let rawText = ''

      if (message.type === 'text') rawText = message.text?.body ?? ''
      else if (message.type === 'interactive') {
        rawText = message.interactive?.button_reply?.title
          ?? message.interactive?.list_reply?.title
          ?? ''
      }

      if (!rawText) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

      console.log(`[${requestId}] from=${customerPhone} biz=${businessNumber} text="${rawText}"`)

      const owner = await getOwner(businessNumber)
      if (!owner) {
        console.warn(`[${requestId}] No owner for ${businessNumber}`)
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }

      const ownerCreds = {
        accessToken: owner.whatsapp_api_token ?? Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '',
        phoneNumberId: owner.whatsapp_phone_number_id ?? Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
      }

      // Persist inbound activity before returning 200 so the edge runtime cannot drop it.
      await logConversation(requestId, owner.id, customerPhone, 'inbound', rawText, 'bot')
      await recordContactMessage(requestId, owner.id, customerPhone)

      // The turn executor has its own short timeout to stay within webhook limits.
      try {
        await receiveMessage(owner.id, customerPhone, rawText, message.id, owner.reception_phone, ownerCreds, requestId)
      } catch (err) {
        console.error(`[${requestId}] receiveMessage error:`, err)
      }

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error(`[${requestId}] Webhook error:`, error)
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})
