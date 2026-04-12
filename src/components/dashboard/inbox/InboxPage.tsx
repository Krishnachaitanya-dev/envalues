import { useRef, useEffect, useState } from 'react'
import { Search, MessageSquare, RefreshCw, Bot, User, Inbox, UserCheck, UserX, Send, AlertTriangle, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useDashboard } from '@/contexts/DashboardContext'
import { useInboxData } from '@/hooks/useInboxData'
import { useToast } from '@/hooks/use-toast'

function maskPhone(phone: string) {
  if (phone.length <= 5) return phone
  return phone.slice(0, -5) + ' ●●●●●'
}

function Bubble({ direction, content, msg_type, created_at }: {
  direction: 'inbound' | 'outbound'; content: string; msg_type: string; created_at: string
}) {
  const isOut = direction === 'outbound'
  const isAgent = msg_type === 'agent'
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`flex items-end gap-2 max-w-[75%] ${isOut ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          isOut ? (isAgent ? 'bg-blue-500/20' : 'bg-primary/20') : 'bg-muted'
        }`}>
          {isOut
            ? isAgent ? <UserCheck size={12} className="text-blue-400" /> : <Bot size={12} className="text-primary" />
            : <User size={12} className="text-muted-foreground" />
          }
        </div>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isOut
            ? isAgent
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card border border-border text-foreground rounded-bl-sm'
        }`}>
          {isAgent && <p className="text-[9px] font-bold uppercase tracking-wider opacity-70 mb-1">Agent</p>}
          <p className="whitespace-pre-wrap break-words">{content}</p>
          <p className={`text-[10px] mt-1 ${isOut ? 'text-white/50 text-right' : 'text-muted-foreground'}`}>
            {format(new Date(created_at), 'h:mm a')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function InboxPage() {
  const { chatbot } = useDashboard()
  const { toast } = useToast()
  const {
    contacts, messages, selectedPhone, setSelectedPhone,
    loadingContacts, loadingMessages, sendingMessage,
    search, setSearch, refresh, setAgentActive, sendAgentMessage,
  } = useInboxData(chatbot?.id ?? null)

  const [replyText, setReplyText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedContact = contacts.find(c => c.customer_phone === selectedPhone)
  const escalatedCount = contacts.filter(c => c.needs_human && !c.agent_active).length

  const handleTakeOver = async () => {
    if (!selectedPhone) return
    await setAgentActive(selectedPhone, true)
    toast({ title: 'You have taken over this conversation', description: 'The bot will not reply until you release it.' })
  }

  const handleRelease = async () => {
    if (!selectedPhone) return
    await setAgentActive(selectedPhone, false)
    toast({ title: 'Conversation released back to bot' })
  }

  const handleSend = async () => {
    if (!selectedPhone || !replyText.trim()) return
    const ok = await sendAgentMessage(selectedPhone, replyText)
    if (ok) {
      setReplyText('')
      inputRef.current?.focus()
    } else {
      toast({ title: 'Failed to send message', description: 'Check your WhatsApp credentials and try again.', variant: 'destructive' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 rounded-2xl border border-border overflow-hidden bg-card">

      {/* ── Left: Contact list ─────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">Inbox</span>
            {contacts.length > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {contacts.length}
              </span>
            )}
            {escalatedCount > 0 && (
              <span className="bg-red-500/15 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={9} /> {escalatedCount}
              </span>
            )}
          </div>
          <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="Refresh">
            <RefreshCw size={13} className="text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text" placeholder="Search by phone…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-muted/30 border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
              <MessageSquare size={24} className="text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
              <p className="text-[10px] text-muted-foreground/60">Messages appear here once customers message your bot</p>
            </div>
          ) : (
            contacts.map(c => (
              <button key={c.customer_phone} onClick={() => setSelectedPhone(c.customer_phone)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors ${
                  selectedPhone === c.customer_phone ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">{maskPhone(c.customer_phone)}</span>
                    {c.agent_active && (
                      <span className="bg-blue-500/15 text-blue-400 text-[9px] font-bold px-1 py-0.5 rounded">AGENT</span>
                    )}
                    {c.needs_human && !c.agent_active && (
                      <span className="bg-red-500/15 text-red-400 text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                        <AlertTriangle size={8} /> HELP
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2">{c.last_message_ago}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{c.last_message}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{c.total_messages} messages</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Conversation thread ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPhone ? (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-border flex items-center gap-3 bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{maskPhone(selectedPhone)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedContact?.agent_active
                    ? '🔵 Agent active — bot is paused'
                    : selectedContact?.needs_human
                    ? '🔴 Requested human support'
                    : `${selectedContact?.total_messages ?? 0} messages · last active ${selectedContact?.last_message_ago}`}
                </p>
              </div>

              {/* Takeover / Release buttons */}
              {selectedContact?.agent_active ? (
                <button onClick={handleRelease}
                  className="inline-flex items-center gap-1.5 bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-muted/80 transition-colors">
                  <UserX size={13} /> Release to Bot
                </button>
              ) : (
                <button onClick={handleTakeOver}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedContact?.needs_human
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                  <UserCheck size={13} />
                  {selectedContact?.needs_human ? 'Take Over (Urgent)' : 'Take Over'}
                </button>
              )}
            </div>

            {/* Escalation banner */}
            {selectedContact?.needs_human && !selectedContact?.agent_active && (
              <div className="px-5 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-400 font-medium">This customer requested to speak to a human. Click "Take Over" to start replying.</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-background/40">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                  <RefreshCw size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-xs text-muted-foreground">No messages found</p>
                </div>
              ) : (
                <>
                  {messages.map(m => <Bubble key={m.id} {...m} />)}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Reply box — only when agent is active */}
            {selectedContact?.agent_active ? (
              <div className="px-4 py-3 border-t border-border bg-card">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sendingMessage}
                    className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
                  >
                    {sendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Replying as agent · Bot is paused · <button onClick={handleRelease} className="text-primary hover:underline">Release to bot</button>
                </p>
              </div>
            ) : (
              <div className="px-5 py-3 border-t border-border bg-card">
                <p className="text-[10px] text-muted-foreground text-center">
                  Bot is handling this conversation · Click <strong>Take Over</strong> to reply as an agent
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare size={24} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Select a conversation</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Choose a customer from the left to view their full conversation thread
            </p>
            {escalatedCount > 0 && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 mt-2">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-xs text-red-400 font-medium">{escalatedCount} customer{escalatedCount > 1 ? 's' : ''} need{escalatedCount === 1 ? 's' : ''} human support</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
