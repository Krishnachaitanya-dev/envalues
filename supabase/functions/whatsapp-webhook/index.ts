import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ────────────────────────────────────────────────────────────────────

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
}

interface Chatbot {
  id: string
  owner_id: string
  chatbot_name: string
  greeting_message: string
  farewell_message: string
  is_active: boolean
  chatbot_type: string // 'menu'
}

interface OwnerWithChatbot {
  chatbot: Chatbot
  whatsapp_api_token: string
  whatsapp_phone_number_id: string
}

interface QAPair {
  id: string
  chatbot_id: string
  question_text: string
  answer_text: string
  is_main_question: boolean
  parent_question_id: string | null
  display_order: number
  is_active: boolean
  media_url: string | null
  media_type: string | null
}

// ── Config ───────────────────────────────────────────────────────────────────

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || 'https://graph.facebook.com/v21.0'
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!

const RATE_LIMIT_WINDOW_MINUTES = 1
const RATE_LIMIT_MAX_REQUESTS = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhoneNumber(phone: string): string {
  return phone.trim().replace(/[\s\-\+\(\)]/g, '')
}

// ── Security ─────────────────────────────────────────────────────────────────

async function verifyWhatsAppSignature(body: string, signature: string, appSecret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === signature
}

async function checkRateLimit(ownerId: string, requestId: string): Promise<boolean> {
  try {
    const windowStart = new Date()
    windowStart.setMinutes(windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES)
    const { count } = await supabase.from('rate_limits').select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId).eq('endpoint', 'whatsapp-webhook').gte('window_start', windowStart.toISOString())
    if ((count || 0) >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`[${requestId}] Rate limit exceeded for owner: ${ownerId}`)
      return false
    }
    await supabase.from('rate_limits').insert({ owner_id: ownerId, endpoint: 'whatsapp-webhook', window_start: new Date().toISOString() })
    return true
  } catch { return true }
}

// ── Menu Bot: DB helpers ──────────────────────────────────────────────────────

async function saveMessage(chatbotId: string, customerPhone: string, direction: 'inbound' | 'outbound', content: string, msgType: string = 'text') {
  try {
    await supabase.from('messages').insert({ chatbot_id: chatbotId, customer_phone: customerPhone, direction, content, msg_type: msgType })
  } catch (err) { console.error('Failed to save message:', err) }
}

