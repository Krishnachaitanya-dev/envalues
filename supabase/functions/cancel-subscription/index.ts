import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!
const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  const requestId = crypto.randomUUID()

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { subscription_id } = await req.json()
    if (!subscription_id) {
      return new Response(
        JSON.stringify({ error: 'subscription_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch and verify subscription belongs to this user
    const { data: sub, error: subError } = await adminClient
      .from('subscriptions')
      .select('id, status, razorpay_subscription_id, chatbot_id')
      .eq('id', subscription_id)
      .eq('owner_id', userId)
      .single()

    if (subError || !sub) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (sub.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Only active subscriptions can be cancelled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cancel on Razorpay (cancel_at_cycle_end=1 → continues until period ends)
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)
    const rzpResponse = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${razorpayAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      }
    )

    if (!rzpResponse.ok) {
      const rzpError = await rzpResponse.json()
      console.error(`[${requestId}] Razorpay cancel error:`, rzpError)
      return new Response(
        JSON.stringify({ error: rzpError.error?.description ?? 'Failed to cancel on Razorpay' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update DB — mark as cancelled
    await adminClient
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', subscription_id)

    // Log to audit
    await adminClient.from('audit_logs').insert({
      owner_id: userId,
      action: 'subscription_cancelled',
      resource_type: 'subscription',
      resource_id: subscription_id,
      metadata: { razorpay_subscription_id: sub.razorpay_subscription_id },
    })

    console.log(`[${requestId}] ✅ Subscription cancelled: ${subscription_id}`)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error(`[${requestId}] Unexpected error:`, err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
