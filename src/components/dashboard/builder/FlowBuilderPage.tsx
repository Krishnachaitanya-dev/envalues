import { useCallback, useEffect, useState } from 'react'
import { Layers, X } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'
import TemplatePickerModal from '@/features/flow-templates/ui/TemplatePickerModal'
import type { FlowTemplate } from '@/features/flow-templates/domain/template.types'
import EdgeConfigPanel from './EdgeConfigPanel'
import FlowCanvas from './FlowCanvas'
import FlowList from './FlowList'
import NodeConfigPanel from './NodeConfigPanel'
import TriggerPanel from './TriggerPanel'

export default function FlowBuilderPage() {
  const { user } = useDashboard()
  const fb = useFlowBuilder(user?.id ?? null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [configDirty, setConfigDirty] = useState(false)
  const [flowListOpen, setFlowListOpen] = useState(false)

  useEffect(() => {
    if (!fb.selectedFlowId && fb.flows.length > 0) {
      void fb.selectFlow(fb.flows[0].id)
    }
  }, [fb.flows, fb.selectedFlowId, fb.selectFlow])

  const selectedFlow = fb.flows.find((flow) => flow.id === fb.selectedFlowId) ?? null
  const selectedNode = fb.selectedNodeId ? fb.getFlowNode(fb.selectedNodeId) ?? null : null
  const selectedEdge = fb.selectedEdgeId ? fb.getFlowEdge(fb.selectedEdgeId) ?? null : null

  const allowSelectionChange = useCallback(() => {
    return !configDirty || confirm('Discard unsaved changes?')
  }, [configDirty])

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!allowSelectionChange()) return
    setConfigDirty(false)
    fb.setSelectedEdgeId(null)
    fb.setSelectedNodeId(nodeId === fb.selectedNodeId ? null : nodeId)
  }, [allowSelectionChange, fb.selectedNodeId, fb.setSelectedEdgeId, fb.setSelectedNodeId])

  const handleEdgeClick = useCallback((edgeId: string) => {
    if (!allowSelectionChange()) return
    setConfigDirty(false)
    fb.setSelectedNodeId(null)
    fb.setSelectedEdgeId(edgeId === fb.selectedEdgeId ? null : edgeId)
  }, [allowSelectionChange, fb.selectedEdgeId, fb.setSelectedEdgeId, fb.setSelectedNodeId])

  const handleSelectFlow = useCallback(async (flowId: string) => {
    if (!allowSelectionChange()) return
    setConfigDirty(false)
    await fb.selectFlow(flowId)
    setFlowListOpen(false)
  }, [allowSelectionChange, fb.selectFlow])

  const handlePublish = useCallback(async () => {
    if (!fb.selectedFlowId) return
    const hasStart = fb.rfNodes.some((node) => node.data.nodeType === 'start')
    if (!hasStart) {
      alert('A flow must have at least one Start node before publishing.')
      return
    }
    await fb.publishFlow(fb.selectedFlowId)
  }, [fb.publishFlow, fb.rfNodes, fb.selectedFlowId])

  const handleUnpublish = useCallback(async () => {
    if (!fb.selectedFlowId) return
    await fb.unpublishFlow(fb.selectedFlowId)
  }, [fb.selectedFlowId, fb.unpublishFlow])

  const handleApplyTemplate = useCallback(async (template: FlowTemplate) => {
    await fb.applyFlowTemplate(template.id, template.version, template.name)
  }, [fb.applyFlowTemplate])

  const showNodePanel = Boolean(fb.selectedNodeId)
  const showEdgePanel = !showNodePanel && Boolean(fb.selectedEdgeId)

  return (
    <div className="h-full min-h-0 flex min-w-0 overflow-hidden">
      <div className="hidden md:flex">
        <FlowList
          flows={fb.flows}
          selectedFlowId={fb.selectedFlowId}
          onSelectFlow={handleSelectFlow}
          onCreateFlow={async (name) => { await fb.createFlow(name) }}
          onRenameFlow={fb.renameFlow}
          onDeleteFlow={fb.deleteFlow}
        />
      </div>

      {flowListOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close flow list"
            onClick={() => setFlowListOpen(false)}
          />
          <div className="relative h-full w-[86vw] max-w-80 shadow-2xl">
            <FlowList
              flows={fb.flows}
              selectedFlowId={fb.selectedFlowId}
              onSelectFlow={handleSelectFlow}
              onCreateFlow={async (name) => { await fb.createFlow(name); setFlowListOpen(false) }}
              onRenameFlow={fb.renameFlow}
              onDeleteFlow={fb.deleteFlow}
              className="h-full w-full"
            />
            <button
              type="button"
              onClick={() => setFlowListOpen(false)}
              className="absolute right-3 top-3 touch-target rounded-xl bg-background/80 text-muted-foreground hover:text-foreground md:hidden flex items-center justify-center"
              aria-label="Close flow list"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedFlow ? (
          <div className="flex items-center gap-2 px-2 sm:px-3 py-2 sm:py-1.5 border-b border-border bg-card/50 backdrop-blur-sm shrink-0 min-w-0">
            <button
              type="button"
              onClick={() => setFlowListOpen(true)}
              className="md:hidden inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] font-bold text-foreground"
            >
              <Layers size={13} />
              Flows
            </button>
            <span className="text-xs font-bold text-foreground truncate">{selectedFlow.name}</span>
            <TriggerPanel
              triggers={fb.triggers}
              flowId={fb.selectedFlowId}
              onAddTrigger={fb.addTrigger}
              onRemoveTrigger={fb.removeTrigger}
            />
          </div>
        ) : (
          <div className="md:hidden flex items-center justify-between gap-2 px-2 py-2 border-b border-border bg-card/50 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Select or create a flow</span>
            <button
              type="button"
              onClick={() => setFlowListOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] font-bold text-foreground"
            >
              <Layers size={13} />
              Flows
            </button>
          </div>
        )}

        <FlowCanvas
          selectedFlow={selectedFlow}
          rfNodes={fb.rfNodes}
          rfEdges={fb.rfEdges}
          onNodesChange={fb.onNodesChange}
          onEdgesChange={fb.onEdgesChange}
          onConnect={fb.onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onAddNode={fb.addNode}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
        />
      </div>

      {showNodePanel && (
        <NodeConfigPanel
          node={selectedNode}
          ownerId={user?.id ?? null}
          flowId={fb.selectedFlowId}
          flows={fb.flows}
          allNodes={fb.dbNodes}
          onClose={() => { setConfigDirty(false); fb.setSelectedNodeId(null) }}
          onUpdateConfig={fb.updateNodeConfig}
          onDeleteNode={fb.deleteNode}
          onDirtyChange={setConfigDirty}
        />
      )}

      {showEdgePanel && (
        <EdgeConfigPanel
          edge={selectedEdge}
          onClose={() => { setConfigDirty(false); fb.setSelectedEdgeId(null) }}
          onUpdate={fb.updateEdge}
          onDelete={fb.deleteEdge}
          onDirtyChange={setConfigDirty}
        />
      )}

      <TemplatePickerModal
        ownerId={user?.id ?? null}
        open={templatesOpen}
        applying={fb.templateApplying}
        onClose={() => setTemplatesOpen(false)}
        onApply={handleApplyTemplate}
      />
    </div>
  )
}
