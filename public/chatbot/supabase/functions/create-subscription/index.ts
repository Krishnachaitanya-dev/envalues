// Supabase Edge Function: create-subscription
// Called when user clicks "Go Live" on a chatbot
// Creates a Razorpay subscription and returns details
// for the frontend to open the payment popup

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// CONFIGURATION
// ============================================
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!
const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
const razorpayPlanId = Deno.env.get('RAZORPAY_PLAN_ID')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================
// CORS HEADERS
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // ----------------------------------------
    // 1. Verify user is authenticated
    // ----------------------------------------
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ----------------------------------------
    // 2. Get chatbot_id from request body
    // ----------------------------------------
    const { chatbot_id } = await req.json()

    if (!chatbot_id) {
      return new Response(
        JSON.stringify({ error: 'chatbot_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ----------------------------------------
    // 3. Verify this chatbot belongs to this user
    // ----------------------------------------
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, chatbot_name, owner_id')
      .eq('id', chatbot_id)
      .eq('owner_id', user.id)
      .single()

    if (chatbotError || !chatbot) {
      return new Response(
        JSON.stringify({ error: 'Chatbot not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ----------------------------------------
    // 4. Check if active subscription already exists
    // ----------------------------------------
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, status, razorpay_subscription_id')
      .eq('chatbot_id', chatbot_id)
      .single()

    if (existingSub?.status === 'active') {
      return new Response(
        JSON.stringify({ error: 'Chatbot already has an active subscription' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ----------------------------------------
    // 5. Get owner details for Razorpay
    // ----------------------------------------
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('full_name, whatsapp_business_number')
      .eq('id', user.id)
      .single()

    if (ownerError || !owner) {
      return new Response(
        JSON.stringify({ error: 'Owner profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ----------------------------------------
    // 6. Create Razorpay Subscription
    // ----------------------------------------
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        total_count: 12,         // 12 months, auto-renews after
        quantity: 1,
        notes: {
          chatbot_id: chatbot_id,
          chatbot_name: chatbot.chatbot_name,
          owner_id: user.id,
          owner_name: owner.full_name || '',
        }
      })
    })

    const razorpayData = await razorpayResponse.json()

    if (!razorpayResponse.ok) {
      console.error('Razorpay error:', razorpayData)
      return new Response(
        JSON.stringify({ error: 'Failed to create Razorpay subscription', details: razorpayData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Razorpay subscription created:', razorpayData.id)

    // ----------------------------------------
    // 7. Save subscription to our database
    // ----------------------------------------
    if (existingSub) {
      // Update existing inactive/cancelled subscription
      await supabase
        .from('subscriptions')
        .update({
          razorpay_subscription_id: razorpayData.id,
          status: 'inactive',
          amount: 50000,
          updated_at: new Date().toISOString()
        })
        .eq('chatbot_id', chatbot_id)
    } else {
      // Insert new subscription row
      await supabase
        .from('subscriptions')
        .insert({
          chatbot_id: chatbot_id,
          owner_id: user.id,
          razorpay_subscription_id: razorpayData.id,
          status: 'inactive',
          amount: 50000,
        })
    }

    // ----------------------------------------
    // 8. Return details to frontend
    // ----------------------------------------
    return new Response(
      JSON.stringify({
        subscription_id: razorpayData.id,
        razorpay_key_id: razorpayKeyId,
        amount: 50000,
        currency: 'INR',
        chatbot_name: chatbot.chatbot_name,
        owner_name: owner.full_name || '',
        owner_email: user.email || '',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})