import { useCallback, useEffect, useState } from 'react'
import { Plus, Zap, ArrowRight, Workflow, Lock, ExternalLink, MessageSquare } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/contexts/DashboardContext'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'
import { isSimpleCompatible } from '@/lib/simpleFlowCompat'
import { graphToSimple, simpleToGraph } from '@/lib/simpleFlowAdapter'
import type { FlowNode, FlowEdge, FlowTrigger } from '@/integrations/supabase/flow-types'
import type { SimpleFlow, SimpleStep } from '@/types/simpleFlow'
import { supabase } from '@/integrations/supabase/client'
import StepList from './simple/StepList'
import StepEditor from './simple/StepEditor'
import FlowKeywordEditor from './simple/FlowKeywordEditor'
import ConversationPreview from './simple/ConversationPreview'

interface FlowMeta { nodes: FlowNode[]; edges: FlowEdge[]; triggers: FlowTrigger[] }

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SimpleBuilderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeFlowId = searchParams.get('flow')
  const { user } = useDashboard()
  const fb = useFlowBuilder(user?.id ?? null)

  const [creating, setCreating] = useState(false)
  const [flowMeta, setFlowMeta] = useState<Record<string, FlowMeta>>({})
  const [metaLoading, setMetaLoading] = useState(false)

  // Editor state
  const [simpleFlow, setSimpleFlow] = useState<SimpleFlow | null>(null)
  const [editorMeta, setEditorMeta] = useState<FlowMeta | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Flow list: fetch meta for compat classification ──
  useEffect(() => {
    if (fb.flows.length === 0 || activeFlowId) return
    const flowIds = fb.flows.map(f => f.id)
    setMetaLoading(true)
    Promise.all([
      supabase.from('flow_nodes').select('*').in('flow_id', flowIds),
      supabase.from('flow_edges').select('*').in('flow_id', flowIds),
      supabase.from('flow_triggers').select('*').in('flow_id', flowIds),
    ]).then(([nr, er, tr]) => {
      const meta: Record<string, FlowMeta> = {}
      for (const id of flowIds) {
        meta[id] = {
          nodes: (nr.data ?? []).filter((n: FlowNode) => n.flow_id === id),
          edges: (er.data ?? []).filter((e: FlowEdge) => e.flow_id === id),
          triggers: (tr.data ?? []).filter((t: FlowTrigger) => t.flow_id === id),
        }
      }
      setFlowMeta(meta)
    }).finally(() => setMetaLoading(false))
  }, [fb.flows, activeFlowId])

  // ── Editor: load flow when ?flow= is set ──
  useEffect(() => {
    if (!activeFlowId) { setSimpleFlow(null); setEditorMeta(null); return }
    const flow = fb.flows.find(f => f.id === activeFlowId)
    if (!flow) return
    Promise.all([
      supabase.from('flow_nodes').select('*').eq('flow_id', activeFlowId),
      supabase.from('flow_edges').select('*').eq('flow_id', activeFlowId),
      supabase.from('flow_triggers').select('*').eq('flow_id', activeFlowId),
    ]).then(([nr, er, tr]) => {
      const ns = (nr.data ?? []) as FlowNode[]
      const es = (er.data ?? []) as FlowEdge[]
      const ts = (tr.data ?? []) as FlowTrigger[]
      setEditorMeta({ nodes: ns, edges: es, triggers: ts })
      const sf = graphToSimple(flow, ns, es, ts)
      setSimpleFlow(sf)
      setSelectedStepId(sf.steps[0]?.id ?? null)
    })
  }, [activeFlowId, fb.flows])

  const handleCreateFlow = useCallback(async () => {
    setCreating(true)
    try {
      const flow = await fb.createFlow('New Conversation')
      if (flow) navigate(`/dashboard/builder?flow=${flow.id}`)
    } finally {
      setCreating(false)
    }
  }, [fb.createFlow, navigate])

  const handleSave = useCallback(async () => {
    if (!simpleFlow || !user?.id || !editorMeta) return
    setSaving(true)
    try {
      const { nodes, edges } = simpleToGraph(simpleFlow, user.id, editorMeta.nodes)
      await supabase.from('flow_edges').delete().eq('flow_id', simpleFlow.id)
      await supabase.from('flow_nodes').delete().eq('flow_id', simpleFlow.id)
      if (nodes.length > 0) await (supabase.from('flow_nodes') as any).insert(nodes)
      if (edges.length > 0) await (supabase.from('flow_edges') as any).insert(edges)
      // Sync keyword triggers
      await supabase.from('flow_triggers').delete().eq('flow_id', simpleFlow.id).eq('trigger_type', 'keyword')
      if (simpleFlow.keywords.length > 0) {
        await (supabase.from('flow_triggers') as any).insert(
          simpleFlow.keywords.map((kw, i) => ({
            owner_id: user.id,
            flow_id: simpleFlow.id,
            trigger_type: 'keyword',
            trigger_value: kw,
            normalized_trigger_value: kw.toLowerCase(),
            priority: i,
            is_active: true,
            target_node_id: null,
          }))
        )
      }
      // Update editorMeta so subsequent saves are correct
      const [nr, er, tr] = await Promise.all([
        supabase.from('flow_nodes').select('*').eq('flow_id', simpleFlow.id),
        supabase.from('flow_edges').select('*').eq('flow_id', simpleFlow.id),
        supabase.from('flow_triggers').select('*').eq('flow_id', simpleFlow.id),
      ])
      setEditorMeta({ nodes: (nr.data ?? []) as FlowNode[], edges: (er.data ?? []) as FlowEdge[], triggers: (tr.data ?? []) as FlowTrigger[] })
    } finally {
      setSaving(false)
    }
  }, [simpleFlow, user, editorMeta])

  const handleAddStep = useCallback((type: 'message' | 'question') => {
    const newStep: SimpleStep = {
      id: crypto.randomUUID(),
      type,
      mode: type === 'question' ? 'open_text' : undefined,
      text: '',
      _isNew: true,
    }
    setSimpleFlow(prev => prev ? { ...prev, steps: [...prev.steps, newStep] } : prev)
    setSelectedStepId(newStep.id)
  }, [])

  const handleDeleteStep = useCallback((id: string) => {
    setSimpleFlow(prev => {
      if (!prev) return prev
      return { ...prev, steps: prev.steps.filter(s => s.id !== id) }
    })
    setSelectedStepId(prev => prev === id ? null : prev)
  }, [])

  const handleStepChange = useCallback((updated: SimpleStep) => {
    setSimpleFlow(prev => prev ? { ...prev, steps: prev.steps.map(s => s.id === updated.id ? updated : s) } : prev)
  }, [])

  const statusColor: Record<string, string> = {
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    draft: 'bg-muted text-muted-foreground border-border',
    archived: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  // ── Editor view ──
  if (activeFlowId && simpleFlow) {
    const selectedStep = simpleFlow.steps.find(s => s.id === selectedStepId) ?? null
    return (
      <div className="flex flex-col h-full min-h-[calc(100dvh-52px)] bg-background overflow-hidden">
        {/* Editor header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard/builder')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <span className="text-muted-foreground/40">|</span>
            <span className="text-sm font-medium">{simpleFlow.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              className="text-xs text-muted-foreground gap-1.5"
              onClick={() => navigate(`/dashboard/builder/advanced?flow=${activeFlowId}`)}
            >
              <Workflow className="h-3.5 w-3.5" />
              Advanced
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 min-w-[70px]">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Keywords bar */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <FlowKeywordEditor
            keywords={simpleFlow.keywords}
            onChange={kws => setSimpleFlow(prev => prev ? { ...prev, keywords: kws } : prev)}
          />
        </div>

        {/* Three-column editor */}
        <div className="flex flex-1 overflow-hidden">
          {/* Step list */}
          <div className="w-52 border-r border-border shrink-0 overflow-hidden flex flex-col">
            <StepList
              steps={simpleFlow.steps}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              onAddMessageStep={() => handleAddStep('message')}
              onAddQuestionStep={() => handleAddStep('question')}
              onDeleteStep={handleDeleteStep}
            />
          </div>

          {/* Step editor */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {selectedStep ? (
              <StepEditor step={selectedStep} allSteps={simpleFlow.steps} onChange={handleStepChange} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Select a step or add a new one.
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="hidden lg:flex w-72 border-l border-border shrink-0 p-3 overflow-hidden">
            <ConversationPreview flow={simpleFlow} />
          </div>
        </div>
      </div>
    )
  }

  // ── Flow list view ──
  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-52px)] bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold font-syne">Conversation Builder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Build your WhatsApp chatbot step by step</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs gap-1.5" onClick={() => navigate('/dashboard/builder/advanced')}>
            <Workflow className="h-3.5 w-3.5" />
            Advanced Builder
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button size="sm" className="gap-2" onClick={handleCreateFlow} disabled={creating || fb.loading}>
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {fb.loading || metaLoading ? (
          <p className="text-muted-foreground text-sm">Loading conversations…</p>
        ) : fb.flows.length === 0 ? (
          <EmptyState onCreateFlow={handleCreateFlow} creating={creating} />
        ) : (
          <div className="grid gap-3 max-w-2xl">
            {fb.flows.map(flow => {
              const meta = flowMeta[flow.id]
              const compatible = meta ? isSimpleCompatible(meta.nodes, meta.edges, meta.triggers) : true
              const keywords = (meta?.triggers ?? []).filter(t => t.trigger_type === 'keyword' && t.trigger_value).map(t => t.trigger_value as string)
              const sc = statusColor[flow.status] ?? statusColor.draft
              return compatible ? (
                <SimpleFlowCard
                  key={flow.id} name={flow.name} status={flow.status} statusColor={sc} keywords={keywords}
                  stepCount={(meta?.nodes ?? []).filter(n => ['message', 'input'].includes(n.node_type)).length}
                  onEdit={() => navigate(`/dashboard/builder?flow=${flow.id}`)}
                />
              ) : (
                <AdvancedFlowCard
                  key={flow.id} name={flow.name} status={flow.status} statusColor={sc}
                  onOpenAdvanced={() => navigate(`/dashboard/builder/advanced?flow=${flow.id}`)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ onCreateFlow, creating }: { onCreateFlow: () => void; creating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <div className="rounded-full bg-primary/10 p-4"><Zap className="h-8 w-8 text-primary" /></div>
      <div>
        <p className="font-medium">No conversations yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create your first conversation to get started.</p>
      </div>
      <Button onClick={onCreateFlow} disabled={creating} className="gap-2">
        <Plus className="h-4 w-4" /> Create conversation
      </Button>
    </div>
  )
}

function SimpleFlowCard({ name, status, statusColor, keywords, stepCount, onEdit }: { name: string; status: string; statusColor: string; keywords: string[]; stepCount: number; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-raised hover:bg-muted/30 cursor-pointer transition-colors group" onClick={onEdit}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="rounded-md bg-primary/10 p-2 shrink-0"><MessageSquare className="h-4 w-4 text-primary" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${statusColor}`}>{status}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stepCount} step{stepCount !== 1 ? 's' : ''}{keywords.length > 0 && <> · {keywords.slice(0, 3).join(', ')}{keywords.length > 3 ? ` +${keywords.length - 3}` : ''}</>}
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-3 group-hover:text-foreground transition-colors" />
    </div>
  )
}

function AdvancedFlowCard({ name, status, statusColor, onOpenAdvanced }: { name: string; status: string; statusColor: string; onOpenAdvanced: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-surface-raised/50 opacity-80">
      <div className="flex items-start gap-3 min-w-0">
        <div className="rounded-md bg-muted p-2 shrink-0"><Lock className="h-4 w-4 text-muted-foreground" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${statusColor}`}>{status}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 font-medium">Advanced</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">This conversation uses advanced features. Open in Advanced Builder to edit.</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="text-xs gap-1.5 shrink-0 ml-3" onClick={e => { e.stopPropagation(); onOpenAdvanced() }}>
        <ExternalLink className="h-3.5 w-3.5" /> Advanced Builder
      </Button>
    </div>
  )
}
