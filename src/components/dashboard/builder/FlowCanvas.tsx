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
  Clock,
  Code2,
  GitBranch,
  Handshake,
  HelpCircle,
  LogOut,
  Maximize2,
  MessageSquare,
  PlayCircle,
  Sparkles,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import type { Flow, NodeType } from '@/integrations/supabase/flow-types'
import type { RFEdgeData, RFNodeData } from '@/hooks/useFlowBuilder'
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

const ADD_NODE_ITEMS: { type: NodeType; label: string; icon: LucideIcon }[] = [
  { type: 'start', label: 'Start', icon: PlayCircle },
  { type: 'message', label: 'Message', icon: MessageSquare },
  { type: 'input', label: 'Input', icon: HelpCircle },
  { type: 'condition', label: 'Condition', icon: GitBranch },
  { type: 'api', label: 'API', icon: Code2 },
  { type: 'delay', label: 'Delay', icon: Clock },
  { type: 'jump', label: 'Jump', icon: ArrowRight },
  { type: 'subflow', label: 'Subflow', icon: Bot },
  { type: 'handoff', label: 'Handoff', icon: Handshake },
  { type: 'end', label: 'End', icon: LogOut },
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

  const handleAddNode = async (nodeType: NodeType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    await onAddNode(nodeType, position)
  }

  if (!selectedFlow) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
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
    <div className="flex-1 relative overflow-hidden bg-background">
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-card/95 backdrop-blur p-1 shadow-sm pointer-events-auto">
          {ADD_NODE_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.type}
                onClick={() => void handleAddNode(item.type)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                <Icon size={13} />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={onOpenTemplates}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card/95 text-xs font-bold text-foreground hover:bg-muted transition-colors"
          >
            <Sparkles size={13} className="text-primary" />
            Templates
          </button>
          <button
            onClick={() => zoomOut()}
            className="w-8 h-8 rounded-lg border border-border bg-card/95 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => zoomIn()}
            className="w-8 h-8 rounded-lg border border-border bg-card/95 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => fitView({ padding: 0.2 })}
            className="w-8 h-8 rounded-lg border border-border bg-card/95 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
            title="Fit view"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={() => void (isPublished ? onUnpublish() : onPublish())}
            className={[
              'px-3 py-2 rounded-lg text-xs font-bold border transition-colors',
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
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          zoomable
          pannable
          nodeColor={(node) => nodeColors[(node.data as RFNodeData).nodeType] ?? '#94a3b8'}
        />
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
