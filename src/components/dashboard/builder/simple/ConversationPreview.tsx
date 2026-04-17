import { useState, useCallback, useRef, useEffect } from 'react'
import { Send, RefreshCw } from 'lucide-react'
import type { SimpleFlow, SimpleStep } from '@/types/simpleFlow'

interface ChatMsg { id: string; role: 'bot' | 'user'; text: string; buttons?: { id: string; title: string }[] }

export default function ConversationPreview({ flow }: { flow: SimpleFlow }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [curStepId, setCurStepId] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [waitingInput, setWaitingInput] = useState(false)
  const [finished, setFinished] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const stepById = useCallback((id: string | null | undefined): SimpleStep | null =>
    id ? (flow.steps.find(s => s.id === id) ?? null) : null
  , [flow.steps])

  const runStep = useCallback((stepId: string | null) => {
    if (!stepId) { setFinished(true); return }
    const step = stepById(stepId)
    if (!step) { setFinished(true); return }
    setMsgs(prev => [...prev, { id: step.id + '-' + Date.now(), role: 'bot', text: step.text, buttons: step.mode === 'button_choices' ? step.buttons?.map(b => ({ id: b.id, title: b.title })) : undefined }])
    setCurStepId(stepId)
    if (step.mode === 'button_choices' || step.mode === 'open_text') {
      setWaitingInput(true)
    } else {
      setTimeout(() => runStep(step.nextStepId ?? null), 400)
    }
  }, [stepById])

  const reset = useCallback(() => {
    setMsgs([]); setCurStepId(null); setInputText(''); setWaitingInput(false); setFinished(false)
    if (flow.steps.length > 0) setTimeout(() => runStep(flow.steps[0].id), 150)
  }, [flow.steps, runStep])

  useEffect(() => { reset() }, [flow.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const tapButton = useCallback((title: string) => {
    const step = stepById(curStepId)
    if (!step || step.mode !== 'button_choices') return
    setMsgs(prev => [...prev, { id: 'u-' + Date.now(), role: 'user', text: title }])
    setWaitingInput(false)
    const btn = step.buttons?.find(b => b.title === title)
    runStep(btn?.nextStepId ?? null)
  }, [curStepId, stepById, runStep])

  const submitText = useCallback(() => {
    if (!inputText.trim()) return
    const step = stepById(curStepId)
    if (!step) return
    setMsgs(prev => [...prev, { id: 'u-' + Date.now(), role: 'user', text: inputText.trim() }])
    setInputText(''); setWaitingInput(false)
    runStep(step.nextStepId ?? null)
  }, [inputText, curStepId, stepById, runStep])

  return (
    <div className="flex flex-col h-full bg-[#0a1014] rounded-lg overflow-hidden border border-border w-full">
      <div className="flex items-center justify-between px-3 py-2 bg-[#1f2c33]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            {flow.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-[11px] font-medium text-white leading-tight">{flow.name}</p>
            <p className="text-[9px] text-[#8696a0]">Preview</p>
          </div>
        </div>
        <button onClick={reset} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
          <RefreshCw className="h-3 w-3 text-[#8696a0]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {flow.steps.length === 0 && <p className="text-center text-[#8696a0] text-xs py-8">Add steps to preview</p>}
        {msgs.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'bot' ? (
              <div className="max-w-[88%] space-y-1">
                {msg.text && (
                  <div className="bg-[#1f2c33] text-white text-[11px] rounded-lg rounded-tl-none px-3 py-2 whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                )}
                {msg.buttons && (
                  <div className="flex flex-col gap-1 mt-1">
                    {msg.buttons.map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => tapButton(btn.title)}
                        disabled={!waitingInput}
                        className="bg-[#1f2c33] border border-[#2a3942] text-[#00a884] text-[11px] rounded-lg px-3 py-1.5 hover:bg-[#2a3942] transition-colors disabled:opacity-40 disabled:cursor-default text-center"
                      >
                        {btn.title || '(empty)'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#005c4b] text-white text-[11px] rounded-lg rounded-tr-none px-3 py-2 max-w-[88%] whitespace-pre-wrap">{msg.text}</div>
            )}
          </div>
        ))}
        {finished && <p className="text-center text-[#8696a0] text-[10px] py-1">— Conversation ended —</p>}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 bg-[#1f2c33] flex items-center gap-2">
        <input
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitText()}
          disabled={!waitingInput || finished}
          placeholder={waitingInput && !finished ? 'Type a reply…' : ''}
          className="flex-1 bg-[#2a3942] text-white text-[11px] rounded-full px-3 py-1.5 outline-none placeholder:text-[#8696a0] disabled:opacity-30"
        />
        <button
          onClick={submitText}
          disabled={!inputText.trim() || !waitingInput || finished}
          className="p-1.5 rounded-full bg-primary/80 hover:bg-primary disabled:opacity-30 transition-colors"
        >
          <Send className="h-3 w-3 text-white" />
        </button>
      </div>
    </div>
  )
}
