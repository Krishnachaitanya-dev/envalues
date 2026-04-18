import { describe, it, expect } from 'vitest'
import { evaluateEdges, matchesEdge } from '../../../supabase/functions/whatsapp-webhook/engine/edge-evaluator'
import type { FlowEdge, FlowSession } from '../../../supabase/functions/whatsapp-webhook/engine/types'

function makeSession(context: Record<string, unknown> = {}): FlowSession {
  return {
    id: 's1', owner_id: 'o1', flow_id: 'f1',
    current_node_id: 'n1', phone: '911234567890',
    status: 'active', context, call_stack: [],
    step_count: 0, max_steps: 100,
    last_node_executed_at: null, last_message_at: new Date().toISOString(),
  }
}

function makeEdge(overrides: Partial<FlowEdge> = {}): FlowEdge {
  return {
    id: 'e1', flow_id: 'f1', owner_id: 'o1',
    source_node_id: 'n1', target_node_id: 'n2',
    condition_type: 'always', condition_value: null,
    condition_variable: null, condition_expression: null,
    is_fallback: false, priority: 0,
    ...overrides,
  }
}

describe('matchesEdge', () => {
  const session = makeSession({ 'user.plan': 'pro', count: 5 })

  it('always returns true for condition_type always', () => {
    expect(matchesEdge(makeEdge({ condition_type: 'always' }), session, 'anything')).toBe(true)
  })

  it('equals — exact match', () => {
    expect(matchesEdge(makeEdge({ condition_type: 'equals', condition_value: 'yes' }), session, 'yes')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'equals', condition_value: 'yes' }), session, 'no')).toBe(false)
    expect(matchesEdge(makeEdge({ condition_type: 'equals', condition_value: 'Buyer' }), session, ' buyer ')).toBe(true)
  })

  it('contains — substring match', () => {
    expect(matchesEdge(makeEdge({ condition_type: 'contains', condition_value: 'ice' }), session, 'i want ice cream')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'contains', condition_value: 'Ice' }), session, 'I WANT ICE CREAM')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'contains', condition_value: 'ice' }), session, 'coffee')).toBe(false)
  })

  it('starts_with — prefix match', () => {
    expect(matchesEdge(makeEdge({ condition_type: 'starts_with', condition_value: 'order' }), session, 'order 123')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'starts_with', condition_value: 'Order' }), session, ' order 123')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'starts_with', condition_value: 'order' }), session, 'my order')).toBe(false)
  })

  it('regex — pattern match', () => {
    expect(matchesEdge(makeEdge({ condition_type: 'regex', condition_value: '^\\d{10}$' }), session, '9876543210')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'regex', condition_value: '^\\d{10}$' }), session, 'abc')).toBe(false)
  })

  it('variable_equals — context value match', () => {
    expect(matchesEdge(makeEdge({ condition_type: 'variable_equals', condition_variable: 'user.plan', condition_value: 'pro' }), session, '')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'variable_equals', condition_variable: 'user.plan', condition_value: 'free' }), session, '')).toBe(false)
  })

  it('variable_contains — context substring match', () => {
    expect(matchesEdge(makeEdge({ condition_type: 'variable_contains', condition_variable: 'user.plan', condition_value: 'ro' }), session, '')).toBe(true)
    expect(matchesEdge(makeEdge({ condition_type: 'variable_contains', condition_variable: 'user.plan', condition_value: 'free' }), session, '')).toBe(false)
  })

  it('variable_contains — returns false when condition_value is null', () => {
    const edge = makeEdge({ condition_type: 'variable_contains', condition_variable: 'user.plan', condition_value: null })
    expect(matchesEdge(edge, makeSession({ 'user.plan': 'pro' }), '')).toBe(false)
  })

  it('unknown condition_type returns false', () => {
    // @ts-expect-error testing invalid type
    expect(matchesEdge(makeEdge({ condition_type: 'unknown' }), session, 'hi')).toBe(false)
  })

  it('condition_expression — returns false when no evalExpression injected', () => {
    const edge = makeEdge({ condition_expression: "input == 'yes'" })
    expect(matchesEdge(edge, makeSession(), 'yes')).toBe(false)
  })

  it('condition_expression — calls evalExpression when provided and returns its result', () => {
    const edge = makeEdge({ condition_expression: "input == 'yes'" })
    const evalExpr = (_expr: string, ctx: { input: string; context: Record<string, unknown> }) => ctx.input === 'yes'
    expect(matchesEdge(edge, makeSession(), 'yes', evalExpr)).toBe(true)
    expect(matchesEdge(edge, makeSession(), 'no', evalExpr)).toBe(false)
  })

  it('condition_expression — returns false when evalExpression throws', () => {
    const edge = makeEdge({ condition_expression: 'bad expression' })
    const evalExpr = () => { throw new Error('parse error') }
    expect(matchesEdge(edge, makeSession(), 'hi', evalExpr)).toBe(false)
  })
})

describe('evaluateEdges', () => {
  const session = makeSession()

  it('returns first matching non-fallback edge sorted by priority', () => {
    const edges: FlowEdge[] = [
      makeEdge({ id: 'e1', target_node_id: 'n_a', condition_type: 'equals', condition_value: 'yes', priority: 0 }),
      makeEdge({ id: 'e2', target_node_id: 'n_b', condition_type: 'equals', condition_value: 'yes', priority: 1 }),
    ]
    expect(evaluateEdges(edges, session, 'yes')).toBe('n_a')
  })

  it('returns fallback when no non-fallback edge matches', () => {
    const edges: FlowEdge[] = [
      makeEdge({ id: 'e1', target_node_id: 'n_match', condition_type: 'equals', condition_value: 'yes', is_fallback: false, priority: 0 }),
      makeEdge({ id: 'e2', target_node_id: 'n_fallback', condition_type: 'always', is_fallback: true, priority: 0 }),
    ]
    expect(evaluateEdges(edges, session, 'no')).toBe('n_fallback')
  })

  it('returns null when no edges match and no fallback', () => {
    const edges: FlowEdge[] = [
      makeEdge({ id: 'e1', target_node_id: 'n_a', condition_type: 'equals', condition_value: 'yes', is_fallback: false, priority: 0 }),
    ]
    expect(evaluateEdges(edges, session, 'no')).toBeNull()
  })

  it('returns null for empty edges array', () => {
    expect(evaluateEdges([], session, 'hi')).toBeNull()
  })

  it('non-fallback edges take priority over fallback even when fallback listed first', () => {
    const edges: FlowEdge[] = [
      makeEdge({ id: 'e_fb', target_node_id: 'n_fallback', condition_type: 'always', is_fallback: true }),
      makeEdge({ id: 'e_m', target_node_id: 'n_match', condition_type: 'equals', condition_value: 'yes', is_fallback: false, priority: 0 }),
    ]
    expect(evaluateEdges(edges, session, 'yes')).toBe('n_match')
  })
})
