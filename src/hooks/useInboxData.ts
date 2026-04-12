import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'

export type Contact = {
  customer_phone: string
  last_message: string
  last_message_at: string
  last_message_ago: string
  total_messages: number
  needs_human: boolean
  agent_active: boolean
  session_id: string | null
}

export type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  msg_type: string
  created_at: string
}

export function useInboxData(chatbotId: string | null) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [search, setSearch] = useState('')

  // ── Load contacts list ───────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    if (!chatbotId) { setLoadingContacts(false); return }
    setLoadingContacts(true)
    try {
      // Fetch messages grouped by phone
      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .select('customer_phone, content, created_at')
        .eq('chatbot_id', chatbotId)
        .order('created_at', { ascending: false })
      if (msgErr) throw msgErr

      // Fetch session states (needs_human, agent_active)
      const { data: sessData } = await supabase
        .from('customer_sessions')
        .select('id, customer_phone_number, needs_human, agent_active')
        .eq('chatbot_id', chatbotId)

      const sessMap: Record<string, { needs_human: boolean; agent_active: boolean; id: string }> = {}
      ;(sessData ?? []).forEach(s => {
        sessMap[s.customer_phone_number] = { needs_human: s.needs_human, agent_active: s.agent_active, id: s.id }
      })

      // Group messages by phone
      const map: Record<string, { last_message: string; last_message_at: string; count: number }> = {}
      ;(msgData ?? []).forEach(row => {
        if (!map[row.customer_phone]) {
          map[row.customer_phone] = { last_message: row.content, last_message_at: row.created_at, count: 1 }
        } else {
          map[row.customer_phone].count++
        }
      })

      const list: Contact[] = Object.entries(map).map(([phone, v]) => ({
        customer_phone: phone,
        last_message: v.last_message.length > 60 ? v.last_message.slice(0, 57) + '…' : v.last_message,
        last_message_at: v.last_message_at,
        last_message_ago: formatDistanceToNow(new Date(v.last_message_at), { addSuffix: true }),
        total_messages: v.count,
        needs_human: sessMap[phone]?.needs_human ?? false,
        agent_active: sessMap[phone]?.agent_active ?? false,
        session_id: sessMap[phone]?.id ?? null,
      }))

      // Escalated contacts first, then by recency
      list.sort((a, b) => {
        if (a.needs_human && !b.needs_human) return -1
        if (!a.needs_human && b.needs_human) return 1
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      })

      setContacts(list)
    } catch (e) {
      console.error('Failed to load inbox contacts:', e)
    } finally {
      setLoadingContacts(false)
    }
  }, [chatbotId])

  // ── Load messages for selected contact ──────────────────────────────────
  const loadMessages = useCallback(async (phone: string) => {
    if (!chatbotId) return
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, direction, content, msg_type, created_at')
        .eq('chatbot_id', chatbotId)
        .eq('customer_phone', phone)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages((data ?? []) as Message[])
    } catch (e) {
      console.error('Failed to load messages:', e)
    } finally {
      setLoadingMessages(false)
    }
  }, [chatbotId])

  // ── Take over / Release ──────────────────────────────────────────────────
  const setAgentActive = useCallback(async (phone: string, active: boolean) => {
    if (!chatbotId) return
    await supabase
      .from('customer_sessions')
      .upsert({
        chatbot_id: chatbotId,
        customer_phone_number: phone,
        agent_active: active,
        needs_human: active ? false : false, // clear flag when agent takes over
        last_activity_at: new Date().toISOString(),
      }, { onConflict: 'chatbot_id,customer_phone_number' })

    setContacts(prev => prev.map(c =>
      c.customer_phone === phone
        ? { ...c, agent_active: active, needs_human: active ? false : c.needs_human }
        : c
    ))
  }, [chatbotId])

  // ── Send message as agent ─────────────────────────────────────────────────
  const sendAgentMessage = useCallback(async (phone: string, text: string): Promise<boolean> => {
    if (!chatbotId || !text.trim()) return false
    setSendingMessage(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ to: phone, message: text.trim(), chatbot_id: chatbotId }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Send failed')
      }

      // Optimistically add message to thread
      const optimistic: Message = {
        id: crypto.randomUUID(),
        direction: 'outbound',
        content: text.trim(),
        msg_type: 'agent',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, optimistic])
      return true
    } catch (e: any) {
      console.error('sendAgentMessage error:', e)
      return false
    } finally {
      setSendingMessage(false)
    }
  }, [chatbotId])

  useEffect(() => { loadContacts() }, [loadContacts])

  useEffect(() => {
    if (selectedPhone) loadMessages(selectedPhone)
    else setMessages([])
  }, [selectedPhone, loadMessages])

  const filteredContacts = search.trim()
    ? contacts.filter(c => c.customer_phone.includes(search.trim()))
    : contacts

  return {
    contacts: filteredContacts,
    messages,
    selectedPhone,
    setSelectedPhone,
    loadingContacts,
    loadingMessages,
    sendingMessage,
    search,
    setSearch,
    refresh: loadContacts,
    setAgentActive,
    sendAgentMessage,
  }
}
