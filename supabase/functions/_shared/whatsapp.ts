import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type OutboundMediaHeader = {
  type: 'image' | 'video' | 'document'
  url: string
  filename?: string
}

export type OutboundListMenu = {
  buttonText: string
  sections: Array<{
    title?: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>
}

export type OutboundMessage = {
  type: 'text' | 'image' | 'video' | 'document' | 'interactive' | 'list'
  text?: string
  preview_url?: boolean
  url?: string
  caption?: string
  body?: string
  footer?: string
  buttons?: Array<{ id: string; title: string }>
  header?: OutboundMediaHeader
  list?: OutboundListMenu
}

export type TenantWhatsAppAccount = {
  ownerId: string
  accountId: string | null
  status: string
  phoneNumberId: string
  businessNumber: string | null
  tokenCiphertext: string
  tokenKeyVersion: string
  sendingEnabled: boolean
  throttled: boolean
  dailySendCap: number | null
  burstPerMinuteCap: number | null
  planMessageLimit: number | null
  receptionPhone: string | null
}

const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || 'https://graph.facebook.com/v21.0'
const TOKEN_PREFIX = 'enc:v1:'

export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function getAesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('WHATSAPP_TOKEN_ENCRYPTION_KEY') || ''
  const keyBytes = base64ToBytes(raw)
  if (keyBytes.length !== 32) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY must be base64-encoded 32-byte key')
  }
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptToken(token: string): Promise<string> {
  const key = await getAesKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(token)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return `${TOKEN_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`
}

export async function decryptToken(tokenCiphertext: string, tokenKeyVersion?: string | null): Promise<string> {
  if (!tokenCiphertext) return ''
  if (tokenKeyVersion === 'legacy_plaintext' || !tokenCiphertext.startsWith(TOKEN_PREFIX)) return tokenCiphertext

  const raw = tokenCiphertext.slice(TOKEN_PREFIX.length)
  const [ivB64, cipherB64] = raw.split(':')
  if (!ivB64 || !cipherB64) throw new Error('Invalid encrypted token format')

  const key = await getAesKey()
  const iv = base64ToBytes(ivB64)
  const ciphertext = base64ToBytes(cipherB64)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plain)
}

async function findAccountByOwnerId(supabase: SupabaseClient, ownerId: string) {
  const { data } = await (supabase
    .from('whatsapp_accounts') as unknown as {
      select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: any }> } }
    })
    .select('id, owner_id, status, phone_number_id, business_number, token_ciphertext, token_key_version, sending_enabled, throttled, daily_send_cap, burst_per_minute_cap, plan_message_limit')
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data ?? null
}

async function fallbackOwnerCreds(supabase: SupabaseClient, ownerId: string) {
  const { data } = await (supabase
    .from('owners') as unknown as {
      select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: any }> } }
    })
    .select('id, whatsapp_business_number, whatsapp_phone_number_id, whatsapp_api_token, reception_phone')
    .eq('id', ownerId)
    .maybeSingle()
  return data ?? null
}

export async function resolveTenantAccountByOwnerId(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<TenantWhatsAppAccount | null> {
  const account = await findAccountByOwnerId(supabase, ownerId)
  const ownerFallback = await fallbackOwnerCreds(supabase, ownerId)
  if (!ownerFallback) return null

  const phoneNumberId = account?.phone_number_id ?? ownerFallback.whatsapp_phone_number_id
  const tokenCiphertext = account?.token_ciphertext ?? ownerFallback.whatsapp_api_token
  if (!phoneNumberId || !tokenCiphertext) return null

  return {
    ownerId,
    accountId: account?.id ?? null,
    status: account?.status ?? 'active',
    phoneNumberId,
    businessNumber: account?.business_number ?? ownerFallback.whatsapp_business_number ?? null,
    tokenCiphertext,
    tokenKeyVersion: account?.token_key_version ?? 'legacy_plaintext',
    sendingEnabled: account?.sending_enabled ?? true,
    throttled: account?.throttled ?? false,
    dailySendCap: account?.daily_send_cap ?? null,
    burstPerMinuteCap: account?.burst_per_minute_cap ?? null,
    planMessageLimit: account?.plan_message_limit ?? null,
    receptionPhone: ownerFallback.reception_phone ?? null,
  }
}

export async function resolveTenantAccountByInbound(
  supabase: SupabaseClient,
  opts: { phoneNumberId?: string | null; businessNumber?: string | null },
): Promise<TenantWhatsAppAccount | null> {
  if (opts.phoneNumberId) {
    const { data: account } = await (supabase
      .from('whatsapp_accounts') as unknown as {
        select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: any }> } }
      })
      .select('id, owner_id, status, phone_number_id, business_number, token_ciphertext, token_key_version, sending_enabled, throttled, daily_send_cap, burst_per_minute_cap, plan_message_limit')
      .eq('phone_number_id', opts.phoneNumberId)
      .maybeSingle()

    if (account?.owner_id) {
      const owner = await fallbackOwnerCreds(supabase, account.owner_id)
      if (!owner) return null
      return {
        ownerId: account.owner_id,
        accountId: account.id,
        status: account.status ?? 'active',
        phoneNumberId: account.phone_number_id,
        businessNumber: account.business_number ?? owner.whatsapp_business_number ?? null,
        tokenCiphertext: account.token_ciphertext ?? owner.whatsapp_api_token ?? '',
        tokenKeyVersion: account.token_key_version ?? 'legacy_plaintext',
        sendingEnabled: account.sending_enabled ?? true,
        throttled: account.throttled ?? false,
        dailySendCap: account.daily_send_cap ?? null,
        burstPerMinuteCap: account.burst_per_minute_cap ?? null,
        planMessageLimit: account.plan_message_limit ?? null,
        receptionPhone: owner.reception_phone ?? null,
      }
    }
  }

  const business = (opts.businessNumber ?? '').replace(/[\s\-\+\(\)]/g, '')
  if (!business) return null
  for (const num of [business, `+${business}`]) {
    const { data: owner } = await (supabase
      .from('owners') as unknown as {
        select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: any }> } }
      })
      .select('id')
      .eq('whatsapp_business_number', num)
      .maybeSingle()
    if (!owner?.id) continue
    return resolveTenantAccountByOwnerId(supabase, owner.id)
  }

  return null
}

