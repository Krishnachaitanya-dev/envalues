import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  CheckCircle2, MessageSquare, HelpCircle, Image as ImageIcon, Film, FileText, Youtube, Zap, Trash2,
} from 'lucide-react'
import type { SimpleStep } from '@/types/simpleFlow'
import { getQuestionResponseMode } from '@/types/simpleFlow'

export interface SimpleNodeData extends Record<string, unknown> {
  step: SimpleStep
  triggerKeywords: string[]
  selected?: boolean
  onDelete: (id: string) => void
}

const ATTACH_ICON = {
  image: ImageIcon,
  video: Film,
  youtube: Youtube,
  document: FileText,
} as const

export default function SimpleNode({ data, selected }: NodeProps) {
  const { step, triggerKeywords, onDelete } = data as SimpleNodeData
  const isQuestion = step.type === 'question'
  const isEnd = step.type === 'end'
  const responseMode = isQuestion ? getQuestionResponseMode(step.buttons?.filter(b => b.title.trim()).length ?? 0) : null
  const isChoiceQuestion = responseMode === 'buttons' || responseMode === 'list'
  const hasTrigger = triggerKeywords.length > 0

  const preview = step.text.trim().slice(0, 80) || (isQuestion ? 'Untitled question' : isEnd ? 'Conversation ends' : 'Untitled message')
  const Icon = isEnd ? CheckCircle2 : isQuestion ? HelpCircle : MessageSquare

  return (
    <div
      className={[
        'relative rounded-lg border bg-card shadow-sm w-[240px] transition-all',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-border/80',
      ].join(' ')}
    >
      {hasTrigger && (
        <div className="absolute -top-2.5 left-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground shadow">
          <Zap className="h-2.5 w-2.5" />
          {triggerKeywords.slice(0, 3).join(' / ')}
          {triggerKeywords.length > 3 && ` +${triggerKeywords.length - 3}`}
        </div>
      )}

      <Handle type="target" position={Position.Left} id="in" className="!w-3 !h-3 !bg-primary/60 !border-background" />

      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${isEnd ? 'text-emerald-400' : isQuestion ? 'text-primary' : 'text-sky-400'}`} />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              {isEnd ? 'End' : isQuestion ? (responseMode === 'list' ? 'Question / list' : responseMode === 'buttons' ? 'Question / buttons' : 'Question / open text') : 'Message'}
            </span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDelete(step.id) }}
            className="p-0.5 text-muted-foreground hover:text-destructive transition-colors nodrag"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <p className="text-xs text-foreground leading-snug whitespace-pre-wrap break-words line-clamp-3">{preview}</p>

        {step.attachments && step.attachments.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {step.attachments.map(a => {
              const AIcon = ATTACH_ICON[a.type]
              return (
                <span key={a.id} className="flex items-center gap-0.5 rounded bg-muted/50 px-1 py-0.5 text-[9px] text-muted-foreground">
                  <AIcon className="h-2.5 w-2.5" />
                  <span className="capitalize">{a.type}</span>
                </span>
              )
            })}
          </div>
        )}

        {isChoiceQuestion && step.buttons && step.buttons.length > 0 && (
          <div className="mt-2 space-y-1 relative">
            {step.buttons.map(btn => (
              <div key={btn.id} className="relative bg-muted/40 border border-border/60 rounded px-2 py-1 text-[10px] text-foreground truncate">
                {btn.title.trim() || '(empty option)'}
                <Handle
                  type="source" position={Position.Right} id={`btn-${btn.id}`}
                  className="!w-2.5 !h-2.5 !bg-primary !border-background"
                  style={{ right: -6, top: '50%' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!isChoiceQuestion && !isEnd && (
        <Handle
          type="source" position={Position.Right} id="out"
          className="!w-3 !h-3 !bg-primary !border-background"
        />
      )}
    </div>
  )
}
