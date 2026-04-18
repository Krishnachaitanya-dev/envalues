import type {
  FlowNode, FlowEdge, FlowTrigger,
  MessageConfig, InputConfig,
} from '@/integrations/supabase/flow-types'
import type {
  SimpleFlow, SimpleStep, SimpleButton, SimpleMedia, SimpleTrigger,
} from '@/types/simpleFlow'
import { isYouTubeUrl } from '@/types/simpleFlow'

// ─── Graph → Simple ──────────────────────────────────────────────────────────

function attachmentsFromConfig(cfg: MessageConfig): SimpleMedia[] {
  const raw = Array.isArray(cfg.attachments) ? cfg.attachments : []
  return raw
    .filter(a => typeof a?.url === 'string' && a.url.trim())
    .map<SimpleMedia>(a => {
      const isYouTube = a.type === 'video' && a.source === 'url' && isYouTubeUrl(a.url)
      return {
        id: a.id ?? crypto.randomUUID(),
        type: isYouTube ? 'youtube' : (a.type as SimpleMedia['type']),
        url: a.url,
        caption: a.caption,
        storage_path: a.storage_path,
        source: a.source ?? (a.storage_path ? 'upload' : 'url'),
      }
    })
}

export function graphToSimple(
  flow: { id: string; name: string; status: 'draft' | 'published' | 'archived' },
  nodes: FlowNode[],
  edges: FlowEdge[],
  triggers: FlowTrigger[],
): SimpleFlow {
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
  const edgesBySource: Record<string, FlowEdge[]> = {}
  for (const e of edges) {
    if (!edgesBySource[e.source_node_id]) edgesBySource[e.source_node_id] = []
    edgesBySource[e.source_node_id].push(e)
  }

  const startNode = nodes.find(n => n.node_type === 'start')
  const orderedSteps: SimpleStep[] = []
  const visited = new Set<string>()
  const positions: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) positions[n.id] = { x: n.position_x, y: n.position_y }

  function pushStep(step: SimpleStep, fallbackPos: { x: number; y: number }) {
    const pos = positions[step.id]
    orderedSteps.push({
      ...step,
      position: pos && (pos.x || pos.y) ? pos : fallbackPos,
    })
  }

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !['message', 'input'].includes(node.node_type)) return
    visited.add(nodeId)

    const outEdges = edgesBySource[nodeId] ?? []
    const alwaysEdge = outEdges.find(e => e.condition_type === 'always' && !e.is_fallback)
    const conditionalEdges = outEdges.filter(e => e.condition_type === 'equals')
    const fallbackPos = { x: 200, y: (orderedSteps.length + 1) * 150 }

    if (node.node_type === 'message') {
      const cfg = node.config as MessageConfig
      const buttons: SimpleButton[] = (cfg.buttons ?? []).map(b => {
        const matchEdge = conditionalEdges.find(e => norm(e.condition_value) === norm(b.title))
        const nextNode = matchEdge ? nodes.find(n => n.id === matchEdge.target_node_id) : null
        return {
          id: b.id,
          title: b.title,
          nextStepId: nextNode && ['message', 'input'].includes(nextNode.node_type) ? nextNode.id : null,
        }
      })
      const hasButtons = buttons.length > 0
      const nextViaAlways = alwaysEdge ? nodes.find(n => n.id === alwaysEdge.target_node_id) : null
      pushStep({
        id: node.id,
        type: hasButtons ? 'question' : 'message',
        mode: hasButtons ? 'button_choices' : undefined,
        text: cfg.text ?? '',
        attachments: attachmentsFromConfig(cfg),
        buttons: hasButtons ? buttons : undefined,
        nextStepId: !hasButtons
          ? (nextViaAlways && ['message', 'input'].includes(nextViaAlways.node_type) ? nextViaAlways.id : null)
          : undefined,
      }, fallbackPos)
      if (!hasButtons && alwaysEdge) walk(alwaysEdge.target_node_id)
      if (hasButtons) buttons.forEach(b => { if (b.nextStepId) walk(b.nextStepId) })
    }

    if (node.node_type === 'input') {
      const cfg = node.config as InputConfig
      const nextViaAlways = alwaysEdge ? nodes.find(n => n.id === alwaysEdge.target_node_id) : null
      pushStep({
        id: node.id,
        type: 'question',
        mode: 'open_text',
        text: cfg.prompt ?? '',
        nextStepId: nextViaAlways && ['message', 'input'].includes(nextViaAlways.node_type) ? nextViaAlways.id : null,
      }, fallbackPos)
      if (alwaysEdge) walk(alwaysEdge.target_node_id)
    }
  }

  // Walk from start, then from any trigger target, then any unreached visible node
  if (startNode) {
    const firstEdge = (edgesBySource[startNode.id] ?? []).find(e => e.condition_type === 'always')
    if (firstEdge) walk(firstEdge.target_node_id)
  }
  for (const t of triggers) {
    if (t.target_node_id) walk(t.target_node_id)
  }
  const remaining = nodes
    .filter(n => ['message', 'input'].includes(n.node_type) && !visited.has(n.id))
    .sort((a, b) => a.position_y - b.position_y)
  for (const n of remaining) walk(n.id)

  // Collapse triggers by target_node_id (each group = one SimpleTrigger)
  const keywordTriggers = triggers.filter(t => t.trigger_type === 'keyword' && t.trigger_value)
  const byTarget: Record<string, SimpleTrigger> = {}
  for (const t of keywordTriggers) {
    const key = t.target_node_id ?? '__entry__'
    if (!byTarget[key]) {
      byTarget[key] = {
        id: crypto.randomUUID(),
        keywords: [],
        targetStepId: t.target_node_id ?? (orderedSteps[0]?.id ?? null),
      }
    }
    const kw = (t.trigger_value ?? '').trim()
    if (kw && !byTarget[key].keywords.includes(kw)) byTarget[key].keywords.push(kw)
  }
  const simpleTriggers = Object.values(byTarget)

  return { id: flow.id, name: flow.name, status: flow.status, steps: orderedSteps, triggers: simpleTriggers }
}

