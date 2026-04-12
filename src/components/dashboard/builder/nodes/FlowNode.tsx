import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  ArrowRight,
  Bot,
  Clock,
  Code2,
  GitBranch,
  Handshake,
  HelpCircle,
  LogOut,
  MessageSquare,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'
import type { NodeType } from '@/integrations/supabase/flow-types'
import type { RFNodeData } from '@/hooks/useFlowBuilder'

const NODE_META: Record<NodeType, { icon: LucideIcon; color: string; hint: string }> = {
  start: { icon: PlayCircle, color: 'text-emerald-400', hint: 'Flow entry point' },
  message: { icon: MessageSquare, color: 'text-sky-400', hint: 'Sends a WhatsApp message' },
  input: { icon: HelpCircle, color: 'text-amber-400', hint: 'Collects a reply into a variable' },
  condition: { icon: GitBranch, color: 'text-violet-400', hint: 'Branches by edge conditions' },
  api: { icon: Code2, color: 'text-indigo-400', hint: 'Calls an external API' },
  delay: { icon: Clock, color: 'text-orange-400', hint: 'Waits before continuing' },
  jump: { icon: ArrowRight, color: 'text-cyan-400', hint: 'Jumps to another node' },
  subflow: { icon: Bot, color: 'text-fuchsia-400', hint: 'Runs another flow' },
  handoff: { icon: Handshake, color: 'text-rose-400', hint: 'Hands off to a human' },
  end: { icon: LogOut, color: 'text-zinc-400', hint: 'Ends the conversation' },
}

interface FlowNodeProps {
  id: string
  data: RFNodeData
  selected?: boolean
  type?: string
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function nodeHint(nodeType: NodeType, config: Record<string, unknown>) {
  if (nodeType === 'message' && config.text) return String(config.text)
  if (nodeType === 'input' && config.store_as) return `Stores reply in ${String(config.store_as)}`
  if (nodeType === 'delay') return `${Number(config.delay_secs ?? 5)}s delay`
  if (nodeType === 'api' && config.url) return String(config.url)
  if (nodeType === 'handoff') return 'Notify reception or handoff queue'
  return NODE_META[nodeType].hint
}

function FlowNode({ data, selected }: FlowNodeProps) {
  const nodeType = data.nodeType
  const meta = NODE_META[nodeType]
  const Icon = meta.icon
  const label = data.label || titleCase(nodeType)
  const hint = nodeHint(nodeType, data.config ?? {})

  return (
    <div
      data-testid="flow-node"
      className={[
        'relative min-w-[180px] max-w-[240px] rounded-2xl border bg-card shadow-lg shadow-black/10 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
      ].join(' ')}
    >
      {nodeType !== 'start' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background"
        />
      )}

      <div className="flex items-start gap-3 p-3">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon size={17} className={meta.color} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{label}</p>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{hint}</p>
          <span className="inline-flex mt-2 px-2 py-0.5 rounded-full bg-muted text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            {nodeType}
          </span>
        </div>
      </div>

      {nodeType !== 'end' && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background"
        />
      )}
    </div>
  )
}

export default memo(FlowNode)
