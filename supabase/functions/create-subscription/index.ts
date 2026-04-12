import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!
const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
const razorpayPlanId = Deno.env.get('RAZORPAY_PLAN_ID')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  // Generate request ID for tracing
  const requestId = crypto.randomUUID()
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Validate JWT using getClaims
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error(`[${requestId}] Missing authorization header`)
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      console.error(`[${requestId}] Invalid or expired token`)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string
    const userEmail = claimsData.claims.email as string

    // Use service role client for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const { chatbot_id } = body

    // Validate chatbot_id exists and is a valid UUID
    if (!chatbot_id) {
      console.error(`[${requestId}] Missing chatbot_id`)
      return new Response(
        JSON.stringify({ error: 'chatbot_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UUID_REGEX.test(chatbot_id)) {
      console.error(`[${requestId}] Invalid chatbot_id format: ${chatbot_id}`)
      return new Response(
        JSON.stringify({ error: 'Invalid chatbot_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify chatbot belongs to user
    const { data: chatbot, error: chatbotError } = await adminClient
      .from('chatbots')
      .select('id, chatbot_name, owner_id')
      .eq('id', chatbot_id)
      .eq('owner_id', userId)
      .single()

    if (chatbotError || !chatbot) {
      console.error(`[${requestId}] Chatbot not found or access denied: ${chatbot_id}`)
      return new Response(
        JSON.stringify({ error: 'Chatbot not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check existing subscription
    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('id, status, razorpay_subscription_id')
      .eq('chatbot_id', chatbot_id)
      .single()

    if (existingSub?.status === 'active') {
      console.log(`[${requestId}] Chatbot already has active subscription`)
      return new Response(
        JSON.stringify({ error: 'Chatbot already has an active subscription' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get owner details
    const { data: owner, error: ownerError } = await adminClient
      .from('owners')
      .select('full_name, whatsapp_business_number')
      .eq('id', userId)
      .single()

    if (ownerError || !owner) {
      console.error(`[${requestId}] Owner profile not found: ${userId}`)
      return new Response(
        JSON.stringify({ error: 'Owner profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Razorpay Subscription
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        total_count: 12,
        quantity: 1,
        notes: {
          chatbot_id,
          chatbot_name: chatbot.chatbot_name,
          owner_id: userId,
          owner_name: owner.full_name || '',
        }
      })
    })

    const razorpayData = await razorpayResponse.json()
    if (!razorpayResponse.ok) {
      console.error(`[${requestId}] Razorpay error:`, razorpayData)
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${requestId}] ✅ Razorpay subscription created: ${razorpayData.id}`)

    // Save subscription
    if (existingSub) {
      await adminClient
        .from('subscriptions')
        .update({
          razorpay_subscription_id: razorpayData.id,
          status: 'inactive',
          amount: 50000,
          updated_at: new Date().toISOString()
        })
        .eq('chatbot_id', chatbot_id)
    } else {
      await adminClient
        .from('subscriptions')
        .insert({
          chatbot_id,
          owner_id: userId,
          razorpay_subscription_id: razorpayData.id,
          status: 'inactive',
          amount: 50000,
        })
    }

    return new Response(
      JSON.stringify({
        subscription_id: razorpayData.id,
        razorpay_key_id: razorpayKeyId,
        amount: 50000,
        currency: 'INR',
        chatbot_name: chatbot.chatbot_name,
        owner_name: owner.full_name || '',
        owner_email: userEmail || '',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
