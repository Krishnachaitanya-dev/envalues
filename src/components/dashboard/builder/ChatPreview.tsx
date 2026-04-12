import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RotateCcw, Bot, AlertTriangle, MessageSquare } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PreviewMessage {
  id: string
  from: 'bot' | 'user'
  text: string
  buttons?: { id: string; label: string }[]
  isWarning?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).slice(2)
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

const GREETING_KEYWORDS = ['hi', 'hello', 'start', 'menu', 'hey', 'hii']
const FAREWELL_KEYWORDS  = ['bye', 'thanks', 'thank you', 'exit', 'stop', 'done']

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChatPreview({ onClose }: { onClose: () => void }) {
  const { chatbot, rootQuestions, getChildren, qaPairs } = useDashboard()

  const [messages, setMessages]       = useState<PreviewMessage[]>([])
  const [isEnded, setIsEnded]         = useState(false)
  const [inputText, setInputText]     = useState('')
  const [awaitingInput, setAwaitingInput] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Build greeting + main menu ────────────────────────────────────────────
  const buildGreeting = useCallback((): PreviewMessage[] => {
    const greeting = chatbot?.greeting_message || 'Welcome! How can I help you?'
    const roots     = rootQuestions.slice(0, 3) // WhatsApp max 3

    const msgs: PreviewMessage[] = [{
      id: genId(),
      from: 'bot',
      text: greeting,
      buttons: roots.map(r => ({ id: r.id, label: truncate(r.question_text, 20) })),
    }]

    if (rootQuestions.length > 3) {
      msgs.push({
        id: genId(),
        from: 'bot',
        text: '',
        isWarning: true,
      })
    }

    return msgs
  }, [chatbot, rootQuestions])

  // ── Init on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (rootQuestions.length === 0) {
      setMessages([{
        id: genId(),
        from: 'bot',
        text: '⚠️ No menu nodes yet. Add at least one node in the builder to preview your chatbot.',
      }])
      return
    }
    setMessages(buildGreeting())
  }, []) // run once on mount only

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Remove buttons from last bot message (disable after click) ────────────
  function disableLastButtons() {
    setMessages(prev => {
      const copy = [...prev]
      // find last bot message with buttons
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].from === 'bot' && copy[i].buttons) {
          copy[i] = { ...copy[i], buttons: undefined }
          break
        }
      }
      return copy
    })
  }

  // ── Handle button click ───────────────────────────────────────────────────
  function handleButtonClick(qaId: string, label: string) {
    if (isEnded) return

    disableLastButtons()

    // Add user bubble (what they "clicked")
    const userMsg: PreviewMessage = { id: genId(), from: 'user', text: label }

    const qa = qaPairs.find(q => q.id === qaId)
    if (!qa) return

    const children = getChildren(qaId).slice(0, 3)

    const botMsg: PreviewMessage = {
      id: genId(),
      from: 'bot',
      text: qa.answer_text,
      buttons: children.length > 0
        ? children.map(c => ({ id: c.id, label: truncate(c.question_text, 20) }))
        : undefined,
    }

    const extra: PreviewMessage[] = []

    // If no children — offer to go back to main menu
    if (children.length === 0) {
      extra.push({
        id: genId(),
        from: 'bot',
        text: '↩️ Tap below to go back to the main menu.',
        buttons: [{ id: '__main_menu__', label: 'Main Menu' }],
      })
    }

    // If this node has >3 children, warn
    if (getChildren(qaId).length > 3) {
      extra.push({
        id: genId(),
        from: 'bot',
        text: '',
        isWarning: true,
      })
    }

    setMessages(prev => [...prev, userMsg, botMsg, ...extra])
  }

  // ── Handle main menu shortcut ─────────────────────────────────────────────
  function handleMainMenu() {
    if (isEnded) return
    disableLastButtons()
    setMessages(prev => [...prev, ...buildGreeting()])
  }

  // ── Handle free-text input ────────────────────────────────────────────────
  function handleSendText(e: React.FormEvent) {
    e.preventDefault()
    const text = inputText.trim()
    if (!text || isEnded) return
    setInputText('')

    const lower = text.toLowerCase()

    // Greeting keywords → restart
    if (GREETING_KEYWORDS.some(k => lower.includes(k))) {
      disableLastButtons()
      setMessages(prev => [
        ...prev,
        { id: genId(), from: 'user', text },
        ...buildGreeting(),
      ])
      return
    }

    // Farewell keywords → goodbye
    if (FAREWELL_KEYWORDS.some(k => lower.includes(k))) {
      disableLastButtons()
      setMessages(prev => [
        ...prev,
        { id: genId(), from: 'user', text },
        { id: genId(), from: 'bot', text: chatbot?.farewell_message || 'Thank you! Goodbye 👋' },
      ])
      setIsEnded(true)
      return
    }

    // Default: "didn't understand"
    disableLastButtons()
    setMessages(prev => [
      ...prev,
      { id: genId(), from: 'user', text },
      {
        id: genId(),
        from: 'bot',
        text: "Sorry, I didn't understand that. Please use the buttons or type *menu* to start over.",
        buttons: rootQuestions.slice(0, 3).map(r => ({ id: r.id, label: truncate(r.question_text, 20) })),
      },
    ])
  }

  // ── Restart ───────────────────────────────────────────────────────────────
  function handleRestart() {
    setIsEnded(false)
    setInputText('')
    if (rootQuestions.length === 0) {
      setMessages([{
        id: genId(),
        from: 'bot',
        text: '⚠️ No menu nodes yet. Add at least one node in the builder to preview your chatbot.',
      }])
      return
    }
    setMessages(buildGreeting())
  }

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border shadow-2xl z-20 flex flex-col"
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/8 via-primary/3 to-transparent flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <MessageSquare size={14} className="text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Preview</h4>
            <p className="text-[10px] text-muted-foreground">Simulation — not real WhatsApp</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRestart}
            title="Restart preview"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Simulation notice ── */}
      <div className="px-3 py-1.5 bg-amber-500/8 border-b border-amber-500/15 shrink-0">
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
          This simulates how customers will experience your chatbot.
        </p>
      </div>

      {/* ── WhatsApp-style chat area ── */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
        {/* Bot name header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Bot size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">{chatbot?.chatbot_name || 'Your Chatbot'}</p>
            <p className="text-[10px] text-green-500">● Online</p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Warning pill */}
              {msg.isWarning ? (
                <div className="flex justify-center my-1">
                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full px-3 py-1 text-[10px] font-medium">
                    <AlertTriangle size={10} />
                    Only first 3 buttons show on WhatsApp
                  </div>
                </div>
              ) : msg.from === 'bot' ? (
                /* Bot bubble */
                <div className="flex items-end gap-1.5 max-w-[90%]">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-0.5">
                    <Bot size={10} className="text-primary" />
                  </div>
                  <div className="space-y-1.5">
                    {msg.text && (
                      <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    )}
                    {/* Buttons */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="space-y-1">
                        {msg.buttons.map(btn => (
                          <button
                            key={btn.id}
                            onClick={() =>
                              btn.id === '__main_menu__'
                                ? handleMainMenu()
                                : handleButtonClick(btn.id, btn.label)
                            }
                            disabled={isEnded}
                            className="block w-full text-left bg-card border border-primary/30 hover:bg-primary/5 hover:border-primary/60 text-primary rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* User bubble */
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 max-w-[75%] shadow-sm">
                    <p className="text-xs leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Ended state */}
        {isEnded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mt-3"
          >
            <div className="bg-muted/60 border border-border rounded-xl px-4 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Conversation ended</p>
              <button
                onClick={handleRestart}
                className="text-[10px] text-primary font-bold hover:underline mt-0.5"
              >
                Restart ↺
              </button>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Text input ── */}
      <div className="border-t border-border px-3 py-2.5 shrink-0 bg-card">
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isEnded}
            placeholder={isEnded ? 'Conversation ended' : 'Type a message…'}
            className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isEnded}
            className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity hover:bg-primary/90"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className="text-[9px] text-muted-foreground/50 text-center mt-1.5">
          Press R to restart • Type "menu" to reset
        </p>
      </div>
    </motion.div>
  )
}
