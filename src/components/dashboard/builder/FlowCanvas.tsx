import { useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowRight,
  Bot,
  ChevronDown,
  Clock,
  Code2,
  GitBranch,
  Handshake,
  HelpCircle,
  LogOut,
  Maximize2,
  MessageSquare,
  Plus,
  PlayCircle,
  Sparkles,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import type { Flow, NodeType } from '@/integrations/supabase/flow-types'
import type { RFEdgeData, RFNodeData } from '@/hooks/useFlowBuilder'
import { useIsMobile } from '@/hooks/use-mobile'
import { nodeTypes } from './nodes/nodeTypes'

type RFNode = Node<RFNodeData, 'flowNode'>
type RFEdge = Edge<RFEdgeData>

interface FlowCanvasProps {
  selectedFlow: Flow | null
  rfNodes: RFNode[]
  rfEdges: RFEdge[]
  onNodesChange: OnNodesChange<RFNode>
  onEdgesChange: OnEdgesChange<RFEdge>
  onConnect: (connection: Connection) => void | Promise<void>
  onNodeClick: (nodeId: string) => void
  onEdgeClick: (edgeId: string) => void
  onAddNode: (nodeType: NodeType, position?: XYPosition) => Promise<unknown>
  onOpenTemplates: () => void
  onPublish: () => Promise<void>
  onUnpublish: () => Promise<void>
}

const ADD_NODE_GROUPS: { label: string; items: { type: NodeType; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Messages',
    items: [
      { type: 'message', label: 'Message', icon: MessageSquare },
      { type: 'input', label: 'Input', icon: HelpCircle },
    ],
  },
  {
    label: 'Logic',
    items: [
      { type: 'condition', label: 'Condition', icon: GitBranch },
    ],
  },
  {
    label: 'Actions',
    items: [
      { type: 'api', label: 'API', icon: Code2 },
      { type: 'delay', label: 'Delay', icon: Clock },
      { type: 'handoff', label: 'Handoff', icon: Handshake },
    ],
  },
  {
    label: 'Flow control',
    items: [
      { type: 'start', label: 'Start', icon: PlayCircle },
      { type: 'jump', label: 'Jump', icon: ArrowRight },
      { type: 'subflow', label: 'Subflow', icon: Bot },
      { type: 'end', label: 'End', icon: LogOut },
    ],
  },
]

const nodeColors: Record<NodeType, string> = {
  start: '#34d399',
  message: '#38bdf8',
  input: '#f59e0b',
  condition: '#a78bfa',
  api: '#818cf8',
  delay: '#fb923c',
  jump: '#22d3ee',
  subflow: '#e879f9',
  handoff: '#fb7185',
  end: '#a1a1aa',
}

function CanvasInner(props: FlowCanvasProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const {
    selectedFlow,
    rfNodes,
    rfEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onAddNode,
    onOpenTemplates,
    onPublish,
    onUnpublish,
  } = props
  const { fitView, screenToFlowPosition, zoomIn, zoomOut } = useReactFlow()
  const isMobile = useIsMobile()

  const handleAddNode = async (nodeType: NodeType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    await onAddNode(nodeType, position)
    setAddMenuOpen(false)
  }

  if (!selectedFlow) {
    return (
      <div className="h-full min-h-0 w-full flex-1 bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
            <Bot size={26} className="text-muted-foreground" />
          </div>
          <h2 className="text-base font-bold text-foreground">No flow selected</h2>
          <p className="text-sm text-muted-foreground mt-1">Create or select a flow from the left panel to start building.</p>
          <button
            onClick={onOpenTemplates}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90"
          >
            <Sparkles size={14} />
            Use Stock Template
          </button>
        </div>
      </div>
    )
  }

  const isPublished = selectedFlow.status === 'published'

  return (
    <div className="h-full min-h-0 w-full flex-1 relative overflow-hidden bg-background">
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pointer-events-none">
        <div className="relative pointer-events-auto">
          <button
            onClick={() => setAddMenuOpen((open) => !open)}
            className="inline-flex touch-target items-center gap-2 rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-muted"
            aria-expanded={addMenuOpen}
          >
            <Plus size={14} className="text-primary" />
            Add node
            <ChevronDown size={13} className={addMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>

          {addMenuOpen && (
            <div className="fixed left-3 right-3 top-[118px] max-h-[62dvh] overflow-y-auto rounded-2xl border border-border bg-card/95 backdrop-blur shadow-2xl p-2 space-y-2 sm:absolute sm:left-0 sm:right-auto sm:top-11 sm:w-72 sm:max-h-[70vh]">
              {ADD_NODE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.type}
                          onClick={() => void handleAddNode(item.type)}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Icon size={13} />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex max-w-full items-center gap-1.5 pointer-events-auto overflow-x-auto rounded-xl">
          <button
            onClick={onOpenTemplates}
            className="inline-flex touch-target items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card/95 text-xs font-bold text-foreground hover:bg-muted transition-colors whitespace-nowrap"
          >
            <Sparkles size={13} className="text-primary" />
            Templates
          </button>
          <button
            onClick={() => zoomOut()}
            className="touch-target rounded-lg border border-border bg-card/95 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => zoomIn()}
            className="touch-target rounded-lg border border-border bg-card/95 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => fitView({ padding: 0.2 })}
            className="touch-target rounded-lg border border-border bg-card/95 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
            title="Fit view"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={() => void (isPublished ? onUnpublish() : onPublish())}
            className={[
              'touch-target px-3 py-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap',
              isPublished
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/15'
                : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
            ].join(' ')}
          >
            {isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <ReactFlow
        className="h-full w-full"
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onEdgeClick={(_, edge) => onEdgeClick(edge.id)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls
          position="bottom-left"
          style={{
            backgroundColor: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
          }}
        />
        {!isMobile && (
          <MiniMap
            position="bottom-right"
            zoomable
            pannable
            nodeColor={(node) => nodeColors[(node.data as RFNodeData).nodeType] ?? '#94a3b8'}
            style={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.75rem',
            }}
            maskColor="rgba(0,0,0,0.6)"
          />
        )}
      </ReactFlow>
    </div>
  )
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
