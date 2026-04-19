import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Send, RefreshCw, Film, FileText, ExternalLink } from 'lucide-react'
import type { SimpleFlow, SimpleStep, SimpleMedia } from '@/types/simpleFlow'
import { getQuestionResponseMode, youTubeEmbedUrl } from '@/types/simpleFlow'

interface ChatMsg {
  id: string
  role: 'bot' | 'user'
  text?: string
  footer?: string
  attachments?: SimpleMedia[]
  buttons?: { id: string; title: string }[]
  listRows?: { id: string; title: string }[]
}

export default function ConversationPreview({ flow }: { flow: SimpleFlow }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [curStepId, setCurStepId] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [waitingInput, setWaitingInput] = useState(false)
  const [finished, setFinished] = useState(false)
  const [activeTriggerId, setActiveTriggerId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const triggers = flow.triggers
  const currentTrigger = useMemo(() =>
    triggers.find(t => t.id === activeTriggerId) ?? triggers[0] ?? null,
  [triggers, activeTriggerId])

  const entryStepId = useMemo(() => {
    if (currentTrigger?.targetStepId) return currentTrigger.targetStepId
    return flow.steps[0]?.id ?? null
  }, [currentTrigger, flow.steps])

  const stepById = useCallback((id: string | null | undefined): SimpleStep | null =>
    id ? (flow.steps.find(s => s.id === id) ?? null) : null
  , [flow.steps])

  const currentStep = stepById(curStepId)
  const currentChoices = currentStep?.type === 'question'
    ? (currentStep.buttons ?? []).filter(choice => choice.title.trim())
    : []
  const currentResponseMode = currentStep?.type === 'question' ? getQuestionResponseMode(currentChoices.length) : null
  const waitingForTypedReply = waitingInput && currentResponseMode === 'open_text'

  const runStep = useCallback((stepId: string | null) => {
    if (!stepId) { setFinished(true); return }
    const step = stepById(stepId)
    if (!step) { setFinished(true); return }
    const choices = step.type === 'question'
      ? (step.buttons ?? []).filter(choice => choice.title.trim())
      : []
    const responseMode = step.type === 'question' ? getQuestionResponseMode(choices.length) : null

    setMsgs(prev => [...prev, {
      id: step.id + '-' + Date.now(),
      role: 'bot',
      text: step.text,
      footer: step.footer,
      attachments: step.attachments,
      buttons: responseMode === 'buttons' ? choices.map(b => ({ id: b.id, title: b.title })) : undefined,
      listRows: responseMode === 'list' ? choices.map(b => ({ id: b.id, title: b.title })) : undefined,
    }])
    setCurStepId(stepId)

    if (step.type === 'question') {
      setWaitingInput(true)
    } else if (step.type === 'end') {
      setWaitingInput(false)
      setFinished(true)
    } else {
      setTimeout(() => runStep(step.nextStepId ?? null), 400)
    }
  }, [stepById])

  const reset = useCallback(() => {
    setMsgs([])
    setCurStepId(null)
    setInputText('')
    setWaitingInput(false)
    setFinished(false)
    if (entryStepId) setTimeout(() => runStep(entryStepId), 150)
  }, [entryStepId, runStep])

  useEffect(() => { reset() }, [flow.id, currentTrigger?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const tapChoice = useCallback((title: string) => {
    const step = stepById(curStepId)
    if (!step || step.type !== 'question') return
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
    setInputText('')
    setWaitingInput(false)
    runStep(step.nextStepId ?? null)
  }, [inputText, curStepId, stepById, runStep])

  return (
    <div className="flex flex-col h-full bg-[#0a1014] rounded-lg overflow-hidden border border-border w-full">
      <div className="flex items-center justify-between px-3 py-2 bg-[#1f2c33] gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {flow.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-white leading-tight truncate">{flow.name}</p>
            <p className="text-[9px] text-[#8696a0]">Preview</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {triggers.length > 1 && (
            <select
              value={currentTrigger?.id ?? ''}
              onChange={e => setActiveTriggerId(e.target.value || null)}
              className="text-[10px] h-6 rounded bg-[#2a3942] text-white border-0 px-1.5 outline-none max-w-[110px]"
              title="Switch trigger"
            >
              {triggers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.keywords[0] ?? '(no keyword)'}
                </option>
              ))}
            </select>
          )}
          <button onClick={reset} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Restart">
            <RefreshCw className="h-3 w-3 text-[#8696a0]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {flow.steps.length === 0 && <p className="text-center text-[#8696a0] text-xs py-8">Add steps to preview</p>}
        {flow.steps.length > 0 && triggers.length === 0 && (
          <p className="text-center text-yellow-400/80 text-[10px] py-4">
            Add a trigger with a keyword to start this conversation in WhatsApp.
          </p>
        )}
        {msgs.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'bot' ? (
              <div className="max-w-[88%] space-y-1">
                {msg.attachments && msg.attachments.map(a => <AttachmentBubble key={a.id} media={a} />)}
                {msg.text && (
                  <div className="bg-[#1f2c33] text-white text-[11px] rounded-lg rounded-tl-none px-3 py-2 whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                )}
                {msg.footer && (
                  <div className="px-3 text-[9px] text-[#8696a0]">{msg.footer}</div>
                )}
                {msg.buttons && (
                  <div className="flex flex-col gap-1 mt-1">
                    {msg.buttons.map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => tapChoice(btn.title)}
                        disabled={!waitingInput}
                        className="bg-[#1f2c33] border border-[#2a3942] text-[#00a884] text-[11px] rounded-lg px-3 py-1.5 hover:bg-[#2a3942] transition-colors disabled:opacity-40 disabled:cursor-default text-center"
                      >
                        {btn.title || '(empty)'}
                      </button>
                    ))}
                  </div>
                )}
                {msg.listRows && (
                  <div className="mt-1 overflow-hidden rounded-lg border border-[#2a3942] bg-[#1f2c33]">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#8696a0] border-b border-[#2a3942]">Choose option</div>
                    {msg.listRows.map(row => (
                      <button
                        key={row.id}
                        onClick={() => tapChoice(row.title)}
                        disabled={!waitingInput}
                        className="block w-full border-b border-[#2a3942] px-3 py-2 text-left text-[11px] text-[#00a884] last:border-b-0 hover:bg-[#2a3942] disabled:opacity-40 disabled:cursor-default"
                      >
                        {row.title || '(empty)'}
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
        {finished && <p className="text-center text-[#8696a0] text-[10px] py-1">Conversation ended</p>}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 bg-[#1f2c33] flex items-center gap-2">
        <input
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitText()}
          disabled={!waitingForTypedReply || finished}
          placeholder={waitingForTypedReply && !finished ? 'Type a reply...' : ''}
          className="flex-1 bg-[#2a3942] text-white text-[11px] rounded-full px-3 py-1.5 outline-none placeholder:text-[#8696a0] disabled:opacity-30"
        />
        <button
          onClick={submitText}
          disabled={!inputText.trim() || !waitingForTypedReply || finished}
          className="p-1.5 rounded-full bg-primary/80 hover:bg-primary disabled:opacity-30 transition-colors"
        >
          <Send className="h-3 w-3 text-white" />
        </button>
      </div>
    </div>
  )
}

function AttachmentBubble({ media }: { media: SimpleMedia }) {
  if (media.type === 'image') {
    return (
      <div className="rounded-lg overflow-hidden bg-[#1f2c33] max-w-[260px]">
        <img src={media.url} alt={media.caption ?? ''} className="w-full max-h-[160px] object-cover" />
        {media.caption && <p className="text-[11px] text-white px-2 py-1">{media.caption}</p>}
      </div>
    )
  }
  if (media.type === 'video') {
    return (
      <div className="rounded-lg overflow-hidden bg-[#1f2c33] max-w-[260px]">
        <video src={media.url} controls className="w-full max-h-[160px]" />
        {media.caption && <p className="text-[11px] text-white px-2 py-1">{media.caption}</p>}
      </div>
    )
  }
  if (media.type === 'youtube') {
    const embed = youTubeEmbedUrl(media.url)
    return (
      <div className="rounded-lg overflow-hidden bg-[#1f2c33] max-w-[260px]">
        {embed ? (
          <iframe src={embed} className="w-full aspect-video" allow="encrypted-media" />
        ) : (
          <a href={media.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-[11px] text-[#00a884]">
            <Film className="h-3 w-3" /> {media.url}
          </a>
        )}
        {media.caption && <p className="text-[11px] text-white px-2 py-1">{media.caption}</p>}
      </div>
    )
  }
  return (
    <a
      href={media.url} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 rounded-lg bg-[#1f2c33] px-3 py-2 max-w-[260px] hover:bg-[#2a3942] transition-colors"
    >
      <div className="h-8 w-8 rounded bg-red-500/20 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-red-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-white truncate">{media.caption ?? media.url.split('/').pop() ?? 'Document'}</p>
        <p className="text-[9px] text-[#8696a0] flex items-center gap-0.5">Open <ExternalLink className="h-2 w-2" /></p>
      </div>
    </a>
  )
}