async function upsertContact(chatbotId: string, customerPhone: string) {
  try {
    const { data: existing } = await supabase.from('contacts').select('id, total_messages').eq('chatbot_id', chatbotId).eq('phone', customerPhone).single()
    if (existing) {
      await supabase.from('contacts').update({ last_active_at: new Date().toISOString(), total_messages: existing.total_messages + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('contacts').insert({ chatbot_id: chatbotId, phone: customerPhone, first_seen_at: new Date().toISOString(), last_active_at: new Date().toISOString(), total_messages: 1 })
    }
  } catch (err) { console.error('Failed to upsert contact:', err) }
}

async function getOwnerAndChatbot(businessNumber: string, requestId: string): Promise<OwnerWithChatbot | null> {
  try {
    const tryNumber = async (num: string) => {
      const { data: ownerData } = await supabase.from('owners').select('id, whatsapp_api_token, whatsapp_business_number').eq('whatsapp_business_number', num).single()
      if (!ownerData) return null
      const { data: chatbotData } = await supabase.from('chatbots').select('*').eq('owner_id', ownerData.id).eq('is_active', true).single()
      if (!chatbotData) return null
      return { chatbot: chatbotData as Chatbot, whatsapp_api_token: ownerData.whatsapp_api_token || '', whatsapp_phone_number_id: '' }
    }
    return (await tryNumber(businessNumber)) || (await tryNumber(`+${businessNumber}`))
  } catch (error) {
    console.error(`[${requestId}] DB error:`, error)
    return null
  }
}

async function getMainMenuQuestions(chatbotId: string): Promise<QAPair[]> {
  const { data } = await supabase.from('qa_pairs').select('*').eq('chatbot_id', chatbotId).is('parent_question_id', null).eq('is_active', true).order('display_order')
  return (data || []) as QAPair[]
}

async function getQAPairById(qaId: string): Promise<QAPair | null> {
  const { data } = await supabase.from('qa_pairs').select('*').eq('id', qaId).single()
  return data as QAPair | null
}

async function getChildQuestions(parentId: string): Promise<QAPair[]> {
  const { data } = await supabase.from('qa_pairs').select('*').eq('parent_question_id', parentId).eq('is_active', true).order('display_order')
  return (data || []) as QAPair[]
}

// ── Menu Bot: handlers ────────────────────────────────────────────────────────

async function handleTextMessage(customerPhone: string, text: string, chatbot: Chatbot, accessToken: string, phoneNumberId: string, requestId: string, sessionId?: string) {
  const textLower = text.trim().toLowerCase()
  const escalationKeywords = ['human', 'agent', 'support', 'help', 'representative', 'person', 'staff', 'operator']
  if (escalationKeywords.some(k => textLower.includes(k))) {
    await supabase.from('customer_sessions').upsert({ chatbot_id: chatbot.id, customer_phone_number: customerPhone, needs_human: true, escalated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }, { onConflict: 'chatbot_id,customer_phone_number' })
    const reply = "I've notified our team. An agent will reach out to you shortly. 🙏\n\nThank you for your patience!"
    await sendTextMessage(customerPhone, reply, accessToken, phoneNumberId, requestId)
    await saveMessage(chatbot.id, customerPhone, 'outbound', reply, 'text')
    return
  }
  if (sessionId) await supabase.from('customer_sessions').update({ last_activity_at: new Date().toISOString() }).eq('id', sessionId)
  if (['hi', 'hello', 'hey', 'start', 'menu'].includes(textLower)) {
    const mainQuestions = await getMainMenuQuestions(chatbot.id)
    if (mainQuestions.length === 0) {
      const reply = 'Sorry, the chatbot is not set up yet.'
      await sendTextMessage(customerPhone, reply, accessToken, phoneNumberId, requestId)
      await saveMessage(chatbot.id, customerPhone, 'outbound', reply, 'text')
      return
    }
    await sendInteractiveMessage(customerPhone, chatbot.greeting_message, mainQuestions, accessToken, phoneNumberId, requestId, chatbot.id)
  } else if (['thank you', 'thanks', 'bye', 'goodbye', 'exit'].includes(textLower)) {
    await sendTextMessage(customerPhone, chatbot.farewell_message, accessToken, phoneNumberId, requestId)
    await saveMessage(chatbot.id, customerPhone, 'outbound', chatbot.farewell_message, 'text')
  } else {
    const reply = "I don't understand. Please click the buttons to interact with me! 😊"
    await sendTextMessage(customerPhone, reply, accessToken, phoneNumberId, requestId)
    await saveMessage(chatbot.id, customerPhone, 'outbound', reply, 'text')
  }
}

async function handleButtonClick(customerPhone: string, qaId: string, chatbot: Chatbot, accessToken: string, phoneNumberId: string, requestId: string) {
  const qaPair = await getQAPairById(qaId)
  if (!qaPair) {
    const reply = 'Sorry, this option is no longer available.'
    await sendTextMessage(customerPhone, reply, accessToken, phoneNumberId, requestId)
    await saveMessage(chatbot.id, customerPhone, 'outbound', reply, 'text')
    return
  }
  if (qaPair.media_url && qaPair.media_type) {
    await sendMediaMessage(customerPhone, qaPair.media_url, qaPair.media_type, accessToken, phoneNumberId, requestId)
    await saveMessage(chatbot.id, customerPhone, 'outbound', `[${qaPair.media_type}: ${qaPair.media_url}]`, qaPair.media_type)
  }
  const childQuestions = await getChildQuestions(qaId)
  const mainQuestions = await getMainMenuQuestions(chatbot.id)
  const buttons = childQuestions.length > 0 ? childQuestions : mainQuestions
  await sendInteractiveMessage(customerPhone, qaPair.answer_text, buttons, accessToken, phoneNumberId, requestId, chatbot.id)
}

// ── WhatsApp API senders ──────────────────────────────────────────────────────

async function sendTextMessage(to: string, text: string, accessToken: string, phoneNumberId: string, requestId: string) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: text } })
    })
    if (!response.ok) console.error(`[${requestId}] ❌ Text send failed:`, await response.text())
    else console.log(`[${requestId}] ✅ Text sent to: ${to}`)
  } catch (error) { console.error(`[${requestId}] Send error:`, error) }
}

