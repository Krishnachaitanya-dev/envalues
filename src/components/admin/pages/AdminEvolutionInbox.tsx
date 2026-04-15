import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, MessageSquare, Send, Loader2, RefreshCw, Search, Phone, Plus, X } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

const EVOLUTION_URL = 'http://localhost:8081'
const EVOLUTION_KEY = 'alachat-evolution-dev-key'
const INSTANCE_NAME = 'alachat-admin'

type EvoMessage = {
  id: string
  phone: string
  contact_name: string | null
  direction: 'inbound' | 'outbound'
  content: string
  msg_type: string
  evolution_msg_id: string | null
  created_at: string
}

type Conversation = {
  phone: string
  contact_name: string | null
  last_message: string
  last_message_at: string
}

export default function AdminEvolutionInbox() {
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<EvoMessage[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [startingChat, setStartingChat] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadConversations = useCallback(async () => {
    // Only show conversations that have at least one outbound message (app-initiated)
    const { data: outboundPhones } = await (supabase.from('evolution_messages') as any)
      .select('phone').eq('direction', 'outbound')
    const phones = [...new Set((outboundPhones ?? []).map((r: any) => r.phone))]
    if (phones.length === 0) { setLoadingConvs(false); return }

    const { data } = await (supabase.from('evolution_messages') as any)
      .select('phone, contact_name, content, created_at')
      .in('phone', phones)
      .order('created_at', { ascending: false })

    if (!data) { setLoadingConvs(false); return }

    const map: Record<string, Conversation> = {}
    data.forEach((msg: any) => {
      if (!map[msg.phone]) {
        map[msg.phone] = {
          phone: msg.phone,
          contact_name: msg.contact_name,
          last_message: msg.content.length > 55 ? msg.content.slice(0, 52) + '…' : msg.content,
          last_message_at: msg.created_at,
        }
      }
    })

    setConversations(
      Object.values(map).sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      )
    )
    setLoadingConvs(false)
  }, [])

  const loadMessages = useCallback(async (phone: string) => {
    setLoadingMsgs(true)
    const { data } = await (supabase.from('evolution_messages') as any)
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: true })
    // Deduplicate by evolution_msg_id
    const raw = (data ?? []) as EvoMessage[]
    const seen = new Set<string>()
    const deduped = raw.filter(m => {
      const key = m.evolution_msg_id || m.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setMessages(deduped)
    setLoadingMsgs(false)
  }, [])


  const sendReply = async () => {
    if (!selectedPhone || !replyText.trim()) return
    setSending(true)
    try {
      let phone = selectedPhone.replace(/[\s\-\(\)]/g, '')
      if (!phone.startsWith('+') && !phone.startsWith('91')) phone = `91${phone}`
      phone = phone.replace('+', '')

      await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text: replyText.trim() }),
      })

      // Save outbound to DB — use normalized phone (same format as inbound)
      await (supabase.from('evolution_messages') as any).insert({
        phone,
        direction: 'outbound',
        content: replyText.trim(),
        msg_type: 'text',
      })

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        phone: selectedPhone,
        contact_name: null,
        direction: 'outbound',
        content: replyText.trim(),
        msg_type: 'text',
        evolution_msg_id: null,
        created_at: new Date().toISOString(),
      }])
      setReplyText('')
      inputRef.current?.focus()
      loadConversations()
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const startNewChat = async () => {
    if (!newPhone.trim() || !newMessage.trim()) return
    setStartingChat(true)
    try {
      let phone = newPhone.replace(/[\s\-\(\)]/g, '')
      if (!phone.startsWith('+') && !phone.startsWith('91')) phone = `91${phone}`
      phone = phone.replace('+', '')

      const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text: newMessage.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())

      await (supabase.from('evolution_messages') as any).insert({
        phone,
        direction: 'outbound',
        content: newMessage.trim(),
        msg_type: 'text',
      })

      toast({ title: 'Message sent!' })
      setShowNewChat(false)
      setNewPhone('')
      setNewMessage('')
      await loadConversations()
      setSelectedPhone(phone)
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' })
    } finally {
      setStartingChat(false)
    }
  }

  // Real-time: new inbound messages
  useEffect(() => {
    const channel = (supabase as any)
      .channel('evo-inbox')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'evolution_messages',
      }, (payload: any) => {
        const msg = payload.new as EvoMessage
        if (msg.direction === 'inbound' && msg.phone === selectedPhone) {
          setMessages(prev => {
            if (prev.some(m => m.evolution_msg_id && m.evolution_msg_id === msg.evolution_msg_id)) return prev
            return [...prev, msg]
          })
        }
        if (msg.direction === 'inbound') loadConversations()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedPhone, loadConversations])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { if (selectedPhone) loadMessages(selectedPhone) }, [selectedPhone, loadMessages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])


  const filtered = search.trim()
    ? conversations.filter(c => c.phone.includes(search.trim()) || (c.contact_name ?? '').toLowerCase().includes(search.toLowerCase()))
    : conversations

  const selectedConv = conversations.find(c => c.phone === selectedPhone)

  return (
    <div className="relative flex h-[calc(100dvh-178px)] lg:h-[calc(100vh-210px)] rounded-2xl border border-border overflow-hidden bg-card min-w-0">

      {/* ── New Chat Modal ──────────────────────────────────────── */}
      {showNewChat && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-2xl">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-foreground">New Chat</h3>
              <button onClick={() => setShowNewChat(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Phone Number (with country code)</label>
                <input
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="919876543210 or +91 98765 43210"
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Message</label>
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startNewChat() } }}
                  rows={3}
                  placeholder="Type your message…"
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <button
                onClick={startNewChat}
                disabled={!newPhone.trim() || !newMessage.trim() || startingChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition disabled:opacity-50"
              >
                {startingChat ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {startingChat ? 'Sending…' : 'Send & Open Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Left: conversation list ─────────────────────────────── */}
      <div className={`${selectedPhone ? 'hidden md:flex' : 'flex'} w-full md:w-72 shrink-0 border-r border-border flex-col bg-card`}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-green-500" />
            <span className="font-semibold text-sm text-foreground">WhatsApp</span>
            {conversations.length > 0 && (
              <span className="bg-green-500/10 text-green-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {conversations.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowNewChat(true)} className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-500 transition-colors" title="New chat">
              <Plus size={14} />
            </button>
            <button onClick={loadConversations} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-muted/30 border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
              <MessageSquare size={22} className="text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
              <p className="text-[10px] text-muted-foreground/50">Messages will appear here once the webhook is set up</p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.phone}
                onClick={() => setSelectedPhone(conv.phone)}
                className={`w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors ${
                  selectedPhone === conv.phone ? 'bg-green-500/5 border-l-2 border-l-green-500' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Phone size={13} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {conv.contact_name || conv.phone}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-1">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{conv.last_message}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: chat thread ──────────────────────────────────── */}
      <div className={`${selectedPhone ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 bg-[#0a0a0a]`}>
        {selectedPhone ? (
          <>
            {/* Header */}
            <div className="px-3 sm:px-5 py-3 border-b border-border bg-card flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedPhone(null)}
                className="md:hidden touch-target rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
                <Phone size={14} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {selectedConv?.contact_name || selectedPhone}
                </p>
                <p className="text-[10px] text-muted-foreground">Evolution API · WhatsApp</p>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-1"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '24px 24px' }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                  <p className="text-xs text-muted-foreground">No messages</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className={`max-w-[68%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-[#005c4b] text-white rounded-br-sm'
                        : 'bg-[#1e1e1e] border border-white/5 text-foreground rounded-bl-sm'
                    }`}>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/40 text-right' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            <div className="px-4 py-3 border-t border-border bg-card">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  placeholder="Type a message… (Enter to send)"
                  rows={2}
                  className="flex-1 bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500/30 resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || sending}
                  className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 shrink-0"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <MessageSquare size={28} className="text-green-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">Select a conversation</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Choose a contact from the left to view the full WhatsApp conversation
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
