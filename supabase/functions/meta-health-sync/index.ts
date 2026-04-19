import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptToken, getCorsHeaders, markAccountReauthRequired, resolveTenantAccountByOwnerId } from '../_shared/whatsapp.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || 'https://graph.facebook.com/v21.0'

serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const account = await resolveTenantAccountByOwnerId(supabase, user.id)
    if (!account || !account.accountId) {
      return new Response(JSON.stringify({ error: 'WhatsApp account not configured' }), { status: 400, headers: corsHeaders })
    }

    const accessToken = await decryptToken(account.tokenCiphertext, account.tokenKeyVersion)
    const fields = encodeURIComponent('quality_rating,messaging_limit_tier,display_phone_number,verified_name')
    const res = await fetch(`${WHATSAPP_API_URL}/${account.phoneNumberId}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const raw = await res.text()
    let data: any = null
    try { data = raw ? JSON.parse(raw) : null } catch { data = null }

    if (!res.ok) {
      const reason = data?.error?.message || `HTTP ${res.status}`
      if (res.status === 401 || res.status === 403) {
        await markAccountReauthRequired(supabase, {
          ownerId: account.ownerId,
          accountId: account.accountId,
          reason,
        })
      }
      return new Response(JSON.stringify({ ok: false, error: reason }), {
        status: res.status === 401 || res.status === 403 ? 409 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nowIso = new Date().toISOString()
    await (supabase.from('whatsapp_accounts') as any).update({
      quality_rating: data?.quality_rating ?? null,
      messaging_limit_tier: data?.messaging_limit_tier ?? null,
      business_number: data?.display_phone_number ?? account.businessNumber,
      display_name: data?.verified_name ?? null,
      quality_last_synced_at: nowIso,
      token_last_verified_at: nowIso,
      updated_at: nowIso,
    }).eq('id', account.accountId)

    await (supabase.from('whatsapp_account_events') as any).insert({
      owner_id: account.ownerId,
      account_id: account.accountId,
      event_type: 'meta_health_synced',
      message: 'WhatsApp account metadata synced from Meta',
      metadata: {
        quality_rating: data?.quality_rating ?? null,
        messaging_limit_tier: data?.messaging_limit_tier ?? null,
      },
    })

    return new Response(JSON.stringify({
      ok: true,
      quality_rating: data?.quality_rating ?? null,
      messaging_limit_tier: data?.messaging_limit_tier ?? null,
      synced_at: nowIso,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[meta-health-sync] error:', error)
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
