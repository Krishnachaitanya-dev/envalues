import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addEdge,
  MarkerType,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import { supabase } from '@/integrations/supabase/client'
import { deleteFlowMediaPrefix, deleteFlowNodeMedia, getUploadedStoragePaths } from '@/features/flow-media/uploadFlowNodeMedia'
import { applyFlowTemplate as applyFlowTemplateService } from '@/features/flow-templates/services/applyFlowTemplate'
import { trackTemplateEvent } from '@/features/flow-templates/services/templateEvents'
import type {
  ConditionType,
  Flow,
  FlowEdge,
  FlowNode,
  FlowTrigger,
  NodeType,
} from '@/integrations/supabase/flow-types'

export interface RFNodeData extends Record<string, unknown> {
  nodeType: NodeType
  label: string | null
  config: Record<string, unknown>
}

export interface RFEdgeData extends Record<string, unknown> {
  condition_type: ConditionType
  condition_value: string | null
  condition_variable: string | null
  condition_expression?: string | null
  is_fallback: boolean
  priority: number
}

type RFNode = Node<RFNodeData, 'flowNode'>
type RFEdge = Edge<RFEdgeData>

const NODE_DEFAULTS: Record<NodeType, { label: string; config: Record<string, unknown> }> = {
  start: { label: 'Start', config: { greeting_message: '' } },
  message: { label: 'Message', config: { text: 'New message' } },
  input: { label: 'Input', config: { prompt: 'Ask a question', store_as: 'answer', timeout_secs: 300 } },
  condition: { label: 'Condition', config: {} },
  api: { label: 'API Request', config: { url: '', method: 'GET', headers: {}, body_template: '', response_variable: 'api_response', timeout_secs: 10, retry_count: 2 } },
  delay: { label: 'Delay', config: { delay_secs: 5 } },
  jump: { label: 'Jump', config: { target_node_id: '' } },
  subflow: { label: 'Subflow', config: { subflow_id: '', return_mode: 'auto' } },
  handoff: { label: 'Handoff', config: { department: 'support', message: 'Connecting you to our team...', allow_resume: false, resume_node_id: null, queue_strategy: 'round_robin', handoff_timeout_hours: 24 } },
  end: { label: 'End', config: { farewell_message: '' } },
}

function toRFNode(node: FlowNode): RFNode {
  return {
    id: node.id,
    type: 'flowNode',
    position: { x: node.position_x ?? 0, y: node.position_y ?? 0 },
    data: {
      nodeType: node.node_type,
      label: node.label,
      config: node.config ?? {},
    },
  }
}

function edgeLabel(edge: FlowEdge) {
  if (edge.label) return edge.label
  if (edge.condition_type === 'always') return ''
  if (edge.condition_value) return edge.condition_value
  return edge.condition_type.replace(/_/g, ' ')
}

function toRFEdge(edge: FlowEdge): RFEdge {
  return {
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    type: 'smoothstep',
    animated: edge.condition_type === 'always',
    label: edgeLabel(edge),
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      condition_type: edge.condition_type,
      condition_value: edge.condition_value,
      condition_variable: edge.condition_variable,
      condition_expression: edge.condition_expression ?? null,
      is_fallback: edge.is_fallback,
      priority: edge.priority,
    },
  }
}

