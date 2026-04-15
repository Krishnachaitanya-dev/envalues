import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'

export type InboxSession = {
  session_id: string
  phone: string
  status: 'active' | 'handoff'
  last_message: string
  last_message_at: string
  last_message_ago: string
  flow_id: string
}

export type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  msg_type: string
  created_at: string
}

export function useInboxData(ownerId: string | null) {
  const [sessions, setSessions] = useState<InboxSession[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [search, setSearch] = useState('')
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadSessions = useCallback(async () => {
    if (!ownerId) { setLoadingSessions(false); return }
    setLoadingSessions(true)
    try {
      // Get active/handoff sessions
      const { data: sessData, error } = await supabase
        .from('flow_sessions')
        .select('id, phone, status, flow_id, last_message_at')
        .eq('owner_id', ownerId)
        .in('status', ['active', 'handoff'])
        .order('last_message_at', { ascending: false })
      if (error) throw error

      // Get last message preview per phone
      const phones = (sessData ?? []).map(s => s.phone)
      let lastMsgMap: Record<string, { content: string; created_at: string }> = {}
      if (phones.length > 0) {
        const { data: logData } = await supabase
          .from('conversation_logs')
          .select('phone, content, created_at')
          .eq('owner_id', ownerId)
          .in('phone', phones)
          .order('created_at', { ascending: false })
        ;(logData ?? []).forEach(row => {
          if (!lastMsgMap[row.phone]) lastMsgMap[row.phone] = { content: row.content, created_at: row.created_at }
        })
      }

      const list: InboxSession[] = (sessData ?? []).map(s => ({
        session_id: s.id,
        phone: s.phone,
        status: s.status as 'active' | 'handoff',
        flow_id: s.flow_id,
        last_message: lastMsgMap[s.phone]?.content ?? '',
        last_message_at: lastMsgMap[s.phone]?.created_at ?? s.last_message_at ?? '',
        last_message_ago: lastMsgMap[s.phone]?.created_at
          ? formatDistanceToNow(new Date(lastMsgMap[s.phone].created_at), { addSuffix: true })
          : '',
      }))

      // Handoff sessions first, then by recency
      list.sort((a, b) => {
        if (a.status === 'handoff' && b.status !== 'handoff') return -1
        if (a.status !== 'handoff' && b.status === 'handoff') return 1
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      })

      setSessions(list)
    } catch (e) {
      console.error('loadSessions error:', e)
    } finally {
      setLoadingSessions(false)
    }
  }, [ownerId])

  const loadMessages = useCallback(async (phone: string) => {
    if (!ownerId) return
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('conversation_logs')
        .select('id, direction, content, msg_type, created_at')
        .eq('owner_id', ownerId)
        .eq('phone', phone)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages((data ?? []) as Message[])
    } catch (e) {
      console.error('loadMessages error:', e)
    } finally {
      setLoadingMessages(false)
    }
  }, [ownerId])

  const releaseToBot = useCallback(async (sessionId: string) => {
    await supabase
      .from('flow_sessions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, status: 'active' as const } : s))
  }, [])

  const endChat = useCallback(async (sessionId: string) => {
    await supabase
      .from('flow_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.session_id !== sessionId))
    setSelectedPhone(null)
  }, [])

  const sendAgentMessage = useCallback(async (phone: string, text: string): Promise<boolean> => {
    if (!text.trim()) return false
    setSendingMessage(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      const { error } = await supabase.functions.invoke('send-message', {
        body: { to: phone, message: text.trim() },
      })

      if (error) throw new Error(error.message || 'Send failed')

      // Optimistic local update
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        direction: 'outbound',
        content: text.trim(),
        msg_type: 'agent',
        created_at: new Date().toISOString(),
      }])
      return true
    } catch (e) {
      console.error('sendAgentMessage error:', e)
      return false
    } finally {
      setSendingMessage(false)
    }
  }, [])

  // Real-time subscription to conversation_logs
  useEffect(() => {
    if (!ownerId) return
    const ch = supabase
      .channel(`inbox-${ownerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_logs',
        filter: `owner_id=eq.${ownerId}`,
      }, (payload) => {
        const row = payload.new as {
          phone: string; content: string; direction: string
          msg_type: string; created_at: string; id: string
        }
        // Update session last message preview
        setSessions(prev => prev.map(s =>
          s.phone === row.phone
            ? { ...s, last_message: row.content, last_message_at: row.created_at, last_message_ago: 'just now' }
            : s
        ))
        // Append to message thread if this phone is selected
        setSelectedPhone(current => {
          if (current === row.phone) {
            setMessages(prev => [...prev, {
              id: row.id,
              direction: row.direction as 'inbound' | 'outbound',
              content: row.content,
              msg_type: row.msg_type,
              created_at: row.created_at,
            }])
          }
          return current
        })
      })
      .subscribe()
    realtimeRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [ownerId])

  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => {
    if (selectedPhone) loadMessages(selectedPhone)
    else setMessages([])
  }, [selectedPhone, loadMessages])

  const filteredSessions = search.trim()
    ? sessions.filter(s => s.phone.includes(search.trim()))
    : sessions

  return {
    sessions: filteredSessions,
    messages,
    selectedPhone,
    setSelectedPhone,
    loadingSessions,
    loadingMessages,
    sendingMessage,
    search,
    setSearch,
    refresh: loadSessions,
    releaseToBot,
    endChat,
    sendAgentMessage,
  }
}
