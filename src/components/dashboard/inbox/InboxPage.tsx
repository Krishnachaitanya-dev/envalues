import { useRef, useEffect, useState } from 'react'
import { ArrowLeft, Search, MessageSquare, RefreshCw, Bot, User, Inbox, UserCheck, UserX, Send, AlertTriangle, Loader2 } from 'lucide-react'
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
      <div className={`flex items-end gap-2 max-w-[88%] sm:max-w-[75%] ${isOut ? 'flex-row-reverse' : 'flex-row'}`}>
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
  const { user } = useDashboard()
  const { toast } = useToast()
  const {
    sessions, messages, selectedPhone, setSelectedPhone,
    loadingSessions, loadingMessages, sendingMessage,
    search, setSearch, refresh, releaseToBot, endChat, sendAgentMessage,
  } = useInboxData(user?.id ?? null)

  const [replyText, setReplyText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedSession = sessions.find(s => s.phone === selectedPhone)
  const handoffCount = sessions.filter(s => s.status === 'handoff').length

  const handleRelease = async () => {
    if (!selectedSession) return
    await releaseToBot(selectedSession.session_id)
    toast({ title: 'Conversation released back to bot' })
  }

  const handleEnd = async () => {
    if (!selectedSession) return
    await endChat(selectedSession.session_id)
    toast({ title: 'Conversation ended' })
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
    <div className="flex h-[calc(100dvh-118px)] sm:h-[calc(100vh-120px)] gap-0 rounded-2xl border border-border overflow-hidden bg-card min-w-0">

      {/* ── Left: Session list ─────────────────────────────────────────── */}
      <div className={`${selectedPhone ? 'hidden md:flex' : 'flex'} w-full md:w-72 shrink-0 flex-col border-r border-border`}>
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">Inbox</span>
            {sessions.length > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {sessions.length}
              </span>
            )}
            {handoffCount > 0 && (
              <span className="bg-orange-500/15 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={9} /> {handoffCount}
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
          {loadingSessions ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
              <MessageSquare size={24} className="text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No active conversations</p>
              <p className="text-[10px] text-muted-foreground/60">Active and handoff sessions appear here</p>
            </div>
          ) : (
            sessions.map(s => (
              <button key={s.session_id} onClick={() => setSelectedPhone(s.phone)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors ${
                  selectedPhone === s.phone ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">{maskPhone(s.phone)}</span>
                    {s.status === 'handoff' && (
                      <span className="bg-orange-500/15 text-orange-400 text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                        <AlertTriangle size={8} /> HANDOFF
                      </span>
                    )}
                    {s.status === 'active' && (
                      <span className="bg-green-500/15 text-green-400 text-[9px] font-bold px-1 py-0.5 rounded">ACTIVE</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2">{s.last_message_ago}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{s.last_message || '—'}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Conversation thread ─────────────────────────────────── */}
      <div className={`${selectedPhone ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {selectedPhone ? (
          <>
            {/* Chat header */}
            <div className="px-3 sm:px-5 py-3 border-b border-border flex items-center gap-3 bg-card min-w-0">
              <button
                type="button"
                onClick={() => setSelectedPhone(null)}
                className="md:hidden touch-target rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{maskPhone(selectedPhone)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedSession?.status === 'handoff'
                    ? 'Waiting for agent — bot is paused'
                    : `Active session · last active ${selectedSession?.last_message_ago}`}
                </p>
              </div>

              {/* Release to Bot (handoff only) + End Chat */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {selectedSession?.status === 'handoff' && (
                  <button onClick={handleRelease}
                    className="inline-flex items-center gap-1.5 bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-muted/80 transition-colors whitespace-nowrap">
                    <UserX size={13} /> Release to Bot
                  </button>
                )}
                <button onClick={handleEnd}
                  className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors whitespace-nowrap">
                  End Chat
                </button>
              </div>
            </div>

            {/* Handoff banner */}
            {selectedSession?.status === 'handoff' && (
              <div className="px-3 sm:px-5 py-2.5 bg-orange-500/10 border-b border-orange-500/20 flex items-center gap-2">
                <AlertTriangle size={14} className="text-orange-400 shrink-0" />
                <p className="text-xs text-orange-400 font-medium">
                  This session is in handoff — the bot is silent. Reply below or click "Release to Bot" to hand back to automation.
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 bg-background/40">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                  <RefreshCw size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-xs text-muted-foreground">No messages yet for this session</p>
                </div>
              ) : (
                <>
                  {messages.map(m => <Bubble key={m.id} {...m} />)}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Reply box — always visible when a session is selected */}
            <div className="px-3 sm:px-4 py-3 border-t border-border bg-card safe-area-page">
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
                {selectedSession?.status === 'handoff'
                  ? 'Replying as agent · Bot is paused'
                  : 'Sending as agent · Bot is active on this session'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare size={24} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Select a conversation</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Choose a session from the left to view the full conversation thread
            </p>
            {handoffCount > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5 mt-2">
                <AlertTriangle size={14} className="text-orange-400" />
                <p className="text-xs text-orange-400 font-medium">
                  {handoffCount} session{handoffCount > 1 ? 's' : ''} waiting for agent handoff
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
