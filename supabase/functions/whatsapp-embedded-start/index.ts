import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/whatsapp.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const META_APP_ID = Deno.env.get('META_APP_ID') || ''
const META_EMBEDDED_SIGNUP_CONFIG_ID = Deno.env.get('META_EMBEDDED_SIGNUP_CONFIG_ID') || ''
const META_EMBEDDED_SIGNUP_REDIRECT_URI = Deno.env.get('META_EMBEDDED_SIGNUP_REDIRECT_URI') || ''
const META_API_VERSION = Deno.env.get('META_API_VERSION') || 'v21.0'
const SESSION_TTL_MINUTES = 10
const REQUIRED_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'business_management',
]

function hasRequiredConfig(): boolean {
  return !!(META_APP_ID && META_EMBEDDED_SIGNUP_CONFIG_ID && META_EMBEDDED_SIGNUP_REDIRECT_URI)
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    if (!hasRequiredConfig()) {
      return new Response(JSON.stringify({
        error: 'Embedded signup is not configured on server',
        missing: {
          META_APP_ID: !META_APP_ID,
          META_EMBEDDED_SIGNUP_CONFIG_ID: !META_EMBEDDED_SIGNUP_CONFIG_ID,
          META_EMBEDDED_SIGNUP_REDIRECT_URI: !META_EMBEDDED_SIGNUP_REDIRECT_URI,
        },
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

    const state = `waes_${crypto.randomUUID().replace(/-/g, '')}`
    const nonce = crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString()

    const { data: session, error: sessionErr } = await (supabase.from('whatsapp_connect_sessions') as any).insert({
      owner_id: user.id,
      state,
      nonce,
      status: 'pending',
      meta_config_id: META_EMBEDDED_SIGNUP_CONFIG_ID,
      expires_at: expiresAt,
    }).select('id, state, expires_at').single()

    if (sessionErr) throw sessionErr

    const query = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: META_EMBEDDED_SIGNUP_REDIRECT_URI,
      response_type: 'code',
      scope: REQUIRED_SCOPES.join(','),
      state,
      config_id: META_EMBEDDED_SIGNUP_CONFIG_ID,
      display: 'popup',
    })
    const oauthUrl = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${query.toString()}`

    return new Response(JSON.stringify({
      ok: true,
      session_id: session.id,
      state: session.state,
      expires_at: session.expires_at,
      app_id: META_APP_ID,
      config_id: META_EMBEDDED_SIGNUP_CONFIG_ID,
      redirect_uri: META_EMBEDDED_SIGNUP_REDIRECT_URI,
      oauth_url: oauthUrl,
      scopes: REQUIRED_SCOPES,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[whatsapp-embedded-start] error:', error)
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