export async function markAccountReauthRequired(
  supabase: SupabaseClient,
  params: { ownerId: string; accountId: string | null; reason: string },
) {
  if (!params.accountId) return
  await (supabase.from('whatsapp_accounts') as any)
    .update({
      status: 'reauth_required',
      disconnect_reason: params.reason.slice(0, 500),
      last_send_error_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.accountId)

  await (supabase.from('whatsapp_account_events') as any).insert({
    owner_id: params.ownerId,
    account_id: params.accountId,
    event_type: 'token_invalid',
    message: 'WhatsApp token requires reconnect (401/403)',
    metadata: { reason: params.reason.slice(0, 500) },
  })
}

function buildPayload(to: string, msg: OutboundMessage): Record<string, unknown> {
  if (msg.type === 'text') {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: msg.preview_url ?? false, body: msg.text ?? '' },
    }
  }

  if (msg.type === 'interactive') {
    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: msg.body ?? '' },
      action: {
        buttons: (msg.buttons ?? []).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    }
    if (msg.footer) interactive.footer = { text: msg.footer }
    if (msg.header?.url) {
      const headerMedia: Record<string, unknown> = { link: msg.header.url }
      if (msg.header.type === 'document') {
        headerMedia.filename = msg.header.filename ?? msg.header.url.split('/').pop()?.split('?')[0] ?? 'file'
      }
      interactive.header = {
        type: msg.header.type,
        [msg.header.type]: headerMedia,
      }
    }
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    }
  }

  if (msg.type === 'list') {
    const list = msg.list
    const rows = list?.sections.flatMap(section => section.rows) ?? []
    const interactive: Record<string, unknown> = {
      type: 'list',
      body: { text: msg.body ?? 'Please choose an option.' },
      ...(msg.footer ? { footer: { text: msg.footer } } : {}),
      action: {
        button: list?.buttonText ?? 'Choose option',
        sections: (list?.sections ?? [{ rows }]).map((section, sectionIndex) => ({
          title: section.title ?? `Options ${sectionIndex + 1}`,
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title,
            ...(row.description ? { description: row.description } : {}),
          })),
        })),
      },
    }
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    }
  }

  const mediaPayload: Record<string, unknown> = { link: msg.url }
  if (msg.caption) mediaPayload.caption = msg.caption
  if (msg.type === 'document') mediaPayload.filename = (msg.url ?? '').split('/').pop() || 'file'
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: msg.type,
    [msg.type]: mediaPayload,
  }
}

export async function sendWhatsAppApiMessage(params: {
  accessToken: string
  phoneNumberId: string
  to: string
  message: OutboundMessage
}) {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${params.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(params.to, params.message)),
    })
    const raw = await response.text()
    let body: any = null
    try { body = raw ? JSON.parse(raw) : null } catch { body = null }
    const metaCode = body?.error?.code ? Number(body.error.code) : null
    const errorText = body?.error?.message || raw || `HTTP ${response.status}`
    return {
      ok: response.ok,
      status: response.status,
      body,
      errorText,
      metaCode,
      retryable: !response.ok && (response.status >= 500 || response.status === 429),
      waMessageId: body?.messages?.[0]?.id as string | undefined,
    }
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      body: null,
      errorText: error?.message ?? 'Network error',
      metaCode: null,
      retryable: true,
      waMessageId: undefined as string | undefined,
    }
  }
}
