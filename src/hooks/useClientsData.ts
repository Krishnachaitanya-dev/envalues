import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

export type EnterpriseClient = {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  chatbot: { id: string; chatbot_name: string; is_active: boolean } | null
}

export function useClientsData(enterpriseOwnerId: string | null) {
  const [clients, setClients] = useState<EnterpriseClient[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const load = useCallback(async () => {
    if (!enterpriseOwnerId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await (supabase.from('owners') as any)
        .select('id, email, full_name, is_active, created_at, chatbots(id, chatbot_name, is_active)')
        .eq('enterprise_id', enterpriseOwnerId)
        .order('created_at', { ascending: false })

      setClients((data ?? []).map((o: any) => ({
        id: o.id,
        email: o.email,
        full_name: o.full_name,
        is_active: o.is_active,
        created_at: o.created_at,
        chatbot: o.chatbots?.[0] ?? null,
      })))
    } catch (e) {
      console.error('Failed to load clients:', e)
    } finally {
      setLoading(false)
    }
  }, [enterpriseOwnerId])

  useEffect(() => { load() }, [load])

  const inviteClient = useCallback(async (email: string, fullName: string): Promise<string | null> => {
    setInviting(true)
    setInviteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email, full_name: fullName }),
      })
      const json = await res.json()
      if (!res.ok) {
        setInviteError(json.error || 'Failed to invite client')
        return null
      }
      await load()
      return json.user_id
    } catch (e: any) {
      setInviteError('Network error')
      return null
    } finally {
      setInviting(false)
    }
  }, [load])

  const toggleClientActive = useCallback(async (clientId: string, currentState: boolean) => {
    const { error } = await supabase.from('owners').update({ is_active: !currentState }).eq('id', clientId)
    if (!error) setClients(prev => prev.map(c => c.id === clientId ? { ...c, is_active: !currentState } : c))
    return !error
  }, [])

  return { clients, loading, inviting, inviteError, setInviteError, inviteClient, toggleClientActive, refresh: load }
}
