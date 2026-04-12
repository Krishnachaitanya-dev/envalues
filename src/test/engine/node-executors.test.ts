// src/test/engine/node-executors.test.ts
import { describe, it, expect } from 'vitest'
import {
  executeMessageNode,
  executeStartNode,
  executeEndNode,
  executeInputNode,
  executeConditionNode,
  executeDelayNode,
  executeJumpNode,
  executeSubflowNode,
  executeHandoffNode,
  executeApiNode,
} from '../../../supabase/functions/whatsapp-webhook/engine/node-executors'
import type { FlowNode, FlowSession, CallStackFrame } from '../../../supabase/functions/whatsapp-webhook/engine/types'

function makeSession(overrides: Partial<FlowSession> = {}): FlowSession {
  return {
    id: 's1', owner_id: 'o1', flow_id: 'f1',
    current_node_id: 'n1', phone: '911234567890',
    status: 'active', context: {}, call_stack: [],
    step_count: 0, max_steps: 100,
    last_node_executed_at: null, last_message_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeNode(node_type: FlowNode['node_type'], config: Record<string, unknown> = {}): FlowNode {
  return { id: 'n1', flow_id: 'f1', owner_id: 'o1', node_type, label: null, config }
}

// ── start ──────────────────────────────────────────────────────────────────────

describe('executeStartNode', () => {
  it('returns empty result — start node does nothing', () => {
    const result = executeStartNode(makeNode('start'), makeSession(), '')
    expect(result.messages).toEqual([])
    expect(result.next_node_id).toBeNull()
    expect(result.skip_edge_evaluation).toBe(false)
    expect(result.consumes_input).toBe(false)
  })
})

// ── message ────────────────────────────────────────────────────────────────────

describe('executeMessageNode', () => {
  it('returns a text message from config.text', () => {
    const node = makeNode('message', { text: 'Hello!' })
    const result = executeMessageNode(node, makeSession(), '')
    expect(result.messages).toEqual([{ type: 'text', text: 'Hello!' }])
    expect(result.next_node_id).toBeNull()
    expect(result.skip_edge_evaluation).toBe(false)
    expect(result.consumes_input).toBe(false)
  })

  it('includes attachment messages when config.attachments is set', () => {
    const node = makeNode('message', {
      text: 'Here is your image',
      attachments: [{ type: 'image', url: 'https://example.com/img.jpg', caption: 'Test' }],
    })
    const result = executeMessageNode(node, makeSession(), '')
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]).toEqual({ type: 'image', url: 'https://example.com/img.jpg', caption: 'Test' })
    expect(result.messages[1]).toEqual({ type: 'text', text: 'Here is your image' })
  })

  it('handles missing text gracefully', () => {
    const node = makeNode('message', {})
    const result = executeMessageNode(node, makeSession(), '')
    expect(result.messages).toEqual([{ type: 'text', text: '' }])
  })
})

// ── end ────────────────────────────────────────────────────────────────────────

describe('executeEndNode', () => {
  it('sends farewell message from config when call_stack is empty', () => {
    const node = makeNode('end', { farewell_message: 'Goodbye!' })
    const session = makeSession({ call_stack: [] })
    const result = executeEndNode(node, session)
    expect(result.messages).toEqual([{ type: 'text', text: 'Goodbye!' }])
    expect(result.next_node_id).toBeNull()
    expect(result.skip_edge_evaluation).toBe(true)
    expect(result.consumes_input).toBe(false)
  })

  it('pops call stack and returns to return_node_id when stack is non-empty', () => {
    const frame: CallStackFrame = {
      flow_id: 'parent_flow',
      return_node_id: 'n_return',
      context_snapshot: {},
    }
    const node = makeNode('end', { farewell_message: 'Subflow done' })
    const session = makeSession({ call_stack: [frame] })
    const result = executeEndNode(node, session)
    expect(result.next_node_id).toBe('n_return')
    expect(result.skip_edge_evaluation).toBe(true)
    expect(session.call_stack).toHaveLength(0)
    expect(session.flow_id).toBe('parent_flow')
  })

  it('sends no message when farewell_message is empty and returning from subflow', () => {
    const frame: CallStackFrame = { flow_id: 'pf', return_node_id: 'nr', context_snapshot: {} }
    const node = makeNode('end', {})
    const session = makeSession({ call_stack: [frame] })
    const result = executeEndNode(node, session)
    expect(result.messages).toEqual([])
  })
})

