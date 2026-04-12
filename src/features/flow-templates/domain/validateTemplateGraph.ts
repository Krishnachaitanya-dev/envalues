import type { FlowTemplate, TemplateEdge, TemplateNode } from './template.types'
import { normalizeTemplateTrigger } from './normalizeTrigger'
import { flowTemplateSchema } from './template.schemas'

const RESERVED_TRIGGERS = new Set(['stop', 'unsubscribe'])

export function validateTemplateGraph(template: FlowTemplate): string[] {
  const issues: string[] = []
  const parsed = flowTemplateSchema.safeParse(template)

  if (!parsed.success) {
    issues.push(...parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`))
    return issues
  }

  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const triggerKeys = new Set<string>()
  const starts = template.nodes.filter(node => node.type === 'start')

  if (starts.length !== 1) issues.push(`Template must have exactly one start node; found ${starts.length}`)

  for (const node of template.nodes) {
    if (nodeIds.has(node.id)) issues.push(`Duplicate node id: ${node.id}`)
    nodeIds.add(node.id)
  }

  for (const edge of template.edges) {
    if (edgeIds.has(edge.id)) issues.push(`Duplicate edge id: ${edge.id}`)
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.source)) issues.push(`Edge ${edge.id} references missing source ${edge.source}`)
    if (!nodeIds.has(edge.target)) issues.push(`Edge ${edge.id} references missing target ${edge.target}`)
    if (edge.source === edge.target && !edge.condition.allowedCycle) issues.push(`Edge ${edge.id} is an unmarked self-cycle`)
  }

  for (const trigger of template.triggers) {
    const normalized = normalizeTemplateTrigger(trigger.value)
    if (trigger.type !== 'default' && !normalized) issues.push(`Trigger ${trigger.id} is empty`)
    if (RESERVED_TRIGGERS.has(normalized)) issues.push(`Trigger ${trigger.id} uses reserved keyword ${normalized}`)
    const key = `${trigger.type}:${normalized}`
    if (trigger.type !== 'default' && triggerKeys.has(key)) issues.push(`Duplicate trigger ${key}`)
    triggerKeys.add(key)
  }

  const start = starts[0]
  if (start) {
    const reachable = findReachableNodeIds(start.id, template.edges)
    for (const node of template.nodes) {
      if (!reachable.has(node.id)) issues.push(`Node ${node.id} is not reachable from start`)
    }
    const terminals = template.nodes.filter(node => node.type === 'end' || node.type === 'handoff')
    if (!terminals.some(node => reachable.has(node.id))) {
      issues.push('Template must have at least one reachable end or handoff node')
    }
  }

  issues.push(...findDisallowedCycles(template.nodes, template.edges))
  return issues
}

export function assertValidTemplate(template: FlowTemplate) {
  const issues = validateTemplateGraph(template)
  if (issues.length > 0) {
    throw new Error(`Invalid flow template ${template.id}@${template.version}: ${issues.join('; ')}`)
  }
  return template
}

function findReachableNodeIds(startId: string, edges: TemplateEdge[]) {
  const reachable = new Set<string>([startId])
  const queue = [startId]

  while (queue.length > 0) {
    const source = queue.shift()!
    for (const edge of edges.filter(candidate => candidate.source === source)) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target)
        queue.push(edge.target)
      }
    }
  }

  return reachable
}

function findDisallowedCycles(nodes: TemplateNode[], edges: TemplateEdge[]) {
  const issues: string[] = []
  const nodeIds = new Set(nodes.map(node => node.id))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(nodeId: string, path: string[]) {
    if (visiting.has(nodeId)) {
      const cycle = [...path.slice(path.indexOf(nodeId)), nodeId]
      const allowed = cycleEdges(cycle, edges).every(edge => edge.condition.allowedCycle)
      if (!allowed) issues.push(`Disallowed cycle detected: ${cycle.join(' -> ')}`)
      return
    }
    if (visited.has(nodeId) || !nodeIds.has(nodeId)) return

    visiting.add(nodeId)
    for (const edge of edges.filter(candidate => candidate.source === nodeId)) {
      visit(edge.target, [...path, edge.target])
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  for (const nodeId of nodeIds) visit(nodeId, [nodeId])
  return [...new Set(issues)]
}

function cycleEdges(cycle: string[], edges: TemplateEdge[]) {
  const found: TemplateEdge[] = []
  for (let index = 0; index < cycle.length - 1; index += 1) {
    const edge = edges.find(candidate => candidate.source === cycle[index] && candidate.target === cycle[index + 1])
    if (edge) found.push(edge)
  }
  return found
}
