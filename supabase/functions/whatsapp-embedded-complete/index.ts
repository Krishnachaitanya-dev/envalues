import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encryptToken, getCorsHeaders } from '../_shared/whatsapp.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const META_APP_ID = Deno.env.get('META_APP_ID') || ''
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || Deno.env.get('WHATSAPP_APP_SECRET') || ''
const META_EMBEDDED_SIGNUP_REDIRECT_URI = Deno.env.get('META_EMBEDDED_SIGNUP_REDIRECT_URI') || ''
const META_API_VERSION = Deno.env.get('META_API_VERSION') || 'v21.0'
const META_GRAPH_BASE = Deno.env.get('META_GRAPH_BASE') || `https://graph.facebook.com/${META_API_VERSION}`

type MetaBusiness = { id: string; name?: string }
type MetaPhone = { id: string; display_phone_number?: string; verified_name?: string }
type MetaWaba = { id: string; name?: string; phone_numbers?: MetaPhone[] | { data?: MetaPhone[] } }

function normalizeBusinessNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/[^\d]/g, '')
  return digits || null
}

function unwrapDataArray<T>(value: T[] | { data?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

async function fetchMetaJson(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_GRAPH_BASE}/${path.replace(/^\/+/, '')}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = null }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta API ${response.status}`)
  }
  return data
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const tokenUrl = new URL(`${META_GRAPH_BASE}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id', META_APP_ID)
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
  tokenUrl.searchParams.set('redirect_uri', META_EMBEDDED_SIGNUP_REDIRECT_URI)
  tokenUrl.searchParams.set('code', code)

  const response = await fetch(tokenUrl.toString())
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = null }

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error?.message || `Token exchange failed (${response.status})`)
  }
  return data.access_token as string
}

