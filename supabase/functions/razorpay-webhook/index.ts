import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const razorpayWebhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function verifyRazorpaySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(body)
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const computedSignature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    return computedSignature === signature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

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
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''

    const isValid = await verifyRazorpaySignature(body, signature, razorpayWebhookSecret)
    if (!isValid) {
      console.error(`[${requestId}] ❌ Invalid Razorpay signature`)
      // Log security event
      await supabase.from('security_events').insert({
        event_type: 'webhook_signature_failure',
        request_id: requestId,
        metadata: { source: 'razorpay', ip: req.headers.get('x-forwarded-for') || 'unknown' }
      })
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.event
    const payload = event.payload

    console.log(`[${requestId}] 📩 Razorpay event: ${eventType}`)

    const razorpaySubscriptionId =
      payload?.subscription?.entity?.id ||
      payload?.payment?.entity?.subscription_id ||
      null

    if (!razorpaySubscriptionId) {
      console.log(`[${requestId}] No subscription ID in payload, skipping`)
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: corsHeaders })
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, chatbot_id, owner_id, status')
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .single()

    if (subError || !subscription) {
      console.error(`[${requestId}] Subscription not found: ${razorpaySubscriptionId}`)
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: corsHeaders })
    }

    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.charged': {
        const periodStart = payload?.subscription?.entity?.current_start
        const periodEnd = payload?.subscription?.entity?.current_end
        const paymentId = payload?.payment?.entity?.id || null

        await supabase.from('subscriptions').update({
          status: 'active',
          razorpay_payment_id: paymentId,
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        }).eq('razorpay_subscription_id', razorpaySubscriptionId)

        await supabase.from('chatbots').update({ is_active: true }).eq('id', subscription.chatbot_id)
        console.log(`[${requestId}] ✅ Chatbot ${subscription.chatbot_id} is now LIVE`)
        break
      }

      case 'subscription.paused':
      case 'payment.failed': {
        await supabase.from('subscriptions').update({ status: 'paused' }).eq('razorpay_subscription_id', razorpaySubscriptionId)
        await supabase.from('chatbots').update({ is_active: false }).eq('id', subscription.chatbot_id)
        console.log(`[${requestId}] ⏸️ Chatbot ${subscription.chatbot_id} paused`)
        break
      }

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired': {
        await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('razorpay_subscription_id', razorpaySubscriptionId)
        await supabase.from('chatbots').update({ is_active: false }).eq('id', subscription.chatbot_id)
        console.log(`[${requestId}] 🔴 Chatbot ${subscription.chatbot_id} OFFLINE`)
        break
      }

      default:
        console.log(`[${requestId}] Unhandled event: ${eventType}`)
    }

    return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error)
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: corsHeaders })
  }
})
