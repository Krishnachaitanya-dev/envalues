import { useCallback, useMemo, useState } from 'react'
import {
  Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow,
  applyNodeChanges, applyEdgeChanges,
  type Connection, type Edge, type Node, type NodeChange, type EdgeChange, type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, MessageSquare, HelpCircle, ChevronDown, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { SimpleFlow, SimpleStep, SimpleTrigger } from '@/types/simpleFlow'
import SimpleNode, { type SimpleNodeData } from './SimpleNode'

type RFNode = Node<SimpleNodeData, 'simpleNode'>
type RFEdge = Edge

interface Props {
  flow: SimpleFlow
  selectedStepId: string | null
  onSelectStep: (id: string | null) => void
  onChangeSteps: (steps: SimpleStep[]) => void
  onDeleteStep: (id: string) => void
  onAddStep: (kind: 'message' | 'open_text' | 'button_choices') => void
}

const nodeTypes: NodeTypes = { simpleNode: SimpleNode as unknown as NodeTypes[string] }

function Inner({ flow, selectedStepId, onSelectStep, onChangeSteps, onDeleteStep, onAddStep }: Props) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const [menuOpen, setMenuOpen] = useState(false)

  // Step id → list of keywords for any trigger targeting it
  const triggerKeywordsByStep = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const t of flow.triggers) {
      if (!t.targetStepId) continue
      if (!map[t.targetStepId]) map[t.targetStepId] = []
      for (const kw of t.keywords) {
        if (!map[t.targetStepId].includes(kw)) map[t.targetStepId].push(kw)
      }
    }
    return map
  }, [flow.triggers])

  // Steps → React Flow nodes (auto-layout if no position)
  const rfNodes = useMemo<RFNode[]>(() => {
    return flow.steps.map((step, i) => {
      const pos = step.position ?? { x: 220 + (i % 3) * 320, y: 40 + Math.floor(i / 3) * 260 }
      return {
        id: step.id,
        type: 'simpleNode',
        position: pos,
        data: {
          step,
          triggerKeywords: triggerKeywordsByStep[step.id] ?? [],
          onDelete: onDeleteStep,
        },
        selected: step.id === selectedStepId,
      }
    })
  }, [flow.steps, triggerKeywordsByStep, selectedStepId, onDeleteStep])

  // Steps → React Flow edges
  const rfEdges = useMemo<RFEdge[]>(() => {
    const edges: RFEdge[] = []
    for (const step of flow.steps) {
      if (step.mode === 'button_choices' && step.buttons) {
        for (const btn of step.buttons) {
          if (btn.nextStepId) {
            edges.push({
              id: `${step.id}:${btn.id}`,
              source: step.id,
              target: btn.nextStepId,
              sourceHandle: `btn-${btn.id}`,
              targetHandle: 'in',
              label: btn.title.trim() || '(empty)',
              type: 'smoothstep',
              style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
              labelBgStyle: { fill: 'hsl(var(--background))' },
              labelStyle: { fontSize: 10, fill: 'hsl(var(--foreground))' },
            })
          }
        }
      } else if (step.mode !== 'button_choices' && step.nextStepId) {
        edges.push({
          id: `${step.id}:next`,
          source: step.id,
          target: step.nextStepId,
          sourceHandle: 'out',
          targetHandle: 'in',
          type: 'smoothstep',
          style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
        })
      }
    }
    return edges
  }, [flow.steps])

  const handleNodesChange = useCallback((changes: NodeChange<RFNode>[]) => {
    // Track drag position changes → persist to step.position
    const next = applyNodeChanges(changes, rfNodes)
    const positionPatches: Record<string, { x: number; y: number }> = {}
    for (const n of next) {
      const original = flow.steps.find(s => s.id === n.id)
      if (!original) continue
      if (!original.position || original.position.x !== n.position.x || original.position.y !== n.position.y) {
        positionPatches[n.id] = { x: n.position.x, y: n.position.y }
      }
    }
    if (Object.keys(positionPatches).length > 0) {
      onChangeSteps(
        flow.steps.map(s => positionPatches[s.id] ? { ...s, position: positionPatches[s.id] } : s),
      )
    }
  }, [rfNodes, flow.steps, onChangeSteps])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Handle edge deletion — detach nextStepId / button target
    const removed = changes.filter(c => c.type === 'remove').map(c => c.id)
    if (removed.length === 0) return
    const patched = flow.steps.map(step => {
      let modified = { ...step }
      for (const edgeId of removed) {
        if (edgeId === `${step.id}:next`) {
          modified = { ...modified, nextStepId: null }
        } else if (step.buttons) {
          const btnEdge = step.buttons.find(b => `${step.id}:${b.id}` === edgeId)
          if (btnEdge) {
            modified = {
              ...modified,
              buttons: modified.buttons!.map(b => b.id === btnEdge.id ? { ...b, nextStepId: null } : b),
            }
          }
        }
      }
      return modified
    })
    onChangeSteps(patched)
    // Also apply the visual change (no-op for position since we rebuild from steps)
    applyEdgeChanges(changes, rfEdges)
  }, [flow.steps, rfEdges, onChangeSteps])

  const handleConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return
    if (conn.source === conn.target) return
    const sourceStep = flow.steps.find(s => s.id === conn.source)
    if (!sourceStep) return
    const handle = conn.sourceHandle ?? 'out'

    if (handle.startsWith('btn-')) {
      const btnId = handle.slice(4)
      onChangeSteps(flow.steps.map(s => {
        if (s.id !== sourceStep.id) return s
        return { ...s, buttons: (s.buttons ?? []).map(b => b.id === btnId ? { ...b, nextStepId: conn.target } : b) }
      }))
    } else {
      onChangeSteps(flow.steps.map(s => s.id === sourceStep.id ? { ...s, nextStepId: conn.target } : s))
    }
  }, [flow.steps, onChangeSteps])

  return (
    <div className="relative h-full min-h-0 w-full bg-background">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(open => !open)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 backdrop-blur px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
          >
            <Plus className="h-3 w-3 text-primary" /> Add step
            <ChevronDown className={`h-3 w-3 ${menuOpen ? 'rotate-180' : ''} transition-transform`} />
          </button>
          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-border bg-card/95 backdrop-blur shadow-xl p-1 z-20">
              <MenuItem icon={MessageSquare} label="Message" desc="Send text + media" onClick={() => { onAddStep('message'); setMenuOpen(false) }} />
              <MenuItem icon={HelpCircle} label="Question · buttons" desc="Offer reply buttons" onClick={() => { onAddStep('button_choices'); setMenuOpen(false) }} />
              <MenuItem icon={HelpCircle} label="Question · open text" desc="Wait for typed reply" onClick={() => { onAddStep('open_text'); setMenuOpen(false) }} />
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button onClick={() => zoomOut()} className="p-1.5 rounded-md border border-border bg-card/95 text-muted-foreground hover:text-foreground" title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => zoomIn()} className="p-1.5 rounded-md border border-border bg-card/95 text-muted-foreground hover:text-foreground" title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => fitView({ padding: 0.2 })} className="p-1.5 rounded-md border border-border bg-card/95 text-muted-foreground hover:text-foreground" title="Fit view">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={(_, node) => onSelectStep(node.id)}
        onPaneClick={() => onSelectStep(null)}
        fitView
        proOptions={{ hideAttribution: true }}
        className="h-full w-full"
      >
        <Background gap={20} size={1} />
        <Controls position="bottom-left" showInteractive={false} style={{
          backgroundColor: 'hsl(var(--card))',
          borderColor: 'hsl(var(--border))',
          borderRadius: '0.5rem',
        }} />
      </ReactFlow>

      {flow.steps.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center px-4 pointer-events-auto">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Empty canvas</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Add step" to place your first message.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, desc, onClick }: { icon: typeof MessageSquare; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2 px-2 py-2 rounded-md hover:bg-muted transition-colors text-left"
    >
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </button>
  )
}

export default function SimpleCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <div className="h-full min-h-0 w-full">
        <Inner {...props} />
      </div>
    </ReactFlowProvider>
  )
}