async function findBusinessAsset(accessToken: string): Promise<{
  businessId: string | null
  businessName: string | null
  wabaId: string
  wabaName: string | null
  phoneNumberId: string
  businessNumber: string | null
  displayName: string | null
}> {
  const businessesRes = await fetchMetaJson('me/businesses', accessToken, {
    fields: 'id,name',
    limit: '25',
  })
  const businesses = (businessesRes?.data ?? []) as MetaBusiness[]

  for (const business of businesses) {
    const wabasRes = await fetchMetaJson(`${business.id}/owned_whatsapp_business_accounts`, accessToken, {
      fields: 'id,name,phone_numbers{id,display_phone_number,verified_name}',
      limit: '25',
    })
    const wabas = (wabasRes?.data ?? []) as MetaWaba[]
    for (const waba of wabas) {
      const phones = unwrapDataArray<MetaPhone>(waba.phone_numbers)
      const phone = phones.find(p => !!p?.id)
      if (!phone?.id) continue
      return {
        businessId: business.id,
        businessName: business.name ?? null,
        wabaId: waba.id,
        wabaName: waba.name ?? null,
        phoneNumberId: phone.id,
        businessNumber: normalizeBusinessNumber(phone.display_phone_number),
        displayName: phone.verified_name ?? null,
      }
    }
  }

  const ownedWabasRes = await fetchMetaJson('me/owned_whatsapp_business_accounts', accessToken, {
    fields: 'id,name,phone_numbers{id,display_phone_number,verified_name}',
    limit: '25',
  })
  const ownedWabas = (ownedWabasRes?.data ?? []) as MetaWaba[]
  for (const waba of ownedWabas) {
    const phones = unwrapDataArray<MetaPhone>(waba.phone_numbers)
    const phone = phones.find(p => !!p?.id)
    if (!phone?.id) continue
    return {
      businessId: null,
      businessName: null,
      wabaId: waba.id,
      wabaName: waba.name ?? null,
      phoneNumberId: phone.id,
      businessNumber: normalizeBusinessNumber(phone.display_phone_number),
      displayName: phone.verified_name ?? null,
    }
  }

  throw new Error('No WhatsApp Business Account with phone number found for this login')
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  let connectSession: any = null

  try {
    if (!(META_APP_ID && META_APP_SECRET && META_EMBEDDED_SIGNUP_REDIRECT_URI)) {
      return new Response(JSON.stringify({
        error: 'Embedded signup is not fully configured on server',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json().catch(() => ({}))
    const state = String(payload?.state ?? '').trim()
    const code = String(payload?.code ?? '').trim()
    const oauthError = payload?.error ? String(payload.error) : ''
    const oauthErrorDescription = payload?.error_description ? String(payload.error_description) : ''
    const confirmReplace = payload?.confirm_replace === true

    if (!state) {
      return new Response(JSON.stringify({ error: 'Missing state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: session, error: sessionErr } = await (supabase.from('whatsapp_connect_sessions') as any)
      .select('*')
      .eq('state', state)
      .maybeSingle()
    if (sessionErr) throw sessionErr
    if (!session) {
      return new Response(JSON.stringify({ error: 'Invalid or expired connect session' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    connectSession = session

    if (connectSession.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Connect session does not belong to current user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (connectSession.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Connect session already used', session_status: connectSession.status }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(connectSession.expires_at).getTime() < Date.now()) {
      await (supabase.from('whatsapp_connect_sessions') as any)
        .update({ status: 'expired' })
        .eq('id', connectSession.id)
      return new Response(JSON.stringify({ error: 'Connect session expired. Please start again.' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (oauthError) {
      await (supabase.from('whatsapp_connect_sessions') as any)
        .update({ status: 'cancelled' })
        .eq('id', connectSession.id)
      return new Response(JSON.stringify({
        error: 'Meta authorization was cancelled',
        oauth_error: oauthError,
        oauth_error_description: oauthErrorDescription || null,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: existingAccount } = await (supabase.from('whatsapp_accounts') as any)
      .select('id, status, phone_number_id, token_ciphertext, sending_enabled, throttled, daily_send_cap, burst_per_minute_cap, plan_message_limit')
      .eq('owner_id', user.id)
      .maybeSingle()
    const { data: ownerRow } = await (supabase.from('owners') as any)
      .select('id, whatsapp_phone_number_id, whatsapp_api_token, whatsapp_business_number')
      .eq('id', user.id)
      .single()

    const hasExistingConfig = Boolean(
      (existingAccount?.phone_number_id && existingAccount?.token_ciphertext) ||
      (ownerRow?.whatsapp_phone_number_id && ownerRow?.whatsapp_api_token),
    )
    if (hasExistingConfig && !confirmReplace) {
      return new Response(JSON.stringify({
        error: 'Existing WhatsApp credentials detected. Confirmation required before replacement.',
        error_code: 'replace_confirmation_required',
        requires_confirm_replace: true,
        state,
        code,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await exchangeCodeForToken(code)
    const asset = await findBusinessAsset(accessToken)
    const encryptedToken = await encryptToken(accessToken)
    const nowIso = new Date().toISOString()

    const accountPayload = {
      owner_id: user.id,
      status: 'active',
      waba_id: asset.wabaId,
      meta_business_id: asset.businessId,
      phone_number_id: asset.phoneNumberId,
      business_number: asset.businessNumber ?? ownerRow?.whatsapp_business_number ?? null,
      display_name: asset.displayName ?? asset.wabaName ?? null,
      token_ciphertext: encryptedToken,
      token_key_version: 'enc:v1',
      connected_at: nowIso,
      token_last_verified_at: nowIso,
      disconnect_reason: null,
      sending_enabled: existingAccount?.sending_enabled ?? true,
      throttled: false,
      daily_send_cap: existingAccount?.daily_send_cap ?? null,
      burst_per_minute_cap: existingAccount?.burst_per_minute_cap ?? null,
      plan_message_limit: existingAccount?.plan_message_limit ?? null,
      updated_at: nowIso,
    }

    const { data: upsertedAccount, error: upsertErr } = await (supabase.from('whatsapp_accounts') as any)
      .upsert(accountPayload, { onConflict: 'owner_id' })
      .select('id, owner_id, status, phone_number_id, business_number, waba_id, display_name')
      .single()
    if (upsertErr) throw upsertErr

    await (supabase.from('whatsapp_connect_sessions') as any)
      .update({
        status: 'completed',
        completed_at: nowIso,
      })
      .eq('id', connectSession.id)

    await (supabase.from('whatsapp_account_events') as any).insert({
      owner_id: user.id,
      account_id: upsertedAccount?.id ?? existingAccount?.id ?? null,
      event_type: hasExistingConfig ? 'embedded_signup_reconnected' : 'embedded_signup_connected',
      message: hasExistingConfig
        ? 'Embedded signup connected and replaced existing credentials'
        : 'Embedded signup connected successfully',
      metadata: {
        phone_number_id: asset.phoneNumberId,
        waba_id: asset.wabaId,
        meta_business_id: asset.businessId,
        replaced_existing: hasExistingConfig,
      },
    })

    await (supabase.from('audit_logs') as any).insert({
      owner_id: user.id,
      action: hasExistingConfig ? 'whatsapp_embedded_signup_reconnected' : 'whatsapp_embedded_signup_connected',
      resource_type: 'whatsapp_account',
      resource_id: upsertedAccount?.id ?? null,
      metadata: {
        phone_number_id: asset.phoneNumberId,
        waba_id: asset.wabaId,
        replaced_existing: hasExistingConfig,
      },
    })

    return new Response(JSON.stringify({
      ok: true,
      replaced_existing: hasExistingConfig,
      account: {
        id: upsertedAccount?.id ?? null,
        status: upsertedAccount?.status ?? 'active',
        phone_number_id: upsertedAccount?.phone_number_id ?? asset.phoneNumberId,
        business_number: upsertedAccount?.business_number ?? asset.businessNumber,
        waba_id: upsertedAccount?.waba_id ?? asset.wabaId,
        display_name: upsertedAccount?.display_name ?? asset.displayName,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[whatsapp-embedded-complete] error:', error)
    if (connectSession?.id) {
      await (supabase.from('whatsapp_connect_sessions') as any)
        .update({ status: 'cancelled' })
        .eq('id', connectSession.id)
        .eq('status', 'pending')
    }
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
