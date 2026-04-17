import { useCallback, useEffect, useState } from 'react'
import { Plus, Zap, ArrowRight, Workflow, Lock, ExternalLink, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/contexts/DashboardContext'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'
import { isSimpleCompatible } from '@/lib/simpleFlowCompat'
import type { FlowNode, FlowEdge, FlowTrigger } from '@/integrations/supabase/flow-types'
import { supabase } from '@/integrations/supabase/client'

interface FlowMeta {
  nodes: FlowNode[]
  edges: FlowEdge[]
  triggers: FlowTrigger[]
}

export default function SimpleBuilderPage() {
  const navigate = useNavigate()
  const { user } = useDashboard()
  const fb = useFlowBuilder(user?.id ?? null)
  const [creating, setCreating] = useState(false)
  const [flowMeta, setFlowMeta] = useState<Record<string, FlowMeta>>({})
  const [metaLoading, setMetaLoading] = useState(false)

  // Fetch nodes/edges/triggers for all flows to classify compatibility
  useEffect(() => {
    if (fb.flows.length === 0) return
    const flowIds = fb.flows.map((f) => f.id)
    setMetaLoading(true)
    Promise.all([
      supabase.from('flow_nodes').select('*').in('flow_id', flowIds),
      supabase.from('flow_edges').select('*').in('flow_id', flowIds),
      supabase.from('flow_triggers').select('*').in('flow_id', flowIds),
    ]).then(([nodesRes, edgesRes, triggersRes]) => {
      const meta: Record<string, FlowMeta> = {}
      for (const id of flowIds) {
        meta[id] = {
          nodes: (nodesRes.data ?? []).filter((n: FlowNode) => n.flow_id === id),
          edges: (edgesRes.data ?? []).filter((e: FlowEdge) => e.flow_id === id),
          triggers: (triggersRes.data ?? []).filter((t: FlowTrigger) => t.flow_id === id),
        }
      }
      setFlowMeta(meta)
    }).finally(() => setMetaLoading(false))
  }, [fb.flows])

  const handleCreateFlow = useCallback(async () => {
    setCreating(true)
    try {
      const flow = await fb.createFlow('New Conversation')
      if (flow) navigate(`/dashboard/builder?flow=${flow.id}`)
      else navigate('/dashboard/builder', { replace: true })
    } finally {
      setCreating(false)
    }
  }, [fb.createFlow, navigate])

  const statusColor: Record<string, string> = {
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    draft: 'bg-muted text-muted-foreground border-border',
    archived: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-52px)] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold font-syne">Conversation Builder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Build your WhatsApp chatbot step by step</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs gap-1.5"
            onClick={() => navigate('/dashboard/builder/advanced')}
          >
            <Workflow className="h-3.5 w-3.5" />
            Advanced Builder
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleCreateFlow}
            disabled={creating || fb.loading}
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {fb.loading || metaLoading ? (
          <div className="text-muted-foreground text-sm">Loading conversations...</div>
        ) : fb.flows.length === 0 ? (
          <EmptyState onCreateFlow={handleCreateFlow} creating={creating} />
        ) : (
          <div className="grid gap-3 max-w-2xl">
            {fb.flows.map((flow) => {
              const meta = flowMeta[flow.id]
              const compatible = meta ? isSimpleCompatible(meta.nodes, meta.edges, meta.triggers) : true
              const keywords = (meta?.triggers ?? [])
                .filter((t: FlowTrigger) => t.trigger_type === 'keyword' && t.trigger_value)
                .map((t: FlowTrigger) => t.trigger_value as string)

              if (!compatible) {
                return (
                  <AdvancedFlowCard
                    key={flow.id}
                    name={flow.name}
                    status={flow.status}
                    statusColor={statusColor[flow.status] ?? statusColor.draft}
                    onOpenAdvanced={() => navigate(`/dashboard/builder/advanced?flow=${flow.id}`)}
                  />
                )
              }

              return (
                <SimpleFlowCard
                  key={flow.id}
                  name={flow.name}
                  status={flow.status}
                  statusColor={statusColor[flow.status] ?? statusColor.draft}
                  keywords={keywords}
                  stepCount={(meta?.nodes ?? []).filter((n: FlowNode) => ['message', 'input'].includes(n.node_type)).length}
                  onEdit={() => navigate(`/dashboard/builder?flow=${flow.id}`)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onCreateFlow, creating }: { onCreateFlow: () => void; creating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <div className="rounded-full bg-primary/10 p-4">
        <Zap className="h-8 w-8 text-primary" />
      </div>
      <div>
        <p className="font-medium">No conversations yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create your first conversation to get started.</p>
      </div>
      <Button onClick={onCreateFlow} disabled={creating} className="gap-2">
        <Plus className="h-4 w-4" />
        Create conversation
      </Button>
    </div>
  )
}

function SimpleFlowCard({
  name, status, statusColor, keywords, stepCount, onEdit
}: {
  name: string
  status: string
  statusColor: string
  keywords: string[]
  stepCount: number
  onEdit: () => void
}) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-raised hover:bg-muted/30 cursor-pointer transition-colors group"
      onClick={onEdit}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="rounded-md bg-primary/10 p-2 shrink-0">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${statusColor}`}>
              {status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stepCount} step{stepCount !== 1 ? 's' : ''}
            {keywords.length > 0 && (
              <> · keywords: {keywords.slice(0, 3).join(', ')}{keywords.length > 3 ? ` +${keywords.length - 3}` : ''}</>
            )}
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-3 group-hover:text-foreground transition-colors" />
    </div>
  )
}

function AdvancedFlowCard({
  name, status, statusColor, onOpenAdvanced
}: {
  name: string
  status: string
  statusColor: string
  onOpenAdvanced: () => void
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-surface-raised/50 opacity-80">
      <div className="flex items-start gap-3 min-w-0">
        <div className="rounded-md bg-muted p-2 shrink-0">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${statusColor}`}>
              {status}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 font-medium">
              Advanced
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            This conversation uses advanced features. Open in Advanced Builder to edit.
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs gap-1.5 shrink-0 ml-3"
        onClick={(e) => { e.stopPropagation(); onOpenAdvanced() }}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Advanced Builder
      </Button>
    </div>
  )
}
