import type { FlowEdge, FlowSession } from './types.ts'

/**
 * Evaluate a single edge condition against inbound text + session context.
 * condition_expression is evaluated if an evalExpression function is provided;
 * otherwise it is skipped (returns false). No eval() is used.
 */
export function matchesEdge(
  edge: FlowEdge,
  session: FlowSession,
  inbound: string,
  evalExpression?: (expr: string, ctx: { input: string; context: Record<string, unknown> }) => boolean,
): boolean {
  if (edge.condition_expression) {
    if (!evalExpression) return false
    try {
      return evalExpression(edge.condition_expression, { input: inbound, context: session.context })
    } catch {
      return false
    }
  }

  switch (edge.condition_type) {
    case 'always':
      return true
    case 'equals':
      return inbound === (edge.condition_value ?? '')
    case 'contains': {
      const val = edge.condition_value
      return val !== null && val !== '' && inbound.includes(val)
    }
    case 'starts_with': {
      const val = edge.condition_value
      return val !== null && val !== '' && inbound.startsWith(val)
    }
    case 'regex': {
      const val = edge.condition_value
      if (!val) return false
      try { return new RegExp(val).test(inbound) }
      catch { return false }
    }
    case 'variable_equals':
      return String(session.context[edge.condition_variable ?? ''] ?? '') === (edge.condition_value ?? '')
    case 'variable_contains':
      return String(session.context[edge.condition_variable ?? ''] ?? '').includes(edge.condition_value ?? '')
    default:
      return false
  }
}

/**
 * Pick the target node id from a list of edges.
 * - Non-fallback edges are sorted by priority (ascending) and evaluated first.
 * - The fallback edge is used only if no non-fallback edge matched.
 * - Fallback edge condition_type and condition_value are ignored — it fires unconditionally if no non-fallback edge matched.
 * - Returns null if nothing matches.
 */
export function evaluateEdges(
  edges: FlowEdge[],
  session: FlowSession,
  inbound: string,
  evalExpression?: (expr: string, ctx: { input: string; context: Record<string, unknown> }) => boolean,
): string | null {
  const nonFallback = edges
    .filter(e => !e.is_fallback)
    .sort((a, b) => a.priority - b.priority)
  const fallback = edges.find(e => e.is_fallback)

  for (const edge of nonFallback) {
    if (matchesEdge(edge, session, inbound, evalExpression)) {
      return edge.target_node_id
    }
  }

  return fallback ? fallback.target_node_id : null
}
