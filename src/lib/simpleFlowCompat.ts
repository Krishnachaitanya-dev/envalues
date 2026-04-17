import type { FlowNode, FlowEdge, FlowTrigger } from '@/integrations/supabase/flow-types'

const SIMPLE_NODE_TYPES = new Set(['start', 'end', 'message', 'input', 'jump'])
const SIMPLE_EDGE_CONDITIONS = new Set(['always', 'equals'])
const SIMPLE_TRIGGER_TYPES = new Set(['keyword'])

/**
 * Returns true if a flow uses only the subset of features
 * supported by the simple conversation builder.
 */
export function isSimpleCompatible(
  nodes: FlowNode[],
  edges: FlowEdge[],
  triggers: FlowTrigger[],
): boolean {
  // All nodes must be simple types
  if (nodes.some((n) => !SIMPLE_NODE_TYPES.has(n.node_type))) return false

  // All edges must use simple condition types
  if (edges.some((e) => !SIMPLE_EDGE_CONDITIONS.has(e.condition_type))) return false

  // All triggers must be keyword triggers
  if (triggers.some((t) => !SIMPLE_TRIGGER_TYPES.has(t.trigger_type))) return false

  return true
}
