import type {
  FlowNode, FlowEdge, FlowTrigger,
  MessageConfig, InputConfig,
} from '@/integrations/supabase/flow-types'
import type { SimpleFlow, SimpleStep, SimpleButton } from '@/types/simpleFlow'

// ─── Graph → Simple ──────────────────────────────────────────────────────────

export function graphToSimple(
  flow: { id: string; name: string; status: 'draft' | 'published' | 'archived' },
  nodes: FlowNode[],
  edges: FlowEdge[],
  triggers: FlowTrigger[],
): SimpleFlow {
  const keywords = triggers
    .filter(t => t.trigger_type === 'keyword' && t.trigger_value)
    .map(t => t.trigger_value as string)

  const edgesBySource: Record<string, FlowEdge[]> = {}
  for (const e of edges) {
    if (!edgesBySource[e.source_node_id]) edgesBySource[e.source_node_id] = []
    edgesBySource[e.source_node_id].push(e)
  }

  const startNode = nodes.find(n => n.node_type === 'start')
  const orderedSteps: SimpleStep[] = []
  const visited = new Set<string>()

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !['message', 'input'].includes(node.node_type)) return
    visited.add(nodeId)

    const outEdges = edgesBySource[nodeId] ?? []
    const alwaysEdge = outEdges.find(e => e.condition_type === 'always' && !e.is_fallback)
    const conditionalEdges = outEdges.filter(e => e.condition_type === 'equals')

    if (node.node_type === 'message') {
      const cfg = node.config as MessageConfig
      const buttons: SimpleButton[] = (cfg.buttons ?? []).map(b => {
        const matchEdge = conditionalEdges.find(e => e.condition_value === b.title)
        const nextNode = matchEdge ? nodes.find(n => n.id === matchEdge.target_node_id) : null
        return {
          id: b.id,
          title: b.title,
          nextStepId: nextNode && ['message', 'input'].includes(nextNode.node_type) ? nextNode.id : null,
        }
      })
      const hasButtons = buttons.length > 0
      const nextViaAlways = alwaysEdge ? nodes.find(n => n.id === alwaysEdge.target_node_id) : null
      orderedSteps.push({
        id: node.id,
        type: hasButtons ? 'question' : 'message',
        mode: hasButtons ? 'button_choices' : undefined,
        text: cfg.text ?? '',
        media: cfg.attachments?.[0]
          ? { type: cfg.attachments[0].type, url: cfg.attachments[0].url, caption: cfg.attachments[0].caption }
          : undefined,
        buttons: hasButtons ? buttons : undefined,
        nextStepId: !hasButtons
          ? (nextViaAlways && ['message', 'input'].includes(nextViaAlways.node_type) ? nextViaAlways.id : null)
          : undefined,
      })
      if (!hasButtons && alwaysEdge) walk(alwaysEdge.target_node_id)
      if (hasButtons) buttons.forEach(b => { if (b.nextStepId) walk(b.nextStepId) })
    }

    if (node.node_type === 'input') {
      const cfg = node.config as InputConfig
      const nextViaAlways = alwaysEdge ? nodes.find(n => n.id === alwaysEdge.target_node_id) : null
      orderedSteps.push({
        id: node.id,
        type: 'question',
        mode: 'open_text',
        text: cfg.prompt ?? '',
        nextStepId: nextViaAlways && ['message', 'input'].includes(nextViaAlways.node_type) ? nextViaAlways.id : null,
      })
      if (alwaysEdge) walk(alwaysEdge.target_node_id)
    }
  }

  if (startNode) {
    const firstEdge = (edgesBySource[startNode.id] ?? []).find(e => e.condition_type === 'always')
    if (firstEdge) walk(firstEdge.target_node_id)
  } else {
    const visibles = nodes
      .filter(n => ['message', 'input'].includes(n.node_type))
      .sort((a, b) => a.position_y - b.position_y)
    visibles.forEach(n => walk(n.id))
  }

  return { id: flow.id, name: flow.name, status: flow.status, steps: orderedSteps, keywords }
}

// ─── Simple → Graph ──────────────────────────────────────────────────────────

export interface GraphOutput {
  nodes: Omit<FlowNode, 'created_at' | 'updated_at'>[]
  edges: Omit<FlowEdge, 'created_at'>[]
}

export function simpleToGraph(
  simple: SimpleFlow,
  ownerId: string,
  existingNodes: FlowNode[],
): GraphOutput {
  const nodes: Omit<FlowNode, 'created_at' | 'updated_at'>[] = []
  const edges: Omit<FlowEdge, 'created_at'>[] = []
  const flowId = simple.id

  const startId = existingNodes.find(n => n.node_type === 'start')?.id ?? crypto.randomUUID()
  nodes.push({ id: startId, flow_id: flowId, owner_id: ownerId, node_type: 'start', label: 'Start', config: {}, position_x: 0, position_y: 0 })

  const SPACING = 150
  const endId = existingNodes.find(n => n.node_type === 'end')?.id ?? crypto.randomUUID()
  const needsEnd = simple.steps.some(s =>
    s.nextStepId === null || s.nextStepId === undefined ||
    s.buttons?.some(b => b.nextStepId === null)
  )
  if (needsEnd) {
    nodes.push({ id: endId, flow_id: flowId, owner_id: ownerId, node_type: 'end', label: 'End', config: {}, position_x: 200, position_y: (simple.steps.length + 1) * SPACING })
  }

  for (let i = 0; i < simple.steps.length; i++) {
    const step = simple.steps[i]
    const py = (i + 1) * SPACING
    if (step.mode === 'open_text') {
      const varKey = `simple_answer_${step.id.replace(/-/g, '').slice(0, 12)}`
      nodes.push({ id: step.id, flow_id: flowId, owner_id: ownerId, node_type: 'input', label: step.text.slice(0, 40) || 'Question', config: { prompt: step.text, variable: varKey } as Record<string, unknown>, position_x: 200, position_y: py })
    } else {
      const cfg: MessageConfig = {
        text: step.text || undefined,
        attachments: step.media ? [{ type: step.media.type, url: step.media.url, caption: step.media.caption }] : [],
        buttons: step.buttons?.map(b => ({ id: b.id, title: b.title })),
      }
      nodes.push({ id: step.id, flow_id: flowId, owner_id: ownerId, node_type: 'message', label: step.text.slice(0, 40) || 'Message', config: cfg as Record<string, unknown>, position_x: 200, position_y: py })
    }
  }

  const mkEdge = (src: string, tgt: string, cond: 'always' | 'equals', val?: string, pri = 0): Omit<FlowEdge, 'created_at'> => ({
    id: crypto.randomUUID(), flow_id: flowId, owner_id: ownerId,
    source_node_id: src, target_node_id: tgt,
    condition_type: cond, condition_value: val ?? null,
    condition_variable: null, condition_expression: null,
    is_fallback: false, priority: pri, label: null,
  })

  if (simple.steps.length > 0) edges.push(mkEdge(startId, simple.steps[0].id, 'always'))

  for (const step of simple.steps) {
    if (step.mode === 'button_choices' && step.buttons) {
      step.buttons.forEach((btn, i) => edges.push(mkEdge(step.id, btn.nextStepId ?? endId, 'equals', btn.title, i)))
    } else {
      edges.push(mkEdge(step.id, step.nextStepId ?? endId, 'always'))
    }
  }

  return { nodes, edges }
}
