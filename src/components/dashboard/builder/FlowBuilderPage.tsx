import { useCallback, useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!fb.selectedFlowId && fb.flows.length > 0) {
      void fb.selectFlow(fb.flows[0].id)
    }
  }, [fb.flows, fb.selectedFlowId, fb.selectFlow])

  const selectedFlow = fb.flows.find((flow) => flow.id === fb.selectedFlowId) ?? null
  const selectedNode = fb.selectedNodeId ? fb.getFlowNode(fb.selectedNodeId) ?? null : null
  const selectedEdge = fb.selectedEdgeId ? fb.getFlowEdge(fb.selectedEdgeId) ?? null : null

  const handleNodeClick = useCallback((nodeId: string) => {
    fb.setSelectedEdgeId(null)
    fb.setSelectedNodeId(nodeId === fb.selectedNodeId ? null : nodeId)
  }, [fb.selectedNodeId, fb.setSelectedEdgeId, fb.setSelectedNodeId])

  const handleEdgeClick = useCallback((edgeId: string) => {
    fb.setSelectedNodeId(null)
    fb.setSelectedEdgeId(edgeId === fb.selectedEdgeId ? null : edgeId)
  }, [fb.selectedEdgeId, fb.setSelectedEdgeId, fb.setSelectedNodeId])

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
    <div className="h-[calc(100vh-52px)] flex overflow-hidden">
      <FlowList
        flows={fb.flows}
        selectedFlowId={fb.selectedFlowId}
        onSelectFlow={fb.selectFlow}
        onCreateFlow={async (name) => { await fb.createFlow(name) }}
        onRenameFlow={fb.renameFlow}
        onDeleteFlow={fb.deleteFlow}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedFlow && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
            <span className="text-xs font-bold text-foreground truncate">{selectedFlow.name}</span>
            <TriggerPanel
              triggers={fb.triggers}
              flowId={fb.selectedFlowId}
              onAddTrigger={fb.addTrigger}
              onRemoveTrigger={fb.removeTrigger}
            />
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
          flows={fb.flows}
          allNodes={fb.dbNodes}
          onClose={() => fb.setSelectedNodeId(null)}
          onUpdateConfig={fb.updateNodeConfig}
          onDeleteNode={fb.deleteNode}
        />
      )}

      {showEdgePanel && (
        <EdgeConfigPanel
          edge={selectedEdge}
          onClose={() => fb.setSelectedEdgeId(null)}
          onUpdate={fb.updateEdge}
          onDelete={fb.deleteEdge}
        />
      )}

      {!showNodePanel && !showEdgePanel && (
        <NodeConfigPanel
          node={null}
          flows={fb.flows}
          allNodes={fb.dbNodes}
          onClose={() => undefined}
          onUpdateConfig={fb.updateNodeConfig}
          onDeleteNode={fb.deleteNode}
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
