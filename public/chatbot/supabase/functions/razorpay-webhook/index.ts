// Supabase Edge Function: razorpay-webhook
// Razorpay calls this automatically on payment events
// This flips chatbot.is_active true/false based on payment status

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// CONFIGURATION
// ============================================
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const razorpayWebhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================
// VERIFY RAZORPAY SIGNATURE
// Prevents fake webhook calls from bad actors
// ============================================
async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(body)

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return computedSignature === signature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''

    // ----------------------------------------
    // 1. Verify this request is really from Razorpay
    // ----------------------------------------
    const isValid = await verifyRazorpaySignature(body, signature, razorpayWebhookSecret)

    if (!isValid) {
      console.error('❌ Invalid Razorpay signature — possible fake request')
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.event
    const payload = event.payload

    console.log(`📩 Razorpay event received: ${eventType}`)

    // ----------------------------------------
    // 2. Extract subscription ID from payload
    // ----------------------------------------
    const razorpaySubscriptionId =
      payload?.subscription?.entity?.id ||
      payload?.payment?.entity?.subscription_id ||
      null

    if (!razorpaySubscriptionId) {
      console.log('No subscription ID in payload, skipping')
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    }

    console.log(`Subscription ID: ${razorpaySubscriptionId}`)

    // ----------------------------------------
    // 3. Find subscription in our database
    // ----------------------------------------
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, chatbot_id, owner_id, status')
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .single()

    if (subError || !subscription) {
      console.error('Subscription not found in DB:', razorpaySubscriptionId)
      // Still return 200 so Razorpay doesn't keep retrying
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    }

    // ----------------------------------------
    // 4. Handle each event type
    // ----------------------------------------
    switch (eventType) {

      // Payment succeeded — chatbot goes LIVE
      case 'subscription.activated':
      case 'subscription.charged': {
        const periodStart = payload?.subscription?.entity?.current_start
        const periodEnd = payload?.subscription?.entity?.current_end
        const paymentId = payload?.payment?.entity?.id || null

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            razorpay_payment_id: paymentId,
            current_period_start: periodStart
              ? new Date(periodStart * 1000).toISOString() : null,
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString() : null,
          })
          .eq('razorpay_subscription_id', razorpaySubscriptionId)

        await supabase
          .from('chatbots')
          .update({ is_active: true })
          .eq('id', subscription.chatbot_id)

        console.log(`✅ Chatbot ${subscription.chatbot_id} is now LIVE`)
        break
      }

      // Subscription paused (payment failing, Razorpay retrying)
      case 'subscription.paused': {
        await supabase
          .from('subscriptions')
          .update({ status: 'paused' })
          .eq('razorpay_subscription_id', razorpaySubscriptionId)

        await supabase
          .from('chatbots')
          .update({ is_active: false })
          .eq('id', subscription.chatbot_id)

        console.log(`⏸️ Chatbot ${subscription.chatbot_id} paused — payment failing`)
        break
      }

      // Subscription cancelled or expired — chatbot goes OFFLINE
      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired': {
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('razorpay_subscription_id', razorpaySubscriptionId)

        await supabase
          .from('chatbots')
          .update({ is_active: false })
          .eq('id', subscription.chatbot_id)

        console.log(`🔴 Chatbot ${subscription.chatbot_id} is now OFFLINE`)
        break
      }

      // Payment failed
      case 'payment.failed': {
        await supabase
          .from('subscriptions')
          .update({ status: 'paused' })
          .eq('razorpay_subscription_id', razorpaySubscriptionId)

        await supabase
          .from('chatbots')
          .update({ is_active: false })
          .eq('id', subscription.chatbot_id)

        console.log(`❌ Payment failed for chatbot ${subscription.chatbot_id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${eventType} — ignoring`)
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    // Always return 200 to Razorpay so it doesn't spam retries
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
  }
})