// ── input ──────────────────────────────────────────────────────────────────────

describe('executeInputNode', () => {
  it('stores inbound text into context under store_as key', () => {
    const node = makeNode('input', { prompt: 'Your name?', store_as: 'user.name', timeout_secs: 30 })
    const result = executeInputNode(node, makeSession(), 'Alice')
    expect(result.context_updates).toEqual({ 'user.name': 'Alice' })
    expect(result.consumes_input).toBe(true)
  })

  it('sends validation error message and re-loops when regex fails', () => {
    const node = makeNode('input', {
      prompt: 'Phone?', store_as: 'user.phone', timeout_secs: 30,
      validation: { type: 'regex', value: '^\\d{10}$', error_message: 'Invalid phone' },
    })
    const session = makeSession({ current_node_id: 'n_input' })
    const result = executeInputNode(node, session, 'abc')
    expect(result.messages).toEqual([{ type: 'text', text: 'Invalid phone' }])
    expect(result.next_node_id).toBe('n_input')
    expect(result.skip_edge_evaluation).toBe(true)
  })

  it('accepts valid regex input and stores it', () => {
    const node = makeNode('input', {
      prompt: 'Phone?', store_as: 'user.phone', timeout_secs: 30,
      validation: { type: 'regex', value: '^\\d{10}$', error_message: 'Invalid phone' },
    })
    const result = executeInputNode(node, makeSession(), '9876543210')
    expect(result.context_updates).toEqual({ 'user.phone': '9876543210' })
    expect(result.messages).toEqual([])
  })
})

// ── condition ─────────────────────────────────────────────────────────────────

describe('executeConditionNode', () => {
  it('consumes input and produces no messages (routing is on edges)', () => {
    const node = makeNode('condition', {})
    const result = executeConditionNode(node, makeSession(), 'yes')
    expect(result.consumes_input).toBe(true)
    expect(result.messages).toEqual([])
    expect(result.next_node_id).toBeNull()
    expect(result.skip_edge_evaluation).toBe(false)
  })
})

// ── delay ─────────────────────────────────────────────────────────────────────

describe('executeDelayNode', () => {
  it('is a no-op in Phase 2 — returns empty result', () => {
    const node = makeNode('delay', { delay_secs: 5 })
    const result = executeDelayNode(node, makeSession(), '')
    expect(result.messages).toEqual([])
    expect(result.context_updates).toEqual({})
    expect(result.next_node_id).toBeNull()
  })
})

// ── jump ──────────────────────────────────────────────────────────────────────

describe('executeJumpNode', () => {
  it('sets next_node_id and skip_edge_evaluation for same-flow jump', () => {
    const node = makeNode('jump', { target_node_id: 'n_target' })
    const session = makeSession({ flow_id: 'f1' })
    const result = executeJumpNode(node, session, '')
    expect(result.next_node_id).toBe('n_target')
    expect(result.skip_edge_evaluation).toBe(true)
    expect(session.flow_id).toBe('f1')
  })

  it('updates session.flow_id and clears call_stack for cross-flow jump', () => {
    const node = makeNode('jump', { target_flow_id: 'f_other', target_node_id: 'n_other' })
    const session = makeSession({
      flow_id: 'f1',
      call_stack: [{ flow_id: 'f0', return_node_id: 'nr', context_snapshot: {} }],
    })
    const result = executeJumpNode(node, session, '')
    expect(result.next_node_id).toBe('n_other')
    expect(session.flow_id).toBe('f_other')
    expect(session.call_stack).toHaveLength(0)
  })
})

// ── subflow ───────────────────────────────────────────────────────────────────

