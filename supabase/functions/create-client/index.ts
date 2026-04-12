import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify the caller is an authenticated enterprise owner
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    // Verify caller is enterprise
    const { data: caller } = await (supabase.from('owners') as any)
      .select('id, plan_type, max_clients, brand_name')
      .eq('id', user.id)
      .single()

    if (!caller || caller.plan_type !== 'enterprise') {
      return new Response(JSON.stringify({ error: 'Enterprise plan required' }), { status: 403, headers: corsHeaders })
    }

    // Check client limit
    const { count: currentClients } = await (supabase.from('owners') as any)
      .select('*', { count: 'exact', head: true })
      .eq('enterprise_id', user.id)

    if ((currentClients ?? 0) >= caller.max_clients) {
      return new Response(JSON.stringify({ error: `Client limit reached (${caller.max_clients} max). Contact support to increase your limit.` }), { status: 400, headers: corsHeaders })
    }

    const { email, full_name } = await req.json()
    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'email and full_name are required' }), { status: 400, headers: corsHeaders })
    }

    // Check email not already registered
    const { data: existing } = await supabase.from('owners').select('id').eq('email', email).single()
    if (existing) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), { status: 400, headers: corsHeaders })
    }

    // Create auth user and send invite email
    const { data: newUser, error: createError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
    })
    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), { status: 500, headers: corsHeaders })
    }

    // Create owner record linked to enterprise (idempotent — skip if already exists)
    const { data: existingOwner } = await (supabase.from('owners') as any)
      .select('id').eq('id', newUser.user.id).single()

    if (!existingOwner) {
      const { error: ownerError } = await (supabase.from('owners') as any).insert({
        id: newUser.user.id,
        email,
        full_name,
        enterprise_id: user.id,
        plan_type: 'individual',
        is_active: true,
        password_hash: '',
        whatsapp_business_number: '',
      })

      if (ownerError) {
        await supabase.auth.admin.deleteUser(newUser.user.id)
        return new Response(JSON.stringify({ error: `Owner insert failed: ${ownerError.message} | code: ${ownerError.code}` }), { status: 500, headers: corsHeaders })
      }
    }

    // Create their chatbot
    const { error: chatbotError } = await supabase.from('chatbots').insert({
      owner_id: newUser.user.id,
      chatbot_name: `${full_name}'s Bot`,
      greeting_message: 'Welcome! How can I help you today? 😊\n\nPlease select an option below to get started.',
      farewell_message: 'Thank you for contacting us! 🙏\nHave a wonderful day! ✨',
      is_active: false,
    })
    if (chatbotError) console.error('chatbot insert error:', chatbotError.message)

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-client error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
