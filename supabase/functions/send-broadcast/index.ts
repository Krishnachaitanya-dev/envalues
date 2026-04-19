import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptToken, getCorsHeaders, markAccountReauthRequired, resolveTenantAccountByOwnerId } from '../_shared/whatsapp.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || 'https://graph.facebook.com/v21.0'

const corsHeaders = getCorsHeaders()

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 650

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildTemplatePayload(to: string, templateName: string, languageCode: string, params: string[] | null) {
  const components: object[] = []
  if (params && params.length > 0) {
    components.push({
      type: 'body',
      parameters: params.map(value => ({ type: 'text', text: value })),
    })
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 ? { components } : {}),
    },
  }
}

async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  params: string[] | null,
  accessToken: string,
  phoneNumberId: string
): Promise<{ success: boolean; waMessageId?: string; errorDetail?: string; status?: number }> {
  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildTemplatePayload(to, templateName, languageCode, params)),
    })
    if (res.ok) {
      const data = await res.json()
      return { success: true, waMessageId: data?.messages?.[0]?.id ?? undefined }
    }
    const errBody = await res.text()
    let errorDetail = `HTTP ${res.status}`
    try { errorDetail = JSON.parse(errBody)?.error?.message ?? errorDetail } catch { /* keep */ }
    return { success: false, errorDetail, status: res.status }
  } catch (err: any) {
    return { success: false, errorDetail: err?.message ?? 'Network error', status: 0 }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { campaign_id } = await req.json()
    if (!campaign_id) return new Response(JSON.stringify({ error: 'Missing campaign_id' }), { status: 400, headers: corsHeaders })

    const { data: campaign, error: campErr } = await (supabase
      .from('broadcast_campaigns') as any)
      .select('*, broadcast_templates(template_name, language_code)')
      .eq('id', campaign_id)
      .eq('owner_id', user.id)
      .single()

    if (campErr || !campaign) return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 403, headers: corsHeaders })
    if (campaign.status !== 'draft') return new Response(JSON.stringify({ error: `Campaign is already ${campaign.status}` }), { status: 409, headers: corsHeaders })

    const account = await resolveTenantAccountByOwnerId(supabase, user.id)
    if (!account) return new Response(JSON.stringify({ error: 'WhatsApp credentials not configured' }), { status: 400, headers: corsHeaders })
    if (!account.sendingEnabled) return new Response(JSON.stringify({ error: 'Sending is disabled for this account' }), { status: 409, headers: corsHeaders })
    if (account.throttled) return new Response(JSON.stringify({ error: 'Account is throttled. Try later.' }), { status: 429, headers: corsHeaders })
    if (['reauth_required', 'revoked', 'expired'].includes(account.status)) {
      return new Response(JSON.stringify({ error: `WhatsApp account status is ${account.status}. Reconnect required.` }), { status: 409, headers: corsHeaders })
    }

    const accessToken = await decryptToken(account.tokenCiphertext, account.tokenKeyVersion)
    const phoneNumberId = account.phoneNumberId

    // Resolve phones
    let phones: string[] = []
    if (campaign.recipient_source === 'contacts' && campaign.chatbot_id) {
      const { data: contacts } = await supabase.from('contacts').select('phone').eq('chatbot_id', campaign.chatbot_id)
      phones = (contacts ?? []).map((c: any) => c.phone).filter(Boolean)
    } else {
      const { data: existing } = await (supabase.from('broadcast_recipients') as any).select('phone').eq('campaign_id', campaign_id).eq('status', 'pending')
      phones = (existing ?? []).map((r: any) => r.phone)
    }

    if (phones.length === 0) {
      await (supabase.from('broadcast_campaigns') as any).update({ status: 'failed', completed_at: new Date().toISOString(), total_count: 0 }).eq('id', campaign_id)
      return new Response(JSON.stringify({ error: 'No recipients found' }), { status: 400, headers: corsHeaders })
    }

    const uniquePhones = [...new Set(phones)]

    // Pre-populate recipient rows for contacts source
    if (campaign.recipient_source === 'contacts') {
      for (let i = 0; i < uniquePhones.length; i += 500) {
        await (supabase.from('broadcast_recipients') as any).upsert(
          uniquePhones.slice(i, i + 500).map(phone => ({ campaign_id, owner_id: user.id, phone, status: 'pending' })),
          { onConflict: 'campaign_id,phone' }
        )
      }
    }

    await (supabase.from('broadcast_campaigns') as any).update({
      status: 'processing',
      total_count: uniquePhones.length,
      started_at: new Date().toISOString(),
    }).eq('id', campaign_id)

    const templateName = campaign.broadcast_templates?.template_name ?? campaign.template_name
    const languageCode = campaign.broadcast_templates?.language_code ?? 'en'
    const params: string[] | null = campaign.template_params ?? null

    let sentCount = 0
    let failedCount = 0

    for (let batchStart = 0; batchStart < uniquePhones.length; batchStart += BATCH_SIZE) {
      const batch = uniquePhones.slice(batchStart, batchStart + BATCH_SIZE)

      await Promise.all(batch.map(async (phone) => {
        const result = await sendTemplateMessage(phone, templateName, languageCode, params, accessToken, phoneNumberId)
        if (result.success) {
          sentCount++
          await (supabase.from('broadcast_recipients') as any).update({ status: 'sent', wa_message_id: result.waMessageId ?? null, sent_at: new Date().toISOString() }).eq('campaign_id', campaign_id).eq('phone', phone)
        } else {
          if (result.status === 401 || result.status === 403) {
            await markAccountReauthRequired(supabase, {
              ownerId: account.ownerId,
              accountId: account.accountId,
              reason: result.errorDetail ?? 'Meta rejected token',
            })
          }
          failedCount++
          await (supabase.from('broadcast_recipients') as any).update({ status: 'failed', error_detail: result.errorDetail ?? 'Unknown error' }).eq('campaign_id', campaign_id).eq('phone', phone)
        }
      }))

      if (batchStart + BATCH_SIZE < uniquePhones.length) await sleep(BATCH_DELAY_MS)
    }

    const finalStatus = failedCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'partial'

    await (supabase.from('broadcast_campaigns') as any).update({
      status: finalStatus,
      sent_count: sentCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    }).eq('id', campaign_id)

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount, status: finalStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('send-broadcast error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