async function sendMediaMessage(to: string, mediaUrl: string, mediaType: string, accessToken: string, phoneNumberId: string, requestId: string, caption?: string) {
  const typeMap: Record<string, string> = { image: 'image', document: 'document', video: 'video' }
  const waType = typeMap[mediaType] || 'document'
  const mediaPayload: Record<string, unknown> = { link: mediaUrl }
  if (waType === 'document') mediaPayload.filename = mediaUrl.split('/').pop() || 'file'
  if (caption) mediaPayload.caption = caption
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: waType, [waType]: mediaPayload })
    })
    if (!response.ok) console.error(`[${requestId}] ❌ Media send failed:`, await response.text())
  } catch (error) { console.error(`[${requestId}] Media send error:`, error) }
}

async function sendInteractiveMessage(to: string, bodyText: string, questions: QAPair[], accessToken: string, phoneNumberId: string, requestId: string, chatbotId: string) {
  const limitedQuestions = questions.slice(0, 3)
  const buttons = limitedQuestions.map(qa => ({ type: 'reply', reply: { id: qa.id, title: qa.question_text.substring(0, 20) } }))
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive', interactive: { type: 'button', body: { text: bodyText }, action: { buttons } } })
    })
    if (response.ok) {
      const outboundContent = `${bodyText}\n[${limitedQuestions.map(q => q.question_text).join(' | ')}]`
      await saveMessage(chatbotId, to, 'outbound', outboundContent, 'interactive')
      console.log(`[${requestId}] ✅ Interactive sent to ${to}`)
    } else {
      console.error(`[${requestId}] ❌ Interactive send failed:`, await response.text())
    }
  } catch (error) { console.error(`[${requestId}] Interactive send error:`, error) }
}

// ── Main handler ──────────────────────────────────────────────────────────────

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
      console.log(`[${requestId}] ✅ Webhook verified`)
      return new Response(challenge, { status: 200 })
    }
    return new Response('Verification failed', { status: 403 })
  }

  // POST — receive messages
  if (req.method === 'POST') {
    try {
      const rawBody = await req.text()
      const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
      if (appSecret) {
        const signature = req.headers.get('x-hub-signature-256') || ''
        const isValid = await verifyWhatsAppSignature(rawBody, signature.replace('sha256=', ''), appSecret)
        if (!isValid) {
          console.error(`[${requestId}] ❌ Invalid signature`)
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

      const message: WhatsAppMessage = value.messages[0]
      const customerPhone = message.from
      const businessNumber = value.metadata.display_phone_number

      console.log(`[${requestId}] 📩 Message from ${customerPhone} to ${businessNumber}`)

      const normalizedNumber = normalizePhoneNumber(businessNumber)
      const ownerData = await getOwnerAndChatbot(normalizedNumber, requestId)
      if (!ownerData) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

      const { chatbot, whatsapp_api_token, whatsapp_phone_number_id } = ownerData
      const withinRateLimit = await checkRateLimit(chatbot.owner_id, requestId)
      if (!withinRateLimit) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      if (!whatsapp_api_token) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

      const phoneNumberId = whatsapp_phone_number_id || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''

      // ── Menu bot ──
      const { data: session } = await supabase.from('customer_sessions').select('id, agent_active, needs_human').eq('chatbot_id', chatbot.id).eq('customer_phone_number', customerPhone).single()

      if (message.type === 'text') {
        await Promise.all([saveMessage(chatbot.id, customerPhone, 'inbound', message.text!.body, 'text'), upsertContact(chatbot.id, customerPhone)])
        if (!session?.agent_active) await handleTextMessage(customerPhone, message.text!.body, chatbot, whatsapp_api_token, phoneNumberId, requestId, session?.id)
      } else if (message.type === 'interactive' && message.interactive?.button_reply) {
        await Promise.all([saveMessage(chatbot.id, customerPhone, 'inbound', message.interactive.button_reply.title, 'button'), upsertContact(chatbot.id, customerPhone)])
        if (!session?.agent_active) await handleButtonClick(customerPhone, message.interactive.button_reply.id, chatbot, whatsapp_api_token, phoneNumberId, requestId)
      }

      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error) {
      console.error(`[${requestId}] Webhook error:`, error)
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})
