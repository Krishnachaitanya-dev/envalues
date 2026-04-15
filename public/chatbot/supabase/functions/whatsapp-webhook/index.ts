// Supabase Edge Function for WhatsApp Webhook
// Deno runtime with TypeScript

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// TYPES
// ============================================

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  interactive?: {
    type: string
    button_reply?: {
      id: string
      title: string
    }
  }
}

interface Chatbot {
  id: string
  owner_id: string
  chatbot_name: string
  greeting_message: string
  farewell_message: string
  is_active: boolean
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
}

// ============================================
// CONFIGURATION
// ============================================

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || 'https://graph.facebook.com/v21.0'
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Normalize phone number to include + prefix
 * WhatsApp sends: 917207268433
 * Database has: +917207268433
 */
function normalizePhoneNumber(phone: string): string {
  // Remove any whitespace
  const cleaned = phone.trim()
  
  // Add + if not present
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`
  }
  
  return cleaned
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  const url = new URL(req.url)
  
  // ============================================
  // GET - Webhook Verification
  // ============================================
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    
    console.log('Webhook verification request:', { mode, token })
    
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('Webhook verified successfully!')
      return new Response(challenge, { status: 200 })
    } else {
      console.error('Webhook verification failed')
      return new Response('Verification failed', { status: 403 })
    }
  }
  
  // ============================================
  // POST - Receive Messages
  // ============================================
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      
      // Extract message data
      const entry = body.entry?.[0]
      if (!entry) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }
      
      const change = entry.changes?.[0]
      const value = change?.value
      
      if (!value?.messages || value.messages.length === 0) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }
      
      const message: WhatsAppMessage = value.messages[0]
      const customerPhone = message.from
      const businessNumber = value.metadata.display_phone_number
      
      console.log(`Message from ${customerPhone} to business ${businessNumber}`)
      
      // 🔥 FIX: Normalize business number before database lookup
      const normalizedBusinessNumber = normalizePhoneNumber(businessNumber)
      console.log(`Normalized business number: ${businessNumber} → ${normalizedBusinessNumber}`)
      
      // Get chatbot by business number
      const chatbot = await getChatbotByBusinessNumber(normalizedBusinessNumber)
      
      if (!chatbot) {
        console.error(`No chatbot found for business number: ${normalizedBusinessNumber}`)
        return new Response(JSON.stringify({ status: 'error', message: 'Chatbot not found' }), { status: 200 })
      }
      
      // Route message based on type
      if (message.type === 'text') {
        await handleTextMessage(customerPhone, message.text!.body, chatbot)
      } else if (message.type === 'interactive' && message.interactive?.button_reply) {
        await handleButtonClick(customerPhone, message.interactive.button_reply.id, chatbot)
      }
      
      return new Response(JSON.stringify({ status: 'ok' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      
    } catch (error) {
      console.error('Error processing webhook:', error)
      return new Response(JSON.stringify({ status: 'error', message: error.message }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  return new Response('Method not allowed', { status: 405 })
})

// ============================================
// DATABASE FUNCTIONS
// ============================================

async function getChatbotByBusinessNumber(businessNumber: string): Promise<Chatbot | null> {
  try {
    console.log(`Querying database for business number: ${businessNumber}`)
    
    // Step 1: Find owner by WhatsApp number
    const { data: ownerData, error: ownerError } = await supabase
      .from('owners')
      .select('id')
      .eq('whatsapp_business_number', businessNumber)
      .single()
    
    if (ownerError || !ownerData) {
      console.log('Owner not found for number:', businessNumber)
      console.log('Owner error:', ownerError)
      return null
    }
    
    console.log('✅ Owner found:', ownerData.id)
    
    // Step 2: Get chatbot for this owner
    const { data: chatbotData, error: chatbotError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('owner_id', ownerData.id)
      .eq('is_active', true)
      .single()
    
    if (chatbotError || !chatbotData) {
      console.log('Chatbot not found for owner:', ownerData.id)
      console.log('Chatbot error:', chatbotError)
      return null
    }
    
    console.log('✅ Chatbot found:', chatbotData.chatbot_name)
    
    return chatbotData as Chatbot
  } catch (error) {
    console.error('Error getting chatbot:', error)
    return null
  }
}

async function getMainMenuQuestions(chatbotId: string): Promise<QAPair[]> {
  const { data, error } = await supabase
    .from('qa_pairs')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .is('parent_question_id', null)
    .eq('is_active', true)
    .order('display_order')
  
  if (error) {
    console.error('Error getting main menu:', error)
    return []
  }
  
  console.log(`Found ${data?.length || 0} main menu questions`)
  
  return data as QAPair[]
}

async function getQAPairById(qaId: string): Promise<QAPair | null> {
  const { data, error } = await supabase
    .from('qa_pairs')
    .select('*')
    .eq('id', qaId)
    .single()
  
  if (error) {
    console.error('Error getting QA pair:', error)
    return null
  }
  
  return data as QAPair
}

async function getChildQuestions(parentId: string): Promise<QAPair[]> {
  const { data, error } = await supabase
    .from('qa_pairs')
    .select('*')
    .eq('parent_question_id', parentId)
    .eq('is_active', true)
    .order('display_order')
  
  if (error) {
    console.error('Error getting child questions:', error)
    return []
  }
  
  return data as QAPair[]
}

// ============================================
// MESSAGE HANDLERS
// ============================================

async function handleTextMessage(customerPhone: string, text: string, chatbot: Chatbot) {
  const textLower = text.trim().toLowerCase()
  
  // GREETING
  if (['hi', 'hello', 'hey', 'start'].includes(textLower)) {
    console.log('Greeting message from:', customerPhone)
    
    const mainQuestions = await getMainMenuQuestions(chatbot.id)
    
    if (mainQuestions.length === 0) {
      await sendTextMessage(customerPhone, 'Sorry, the chatbot is not set up yet.')
      return
    }
    
    await sendInteractiveMessage(customerPhone, chatbot.greeting_message, mainQuestions)
  }
  // FAREWELL
  else if (['thank you', 'thanks', 'bye', 'goodbye'].includes(textLower)) {
    console.log('Farewell message from:', customerPhone)
    await sendTextMessage(customerPhone, chatbot.farewell_message)
  }
  // UNKNOWN
  else {
    console.log('Unknown text from:', customerPhone, text)
    await sendTextMessage(customerPhone, "I don't understand. Please click the buttons to interact with me! 😊")
  }
}

async function handleButtonClick(customerPhone: string, qaId: string, chatbot: Chatbot) {
  console.log('Button clicked:', qaId)
  
  const qaPair = await getQAPairById(qaId)
  
  if (!qaPair) {
    await sendTextMessage(customerPhone, 'Sorry, this option is no longer available.')
    return
  }
  
  const childQuestions = await getChildQuestions(qaId)
  const mainQuestions = await getMainMenuQuestions(chatbot.id)
  
  // Send answer with children or main menu
  const buttons = childQuestions.length > 0 ? childQuestions : mainQuestions
  await sendInteractiveMessage(customerPhone, qaPair.answer_text, buttons)
}

// ============================================
// WHATSAPP API FUNCTIONS
// ============================================

async function sendTextMessage(to: string, text: string) {
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: false,
      body: text
    }
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    if (response.ok) {
      console.log('✅ Text message sent to:', to)
    } else {
      const errorText = await response.text()
      console.error('❌ Failed to send text:', errorText)
    }
  } catch (error) {
    console.error('Error sending text message:', error)
  }
}

async function sendInteractiveMessage(to: string, bodyText: string, questions: QAPair[]) {
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  
  // WhatsApp allows max 3 buttons
  const limitedQuestions = questions.slice(0, 3)
  
  if (questions.length > 3) {
    console.warn(`Too many buttons (${questions.length}), showing only first 3`)
  }
  
  const buttons = limitedQuestions.map(qa => ({
    type: 'reply',
    reply: {
      id: qa.id,
      title: qa.question_text.substring(0, 20) // Max 20 chars
    }
  }))
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: bodyText
      },
      action: {
        buttons: buttons
      }
    }
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    if (response.ok) {
      console.log(`✅ Interactive message sent to ${to} with ${buttons.length} buttons`)
    } else {
      const errorText = await response.text()
      console.error('❌ Failed to send interactive message:', errorText)
    }
  } catch (error) {
    console.error('Error sending interactive message:', error)
  }
}