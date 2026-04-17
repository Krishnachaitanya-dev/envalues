import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Zap, ArrowRight, Workflow, Lock, ExternalLink, MessageSquare, Eye, EyeOff } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/contexts/DashboardContext'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'
import { isSimpleCompatible } from '@/lib/simpleFlowCompat'
import { graphToSimple, simpleToGraph } from '@/lib/simpleFlowAdapter'
import type { FlowNode, FlowEdge, FlowTrigger } from '@/integrations/supabase/flow-types'
import type { SimpleFlow, SimpleStep, SimpleTrigger } from '@/types/simpleFlow'
import { supabase } from '@/integrations/supabase/client'
import StepEditor from './simple/StepEditor'
import TriggerPanel from './simple/TriggerPanel'
import ConversationPreview from './simple/ConversationPreview'
import SimpleCanvas from './simple/SimpleCanvas'

interface FlowMeta { nodes: FlowNode[]; edges: FlowEdge[]; triggers: FlowTrigger[] }

export default function SimpleBuilderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeFlowId = searchParams.get('flow')
  const { user } = useDashboard()
  const fb = useFlowBuilder(user?.id ?? null)

  const [creating, setCreating] = useState(false)
  const [flowMeta, setFlowMeta] = useState<Record<string, FlowMeta>>({})
  const [metaLoading, setMetaLoading] = useState(false)

  const [simpleFlow, setSimpleFlow] = useState<SimpleFlow | null>(null)
  const [editorMeta, setEditorMeta] = useState<FlowMeta | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)

  // ── Flow list meta fetch ──
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

  // ── Editor: load flow ──
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
      setSelectedStepId(null)
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
      const { nodes, edges, triggers } = simpleToGraph(simpleFlow, user.id, editorMeta.nodes)
      await supabase.from('flow_edges').delete().eq('flow_id', simpleFlow.id)
      await supabase.from('flow_nodes').delete().eq('flow_id', simpleFlow.id)
      if (nodes.length > 0) await (supabase.from('flow_nodes') as unknown as { insert: (rows: unknown[]) => Promise<unknown> }).insert(nodes)
      if (edges.length > 0) await (supabase.from('flow_edges') as unknown as { insert: (rows: unknown[]) => Promise<unknown> }).insert(edges)
      await supabase.from('flow_triggers').delete().eq('flow_id', simpleFlow.id).eq('trigger_type', 'keyword')
      if (triggers.length > 0) {
        await (supabase.from('flow_triggers') as unknown as { insert: (rows: unknown[]) => Promise<unknown> }).insert(triggers)
      }
      const [nr, er, tr] = await Promise.all([
        supabase.from('flow_nodes').select('*').eq('flow_id', simpleFlow.id),
        supabase.from('flow_edges').select('*').eq('flow_id', simpleFlow.id),
        supabase.from('flow_triggers').select('*').eq('flow_id', simpleFlow.id),
      ])
      setEditorMeta({
        nodes: (nr.data ?? []) as FlowNode[],
        edges: (er.data ?? []) as FlowEdge[],
        triggers: (tr.data ?? []) as FlowTrigger[],
      })
    } finally {
      setSaving(false)
    }
  }, [simpleFlow, user, editorMeta])

  const handleAddStep = useCallback((kind: 'message' | 'open_text' | 'button_choices') => {
    setSimpleFlow(prev => {
      if (!prev) return prev
      const i = prev.steps.length
      const newStep: SimpleStep = {
        id: crypto.randomUUID(),
        type: kind === 'message' ? 'message' : 'question',
        mode: kind === 'message' ? undefined : kind,
        text: '',
        buttons: kind === 'button_choices' ? [{ id: crypto.randomUUID(), title: '', nextStepId: null }] : undefined,
        position: { x: 220 + (i % 3) * 320, y: 40 + Math.floor(i / 3) * 260 },
        _isNew: true,
      }
      setSelectedStepId(newStep.id)
      return { ...prev, steps: [...prev.steps, newStep] }
    })
  }, [])

  const handleDeleteStep = useCallback((id: string) => {
    setSimpleFlow(prev => {
      if (!prev) return prev
      // Detach refs: clear any nextStepId pointing to deleted id, and any trigger targeting it
      const cleanedSteps = prev.steps.filter(s => s.id !== id).map(s => ({
        ...s,
        nextStepId: s.nextStepId === id ? null : s.nextStepId,
        buttons: s.buttons?.map(b => b.nextStepId === id ? { ...b, nextStepId: null } : b),
      }))
      const cleanedTriggers = prev.triggers.map(t => t.targetStepId === id ? { ...t, targetStepId: cleanedSteps[0]?.id ?? null } : t)
      return { ...prev, steps: cleanedSteps, triggers: cleanedTriggers }
    })
    setSelectedStepId(prev => prev === id ? null : prev)
  }, [])

  const handleStepChange = useCallback((updated: SimpleStep) => {
    setSimpleFlow(prev => prev ? { ...prev, steps: prev.steps.map(s => s.id === updated.id ? updated : s) } : prev)
  }, [])

  const handleStepsChange = useCallback((steps: SimpleStep[]) => {
    setSimpleFlow(prev => prev ? { ...prev, steps } : prev)
  }, [])

  const handleTriggersChange = useCallback((triggers: SimpleTrigger[]) => {
    setSimpleFlow(prev => prev ? { ...prev, triggers } : prev)
  }, [])

  const statusColor: Record<string, string> = {
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    draft: 'bg-muted text-muted-foreground border-border',
    archived: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  const canSave = useMemo(() => {
    if (!simpleFlow) return false
    const hasStep = simpleFlow.steps.length > 0
    const hasTrigger = simpleFlow.triggers.some(t => t.keywords.length > 0 && t.targetStepId)
    return hasStep && hasTrigger
  }, [simpleFlow])

  // ── Editor view ──
  if (activeFlowId && simpleFlow) {
    const selectedStep = simpleFlow.steps.find(s => s.id === selectedStepId) ?? null
    return (
      <div className="flex flex-col h-full min-h-[calc(100dvh-52px)] bg-background overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard/builder')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              ← Back
            </button>
            <span className="text-muted-foreground/40 shrink-0">|</span>
            <span className="text-sm font-medium truncate">{simpleFlow.name}</span>
            {!canSave && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 shrink-0">
                Add a trigger + step to save
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost" size="sm"
              className="text-xs text-muted-foreground gap-1.5"
              onClick={() => setPreviewOpen(o => !o)}
              title={previewOpen ? 'Hide preview' : 'Show preview'}
            >
              {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Preview
            </Button>
            <Button
              variant="ghost" size="sm"
              className="text-xs text-muted-foreground gap-1.5"
              onClick={() => navigate(`/dashboard/builder/advanced?flow=${activeFlowId}`)}
            >
              <Workflow className="h-3.5 w-3.5" />
              Advanced
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !canSave} className="gap-2 min-w-[70px]">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Triggers */}
          <div className="w-60 border-r border-border shrink-0 overflow-hidden flex flex-col">
            <TriggerPanel
              triggers={simpleFlow.triggers}
              steps={simpleFlow.steps}
              onChange={handleTriggersChange}
            />
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden min-w-0">
            <SimpleCanvas
              flow={simpleFlow}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              onChangeSteps={handleStepsChange}
              onDeleteStep={handleDeleteStep}
              onAddStep={handleAddStep}
            />
          </div>

          {/* Inspector: step editor or preview */}
          {selectedStep ? (
            <div className="w-[360px] border-l border-border shrink-0 overflow-hidden flex flex-col">
              <StepEditor
                step={selectedStep}
                ownerId={user?.id ?? null}
                flowId={simpleFlow.id}
                onChange={handleStepChange}
                onDelete={handleDeleteStep}
              />
            </div>
          ) : previewOpen ? (
            <div className="hidden lg:flex w-72 border-l border-border shrink-0 p-3 overflow-hidden">
              <ConversationPreview flow={simpleFlow} />
            </div>
          ) : null}

          {/* Preview overlay when step is selected AND preview toggled on */}
          {selectedStep && previewOpen && (
            <div className="hidden xl:flex w-72 border-l border-border shrink-0 p-3 overflow-hidden">
              <ConversationPreview flow={simpleFlow} />
            </div>
          )}
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
          <p className="text-sm text-muted-foreground mt-0.5">Build WhatsApp chatbots visually — no code.</p>
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