export function useFlowBuilder(ownerId: string | null) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [dbNodes, setDbNodes] = useState<FlowNode[]>([])
  const [dbEdges, setDbEdges] = useState<FlowEdge[]>([])
  const [triggers, setTriggers] = useState<FlowTrigger[]>([])
  const [rfNodes, setRfNodes, applyNodesChange] = useNodesState<RFNode>([])
  const [rfEdges, setRfEdges, applyEdgesChange] = useEdgesState<RFEdge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [templateApplying, setTemplateApplying] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const positionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFlowState = useCallback(() => {
    setSelectedFlowId(null)
    setDbNodes([])
    setDbEdges([])
    setTriggers([])
    setRfNodes([])
    setRfEdges([])
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [setRfEdges, setRfNodes])

  const loadFlows = useCallback(async () => {
    if (!ownerId) {
      setFlows([])
      clearFlowState()
      return
    }

    setLoading(true)
    try {
      const { data, error } = await (supabase.from('flows') as any)
        .select('*')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setFlows((data ?? []) as Flow[])
    } finally {
      setLoading(false)
    }
  }, [clearFlowState, ownerId])

  useEffect(() => {
    void loadFlows()
  }, [loadFlows])

  useEffect(() => () => {
    if (positionSaveTimer.current) clearTimeout(positionSaveTimer.current)
  }, [])

  const selectFlow = useCallback(async (flowId: string | null) => {
    if (!ownerId || !flowId) {
      clearFlowState()
      return
    }

    setSelectedFlowId(flowId)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setLoading(true)

    try {
      const [nodesRes, edgesRes, triggersRes] = await Promise.all([
        (supabase.from('flow_nodes') as any)
          .select('*')
          .eq('flow_id', flowId)
          .order('created_at', { ascending: true }),
        (supabase.from('flow_edges') as any)
          .select('*')
          .eq('flow_id', flowId)
          .order('priority', { ascending: true }),
        (supabase.from('flow_triggers') as any)
          .select('*')
          .eq('flow_id', flowId)
          .order('priority', { ascending: true }),
      ])

      if (nodesRes.error) throw nodesRes.error
      if (edgesRes.error) throw edgesRes.error
      if (triggersRes.error) throw triggersRes.error

      const nodes = (nodesRes.data ?? []) as FlowNode[]
      const edges = (edgesRes.data ?? []) as FlowEdge[]
      setDbNodes(nodes)
      setDbEdges(edges)
      setTriggers((triggersRes.data ?? []) as FlowTrigger[])
      setRfNodes(nodes.map(toRFNode))
      setRfEdges(edges.map(toRFEdge))
    } finally {
      setLoading(false)
    }
  }, [clearFlowState, ownerId, setRfEdges, setRfNodes])

  const onNodesChange = useCallback((changes: NodeChange<RFNode>[]) => {
    applyNodesChange(changes)

    const moved = changes.filter(
      (change) => change.type === 'position' && (change as any).position && !('dragging' in change && change.dragging),
    )
    if (!moved.length) return

    if (positionSaveTimer.current) clearTimeout(positionSaveTimer.current)
    positionSaveTimer.current = setTimeout(() => {
      moved.forEach((change) => {
        const position = (change as any).position as XYPosition
        void (supabase.from('flow_nodes') as any)
          .update({ position_x: position.x, position_y: position.y })
          .eq('id', change.id)
      })
    }, 500)
  }, [applyNodesChange])

  const onEdgesChange = useCallback((changes: EdgeChange<RFEdge>[]) => {
    applyEdgesChange(changes)
  }, [applyEdgesChange])

  const onConnect = useCallback(async (connection: Connection) => {
    if (!ownerId || !selectedFlowId || !connection.source || !connection.target) return

    const insert = {
      flow_id: selectedFlowId,
      owner_id: ownerId,
      source_node_id: connection.source,
      target_node_id: connection.target,
      condition_type: 'always' as ConditionType,
      condition_value: null,
      condition_variable: null,
      condition_expression: null,
      is_fallback: false,
      priority: dbEdges.length,
      label: null,
    }

    const { data, error } = await (supabase.from('flow_edges') as any)
      .insert(insert)
      .select('*')
      .single()

    if (error) throw error
    const edge = data as FlowEdge
    setDbEdges((prev) => [...prev, edge])
    setRfEdges((prev) => addEdge(toRFEdge(edge), prev))
  }, [dbEdges.length, ownerId, selectedFlowId, setRfEdges])

  const addNode = useCallback(async (nodeType: NodeType, position: XYPosition = { x: 160, y: 120 }) => {
    if (!ownerId || !selectedFlowId) return null

    const defaults = NODE_DEFAULTS[nodeType]
    const { data, error } = await (supabase.from('flow_nodes') as any)
      .insert({
        flow_id: selectedFlowId,
        owner_id: ownerId,
        node_type: nodeType,
        label: defaults.label,
        config: defaults.config,
        position_x: position.x,
        position_y: position.y,
      })
      .select('*')
      .single()

    if (error) throw error
    const node = data as FlowNode
    setDbNodes((prev) => [...prev, node])
    setRfNodes((prev) => [...prev, toRFNode(node)])

    if (nodeType === 'start') {
      const flow = flows.find((f) => f.id === selectedFlowId)
      if (flow && !flow.entry_node_id) {
        await (supabase.from('flows') as any)
          .update({ entry_node_id: node.id })
          .eq('id', selectedFlowId)
        setFlows((prev) => prev.map((f) => f.id === selectedFlowId ? { ...f, entry_node_id: node.id } : f))
      }
    }

    return node
  }, [flows, ownerId, selectedFlowId, setRfNodes])

  const updateNodeConfig = useCallback(async (
    nodeId: string,
    params: Partial<Pick<FlowNode, 'label' | 'config'>>,
  ) => {
    const { error } = await (supabase.from('flow_nodes') as any)
      .update(params)
      .eq('id', nodeId)

    if (error) throw error

    setDbNodes((prev) => prev.map((node) => node.id === nodeId ? { ...node, ...params } : node))
    setRfNodes((prev) => prev.map((node) => {
      if (node.id !== nodeId) return node
      return {
        ...node,
        data: {
          ...node.data,
          label: params.label ?? node.data.label,
          config: params.config ?? node.data.config,
        },
      }
    }))
  }, [setRfNodes])

  const deleteNode = useCallback(async (nodeId: string) => {
    const nodeToDelete = dbNodes.find((node) => node.id === nodeId)
    const { error } = await (supabase.from('flow_nodes') as any)
      .delete()
      .eq('id', nodeId)

    if (error) throw error
    await deleteFlowNodeMedia(getUploadedStoragePaths(nodeToDelete?.config ?? {}))

    setDbNodes((prev) => prev.filter((node) => node.id !== nodeId))
    setDbEdges((prev) => prev.filter((edge) => edge.source_node_id !== nodeId && edge.target_node_id !== nodeId))
    setRfNodes((prev) => prev.filter((node) => node.id !== nodeId))
    setRfEdges((prev) => prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNodeId(null)
  }, [dbNodes, setRfEdges, setRfNodes])

  const updateEdge = useCallback(async (edgeId: string, params: Partial<FlowEdge>) => {
    const { error } = await (supabase.from('flow_edges') as any)
      .update(params)
      .eq('id', edgeId)

    if (error) throw error

    setDbEdges((prev) => prev.map((edge) => edge.id === edgeId ? { ...edge, ...params } : edge))
    setRfEdges((prev) => prev.map((edge) => {
      if (edge.id !== edgeId) return edge
      const dbEdge = dbEdges.find((candidate) => candidate.id === edgeId)
      return dbEdge ? toRFEdge({ ...dbEdge, ...params }) : edge
    }))
  }, [dbEdges, setRfEdges])

  const deleteEdge = useCallback(async (edgeId: string) => {
    const { error } = await (supabase.from('flow_edges') as any)
      .delete()
      .eq('id', edgeId)

    if (error) throw error

    setDbEdges((prev) => prev.filter((edge) => edge.id !== edgeId))
    setRfEdges((prev) => prev.filter((edge) => edge.id !== edgeId))
    setSelectedEdgeId(null)
  }, [setRfEdges])

  const createFlow = useCallback(async (name: string) => {
    if (!ownerId) return null

    const { data, error } = await (supabase.from('flows') as any)
      .insert({
        owner_id: ownerId,
        name,
        description: null,
        status: 'draft',
        version: 1,
        entry_node_id: null,
      })
      .select('*')
      .single()

    if (error) throw error
    const flow = data as Flow
    setFlows((prev) => [flow, ...prev])
    await selectFlow(flow.id)
    return flow
  }, [ownerId, selectFlow])

  const renameFlow = useCallback(async (flowId: string, name: string) => {
    const { error } = await (supabase.from('flows') as any)
      .update({ name })
      .eq('id', flowId)

    if (error) throw error
    setFlows((prev) => prev.map((flow) => flow.id === flowId ? { ...flow, name } : flow))
  }, [])

  const deleteFlow = useCallback(async (flowId: string) => {
    const knownMediaPaths = selectedFlowId === flowId
      ? dbNodes.flatMap((node) => getUploadedStoragePaths(node.config ?? {}))
      : []
    const { error } = await (supabase.from('flows') as any)
      .delete()
      .eq('id', flowId)

    if (error) throw error
    await deleteFlowNodeMedia(knownMediaPaths)
    await deleteFlowMediaPrefix(ownerId, flowId)
    setFlows((prev) => prev.filter((flow) => flow.id !== flowId))
    if (selectedFlowId === flowId) clearFlowState()
  }, [clearFlowState, dbNodes, ownerId, selectedFlowId])

  const publishFlow = useCallback(async (flowId: string) => {
    const startNode = dbNodes.find((node) => node.node_type === 'start')
    const { error } = await (supabase.from('flows') as any)
      .update({ status: 'published', entry_node_id: startNode?.id ?? null })
      .eq('id', flowId)

    if (error) throw error
    const { error: triggerError } = await (supabase.from('flow_triggers') as any)
      .update({ is_active: true })
      .eq('flow_id', flowId)

    if (triggerError) throw triggerError
    setFlows((prev) => prev.map((flow) => flow.id === flowId
      ? { ...flow, status: 'published', entry_node_id: startNode?.id ?? flow.entry_node_id }
      : flow))
    setTriggers((prev) => prev.map((trigger) => trigger.flow_id === flowId ? { ...trigger, is_active: true } : trigger))
  }, [dbNodes])

  const unpublishFlow = useCallback(async (flowId: string) => {
    const { error } = await (supabase.from('flows') as any)
      .update({ status: 'draft' })
      .eq('id', flowId)

    if (error) throw error
    const { error: triggerError } = await (supabase.from('flow_triggers') as any)
      .update({ is_active: false })
      .eq('flow_id', flowId)

    if (triggerError) throw triggerError
    const { error: sessionError } = await (supabase.from('flow_sessions') as any)
      .update({ status: 'expired' })
      .eq('flow_id', flowId)
      .eq('status', 'active')

    if (sessionError) throw sessionError
    setFlows((prev) => prev.map((flow) => flow.id === flowId ? { ...flow, status: 'draft' } : flow))
    setTriggers((prev) => prev.map((trigger) => trigger.flow_id === flowId ? { ...trigger, is_active: false } : trigger))
  }, [])

  const addTrigger = useCallback(async (trigger: Omit<FlowTrigger, 'id' | 'owner_id' | 'created_at'>) => {
    if (!ownerId) return

    const { data, error } = await (supabase.from('flow_triggers') as any)
      .insert({ ...trigger, owner_id: ownerId })
      .select('*')
      .single()

    if (error) throw error
    setTriggers((prev) => [...prev, data as FlowTrigger])
  }, [ownerId])

  const removeTrigger = useCallback(async (id: string) => {
    const { error } = await (supabase.from('flow_triggers') as any)
      .delete()
      .eq('id', id)

    if (error) throw error
    setTriggers((prev) => prev.filter((trigger) => trigger.id !== id))
  }, [])

  const updateTrigger = useCallback(async (id: string, params: Partial<FlowTrigger>) => {
    const { error } = await (supabase.from('flow_triggers') as any)
      .update(params)
      .eq('id', id)

    if (error) throw error
    setTriggers((prev) => prev.map((trigger) => trigger.id === id ? { ...trigger, ...params } : trigger))
  }, [])

  const getFlowNode = useCallback((id: string) => dbNodes.find((node) => node.id === id), [dbNodes])
  const getFlowEdge = useCallback((id: string) => dbEdges.find((edge) => edge.id === id), [dbEdges])

  const applyFlowTemplate = useCallback(async (templateId: string, templateVersion: number, flowName?: string | null) => {
    if (!ownerId) return null

    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`

    setTemplateApplying(true)
    setTemplateError(null)
    await trackTemplateEvent(ownerId, 'flow_template_apply_started', { templateId, templateVersion, requestId })

    try {
      const result = await applyFlowTemplateService({
        templateId,
        templateVersion,
        requestId,
        flowName,
      })

      const flow = result.flow as Flow
      const nodes = result.nodes as FlowNode[]
      const edges = result.edges as FlowEdge[]
      const nextTriggers = result.triggers as FlowTrigger[]

      setFlows((prev) => [flow, ...prev.filter((candidate) => candidate.id !== flow.id)])
      setSelectedFlowId(flow.id)
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setDbNodes(nodes)
      setDbEdges(edges)
      setTriggers(nextTriggers)
      setRfNodes(nodes.map(toRFNode))
      setRfEdges(edges.map(toRFEdge))

      await trackTemplateEvent(ownerId, result.replayed ? 'flow_template_apply_replayed' : 'flow_template_apply_succeeded', {
        templateId,
        templateVersion,
        requestId,
        flowId: flow.id,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        triggerCount: nextTriggers.length,
      })

      return flow
    } catch (error: any) {
      const message = error?.message ?? 'Template could not be applied'
      setTemplateError(message)
      await trackTemplateEvent(ownerId, 'flow_template_apply_failed', {
        templateId,
        templateVersion,
        requestId,
        code: error?.code ?? 'UNKNOWN',
        message,
      })
      throw error
    } finally {
      setTemplateApplying(false)
    }
  }, [ownerId, setRfEdges, setRfNodes])

  return {
    flows,
    selectedFlowId,
    setSelectedFlowId,
    dbNodes,
    dbEdges,
    triggers,
    rfNodes,
    rfEdges,
    selectedNodeId,
    selectedEdgeId,
    templateApplying,
    templateError,
    setSelectedNodeId,
    setSelectedEdgeId,
    loading,
    loadFlows,
    selectFlow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeConfig,
    deleteNode,
    updateEdge,
    deleteEdge,
    createFlow,
    renameFlow,
    deleteFlow,
    publishFlow,
    unpublishFlow,
    addTrigger,
    removeTrigger,
    updateTrigger,
    applyFlowTemplate,
    getFlowNode,
    getFlowEdge,
  }
}