describe('executeSubflowNode', () => {
  it('pushes call stack frame and returns subflow entry node', () => {
    const node = makeNode('subflow', { subflow_id: 'sf1', return_mode: 'auto' })
    const session = makeSession({ flow_id: 'f1', context: { a: 1 } })
    const result = executeSubflowNode(node, session, '', 'sf1_entry')
    expect(result.next_node_id).toBe('sf1_entry')
    expect(result.skip_edge_evaluation).toBe(true)
    expect(session.flow_id).toBe('sf1')
    expect(session.call_stack).toHaveLength(1)
    expect(session.call_stack[0].flow_id).toBe('f1')
    expect(session.call_stack[0].context_snapshot).toEqual({ a: 1 })
    expect(session.call_stack[0].return_node_id).toBe('n1')  // node.id of the subflow call-site node
  })

  it('returns error message when call stack depth >= 10', () => {
    const frames: CallStackFrame[] = Array.from({ length: 10 }, (_, i) => ({
      flow_id: `f${i}`, return_node_id: 'r', context_snapshot: {},
    }))
    const node = makeNode('subflow', { subflow_id: 'sf1', return_mode: 'auto' })
    const session = makeSession({ call_stack: frames })
    const result = executeSubflowNode(node, session, '', 'sf1_entry')
    expect(result.messages[0].text).toContain('hi')
    expect(result.next_node_id).toBeNull()
  })

  it('returns error message on same-flow recursion', () => {
    const node = makeNode('subflow', { subflow_id: 'f1', return_mode: 'auto' })
    const session = makeSession({
      flow_id: 'f1',
      call_stack: [{ flow_id: 'f1', return_node_id: 'r', context_snapshot: {} }],
    })
    const result = executeSubflowNode(node, session, '', 'f1_entry')
    expect(result.messages[0].text).toContain('hi')
  })
})

// ── handoff ───────────────────────────────────────────────────────────────────

describe('executeHandoffNode', () => {
  it('returns user-facing message from config.message', () => {
    const node = makeNode('handoff', {
      department: 'sales', message: 'Connecting you to sales...', allow_resume: true,
      resume_node_id: 'n_resume', queue_strategy: 'round_robin', handoff_timeout_hours: 24,
    })
    const result = executeHandoffNode(node, makeSession(), '')
    expect(result.messages).toEqual([{ type: 'text', text: 'Connecting you to sales...' }])
    expect(result.context_updates['__handoff_department']).toBe('sales')
    expect(result.context_updates['__handoff_resume_node_id']).toBe('n_resume')
    expect(result.skip_edge_evaluation).toBe(true)
  })

  it('uses default message when config.message is empty', () => {
    const node = makeNode('handoff', {
      department: 'support', message: '', allow_resume: false,
      queue_strategy: 'round_robin', handoff_timeout_hours: 24,
    })
    const result = executeHandoffNode(node, makeSession(), '')
    expect(result.messages[0].text).toContain('team')
  })
})

// ── api ───────────────────────────────────────────────────────────────────────

describe('executeApiNode', () => {
  it('stores API response in context under response_variable', async () => {
    const node = makeNode('api', {
      method: 'GET', url: 'https://api.example.com/data',
      headers: {}, body_template: '',
      response_variable: 'api_result',
      timeout_secs: 5, retry_count: 0,
    })
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ items: [1, 2, 3] }), { status: 200 })
    const result = await executeApiNode(node, makeSession(), '', mockFetch)
    expect(result.context_updates['api_result']).toEqual({ items: [1, 2, 3] })
  })

  it('stores error in context when all retries fail', async () => {
    const node = makeNode('api', {
      method: 'GET', url: 'https://api.example.com/data',
      headers: {}, body_template: '',
      response_variable: 'api_result',
      timeout_secs: 1, retry_count: 1,
    })
    const mockFetch: typeof fetch = async () =>
      new Response('Internal Server Error', { status: 500 })
    const result = await executeApiNode(node, makeSession(), '', mockFetch)
    expect(result.context_updates['api_result_error']).toContain('500')
  })

  it('interpolates context values into body_template', async () => {
    let capturedBody = ''
    const node = makeNode('api', {
      method: 'POST', url: 'https://api.example.com/order',
      headers: {}, body_template: '{"name":"{{context.user.name}}"}',
      response_variable: 'order_result',
      timeout_secs: 5, retry_count: 0,
    })
    const mockFetch: typeof fetch = async (_url, init) => {
      capturedBody = (init?.body as string) ?? ''
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    const session = makeSession({ context: { 'user.name': 'Alice' } })
    await executeApiNode(node, session, '', mockFetch)
    expect(capturedBody).toBe('{"name":"Alice"}')
  })
})