// ─── Simple → Graph ──────────────────────────────────────────────────────────

export interface GraphTriggerOutput {
  id?: string
  owner_id: string
  flow_id: string
  trigger_type: 'keyword'
  trigger_value: string
  // Some deployments make this column generated/identity. Do not send on insert.
  normalized_trigger_value?: string
  target_node_id: string | null
  priority: number
  is_active: boolean
}

export interface GraphOutput {
  nodes: Omit<FlowNode, 'created_at' | 'updated_at'>[]
  edges: Omit<FlowEdge, 'created_at'>[]
  triggers: GraphTriggerOutput[]
}

function attachmentToConfig(media: SimpleMedia): NonNullable<MessageConfig['attachments']>[number] {
  if (media.type === 'youtube') {
    return {
      id: media.id,
      type: 'video',
      url: media.url,
      source: 'url',
      caption: media.caption,
    }
  }
  return {
    id: media.id,
    type: media.type,
    url: media.url,
    source: media.source,
    caption: media.caption,
    storage_path: media.storage_path,
  }
}

export function simpleToGraph(
  simple: SimpleFlow,
  ownerId: string,
  existingNodes: FlowNode[],
): GraphOutput {
  const nodes: Omit<FlowNode, 'created_at' | 'updated_at'>[] = []
  const edges: Omit<FlowEdge, 'created_at'>[] = []
  const triggersOut: GraphTriggerOutput[] = []
  const flowId = simple.id

  const startId = existingNodes.find(n => n.node_type === 'start')?.id ?? crypto.randomUUID()
  nodes.push({ id: startId, flow_id: flowId, owner_id: ownerId, node_type: 'start', label: 'Start', config: {}, position_x: 0, position_y: 0 })

  const endId = existingNodes.find(n => n.node_type === 'end')?.id ?? crypto.randomUUID()
  const needsEnd = simple.steps.some(s =>
    s.nextStepId === null || s.nextStepId === undefined ||
    s.buttons?.some(b => b.nextStepId === null)
  )
  if (needsEnd) {
    nodes.push({ id: endId, flow_id: flowId, owner_id: ownerId, node_type: 'end', label: 'End', config: {}, position_x: 700, position_y: 80 })
  }

  for (let i = 0; i < simple.steps.length; i++) {
    const step = simple.steps[i]
    const px = step.position?.x ?? 200
    const py = step.position?.y ?? ((i + 1) * 150)
    if (step.mode === 'open_text') {
      const varKey = `simple_answer_${step.id.replace(/-/g, '').slice(0, 12)}`
      nodes.push({
        id: step.id, flow_id: flowId, owner_id: ownerId, node_type: 'input',
        label: step.text.slice(0, 40) || 'Question',
        config: { prompt: step.text, variable: varKey } as Record<string, unknown>,
        position_x: px, position_y: py,
      })
    } else {
      const cfg: MessageConfig = {
        text: step.text || undefined,
        attachments: (step.attachments ?? []).map(attachmentToConfig),
        buttons: step.buttons?.map(b => ({ id: b.id, title: b.title })),
      }
      nodes.push({
        id: step.id, flow_id: flowId, owner_id: ownerId, node_type: 'message',
        label: step.text.slice(0, 40) || 'Message',
        config: cfg as Record<string, unknown>,
        position_x: px, position_y: py,
      })
    }
  }

  const mkEdge = (src: string, tgt: string, cond: 'always' | 'equals', val?: string, pri = 0): Omit<FlowEdge, 'created_at'> => ({
    id: crypto.randomUUID(), flow_id: flowId, owner_id: ownerId,
    source_node_id: src, target_node_id: tgt,
    condition_type: cond, condition_value: val ?? null,
    condition_variable: null, condition_expression: null,
    is_fallback: false, priority: pri, label: null,
  })

  // Default entry: first step (or fallback to endId if no steps)
  if (simple.steps.length > 0) {
    edges.push(mkEdge(startId, simple.steps[0].id, 'always'))
  }

  for (const step of simple.steps) {
    if (step.mode === 'button_choices' && step.buttons && step.buttons.length > 0) {
      step.buttons.forEach((btn, i) => edges.push(mkEdge(step.id, btn.nextStepId ?? endId, 'equals', btn.title, i)))
    } else {
      edges.push(mkEdge(step.id, step.nextStepId ?? endId, 'always'))
    }
  }

  // Emit multiple trigger rows: one per (trigger, keyword)
  let priority = 0
  for (const tr of simple.triggers) {
    const target = tr.targetStepId && simple.steps.some(s => s.id === tr.targetStepId)
      ? tr.targetStepId
      : null
    for (const kw of tr.keywords) {
      const trimmed = kw.trim()
      if (!trimmed) continue
      triggersOut.push({
        owner_id: ownerId,
        flow_id: flowId,
        trigger_type: 'keyword',
        trigger_value: trimmed,
        target_node_id: target,
        priority: priority++,
        is_active: true,
      })
    }
  }

  return { nodes, edges, triggers: triggersOut }
}
