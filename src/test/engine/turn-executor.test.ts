// src/test/engine/turn-executor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { executeTurn, TurnDeps } from '../../../supabase/functions/whatsapp-webhook/engine/turn-executor'
import type { FlowNode, FlowEdge, FlowSession, OutboundMessage } from '../../../supabase/functions/whatsapp-webhook/engine/types'

function makeSession(overrides: Partial<FlowSession> = {}): FlowSession {
  return {
    id: 's1', owner_id: 'o1', flow_id: 'f1',
    current_node_id: 'n_start', phone: '911234567890',
    status: 'active', context: {}, call_stack: [],
    step_count: 0, max_steps: 100,
    last_node_executed_at: null, last_message_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeNode(id: string, node_type: FlowNode['node_type'], config: Record<string, unknown> = {}): FlowNode {
  return { id, flow_id: 'f1', owner_id: 'o1', node_type, label: null, config }
}

function makeEdge(source_node_id: string, target_node_id: string, condition_type: FlowEdge['condition_type'] = 'always', condition_value?: string): FlowEdge {
  return {
    id: `e_${source_node_id}_${target_node_id}`,
    flow_id: 'f1', owner_id: 'o1',
    source_node_id, target_node_id,
    condition_type, condition_value: condition_value ?? null,
    condition_variable: null, condition_expression: null,
    is_fallback: false, priority: 0,
  }
}

function makeDeps(
  nodes: FlowNode[],
  edges: FlowEdge[],
): TurnDeps & {
  savedSessions: FlowSession[]
  sentMessages: string[]
  closedSessions: string[]
  killedSessions: string[]
} {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edgeMap = new Map<string, FlowEdge[]>()
  for (const e of edges) {
    const list = edgeMap.get(e.source_node_id) ?? []
    list.push(e)
    edgeMap.set(e.source_node_id, list)
  }

  const savedSessions: FlowSession[] = []
  const sentMessages: string[] = []
  const closedSessions: string[] = []
  const killedSessions: string[] = []

  return {
    savedSessions,
    sentMessages,
    closedSessions,
    killedSessions,
    getNode: async (id) => nodeMap.get(id) ?? null,
    getOutgoingEdges: async (nodeId) => edgeMap.get(nodeId) ?? [],
    saveSession: async (s) => { savedSessions.push({ ...s }) },
    enqueueMessages: async (msgs) => { msgs.forEach(m => { if (m.text) sentMessages.push(m.text) }) },
    sendHandoffAlert: async () => {},
    closeSession: async (s) => { closedSessions.push(s.id) },
    killSession: async (s) => { killedSessions.push(s.id) },
    fetchFn: async () => new Response('{}', { status: 200 }),
    getSubflowEntryNode: async () => null,
  }
}

describe('executeTurn', () => {
  it('executes start → message → end and closes session', async () => {
    const nodes = [
      makeNode('n_start', 'start'),
      makeNode('n_msg', 'message', { text: 'Hello world' }),
      makeNode('n_end', 'end', { farewell_message: 'Bye!' }),
    ]
    const edges = [
      makeEdge('n_start', 'n_msg'),
      makeEdge('n_msg', 'n_end'),
    ]
    const deps = makeDeps(nodes, edges)
    const session = makeSession({ current_node_id: 'n_start' })

    await executeTurn(session, '', deps)

    expect(deps.sentMessages).toContain('Hello world')
    expect(deps.sentMessages).toContain('Bye!')
    expect(deps.closedSessions).toContain('s1')
  })

  it('pauses at input node and saves session with current_node_id pointing to input', async () => {
    const nodes = [
      makeNode('n_start', 'start'),
      makeNode('n_input', 'input', { prompt: 'Your name?', store_as: 'user.name', timeout_secs: 30 }),
    ]
    const edges = [makeEdge('n_start', 'n_input')]
    const deps = makeDeps(nodes, edges)
    const session = makeSession({ current_node_id: 'n_start' })

    await executeTurn(session, '', deps)

    const lastSave = deps.savedSessions[deps.savedSessions.length - 1]
    expect(lastSave.current_node_id).toBe('n_input')
    expect(lastSave.context['__input_prompted_at']).toBe('n_input')
    expect(deps.sentMessages).toContain('Your name?')
    expect(lastSave.status).toBe('active')
    expect(deps.closedSessions).toHaveLength(0)
  })

  it('sends input prompt attachments before waiting for text', async () => {
    const nodes = [
      makeNode('n_start', 'start'),
      makeNode('n_input', 'input', {
        prompt: 'Please share your name and flat number.',
        store_as: 'lead_details',
        timeout_secs: 300,
        attachments: [
          { type: 'image', url: 'https://example.com/logo.png', caption: 'Project logo' },
        ],
      }),
    ]
    const edges = [makeEdge('n_start', 'n_input')]
    const deps = makeDeps(nodes, edges)
    const sent: OutboundMessage[] = []
    deps.enqueueMessages = async (messages) => { sent.push(...messages) }
    const session = makeSession({ current_node_id: 'n_start' })

    await executeTurn(session, '', deps)

    expect(sent).toEqual([
      {
        type: 'image',
        url: 'https://example.com/logo.png',
        caption: 'Please share your name and flat number.\n\nProject logo',
      },
    ])
    expect(session.current_node_id).toBe('n_input')
  })

  it('does not resend an input prompt that was already shown for the same input node', async () => {
    const nodes = [
      makeNode('n_input', 'input', { prompt: 'Your name?', store_as: 'user.name', timeout_secs: 30 }),
    ]
    const deps = makeDeps(nodes, [])
    const session = makeSession({
      current_node_id: 'n_input',
      context: { __input_prompted_at: 'n_input' },
    })

    await executeTurn(session, '', deps)

    expect(deps.sentMessages).not.toContain('Your name?')
    expect(deps.closedSessions).toHaveLength(0)
  })

  it('resumes from input node with inbound text and stores context', async () => {
    const nodes = [
      makeNode('n_input', 'input', { prompt: 'Name?', store_as: 'user.name', timeout_secs: 30 }),
      makeNode('n_msg', 'message', { text: 'Got it!' }),
      makeNode('n_end', 'end', {}),
    ]
    const edges = [
      makeEdge('n_input', 'n_msg'),
      makeEdge('n_msg', 'n_end'),
    ]
    const deps = makeDeps(nodes, edges)
    const session = makeSession({ current_node_id: 'n_input' })

    await executeTurn(session, 'Alice', deps)

    expect(deps.sentMessages).toContain('Got it!')
    expect(session.context['user.name']).toBe('Alice')
    expect(deps.closedSessions).toContain('s1')
  })

  it('uses captured input text when matching outgoing input edges', async () => {
    const nodes = [
      makeNode('n_input', 'input', { prompt: 'Choose 1 or 2', store_as: 'choice', timeout_secs: 30 }),
      makeNode('n_one', 'message', { text: 'You chose one' }),
      makeNode('n_end', 'end', {}),
    ]
    const edges = [
      makeEdge('n_input', 'n_one', 'equals', '1'),
      makeEdge('n_one', 'n_end'),
    ]
    const deps = makeDeps(nodes, edges)
    const session = makeSession({ current_node_id: 'n_input' })

    await executeTurn(session, '1', deps)

    expect(session.context.choice).toBe('1')
    expect(deps.sentMessages).toContain('You chose one')
    expect(deps.closedSessions).toContain('s1')
  })

  it('routes captured input to handoff without closing the chat', async () => {
    const nodes = [
      makeNode('n_input', 'input', { prompt: 'Share your name and preferred time.', store_as: 'trial_request', timeout_secs: 300 }),
      makeNode('n_handoff', 'handoff', {
        department: 'support',
        message: 'Thanks. Our team will confirm the slot.',
        allow_resume: false,
        queue_strategy: 'round_robin',
        handoff_timeout_hours: 24,
      }),
    ]
    const edges = [makeEdge('n_input', 'n_handoff')]
    const deps = makeDeps(nodes, edges)
    const session = makeSession({
      current_node_id: 'n_input',
      context: { __input_prompted_at: 'n_input' },
    })

    await executeTurn(session, 'Krish, weight loss, 6 PM', deps)

    expect(session.context.trial_request).toBe('Krish, weight loss, 6 PM')
    expect(session.context['__input_prompted_at']).toBeUndefined()
    expect(session.status).toBe('handoff')
    expect(deps.sentMessages).toContain('Thanks. Our team will confirm the slot.')
    expect(deps.closedSessions).toHaveLength(0)
  })

  it('kills session when step_count hits max_steps', async () => {
    const nodes = [
      makeNode('n1', 'message', { text: 'loop' }),
      makeNode('n2', 'message', { text: 'loop2' }),
    ]
    const edges = [
      makeEdge('n1', 'n2'),
      makeEdge('n2', 'n1'),
    ]
    const session = makeSession({ current_node_id: 'n1', max_steps: 3 })
    const deps = makeDeps(nodes, edges)

    await executeTurn(session, '', deps)

    expect(deps.killedSessions).toContain('s1')
  })

  it('kills session on cycle detection (same node visited twice)', async () => {
    // Jump node with same target creates an unconditional self-loop
    const nodes = [
      makeNode('n1', 'jump', { target_node_id: 'n1' }),
    ]
    const edges: FlowEdge[] = []
    const session = makeSession({ current_node_id: 'n1' })
    const deps = makeDeps(nodes, edges)

    await executeTurn(session, '', deps)

    expect(deps.killedSessions).toContain('s1')
  })

  it('sends fallback message on dead-end (no matching edge)', async () => {
    const nodes = [
      makeNode('n_input', 'input', { prompt: 'Choose 1 or 2', store_as: 'choice', timeout_secs: 30 }),
      makeNode('n1', 'message', { text: 'You chose 1' }),
      makeNode('n2', 'message', { text: 'You chose 2' }),
    ]
    const edges = [
      makeEdge('n_input', 'n1', 'equals', '1'),
      makeEdge('n_input', 'n2', 'equals', '2'),
    ]
    const session = makeSession({ current_node_id: 'n_input' })
    const deps = makeDeps(nodes, edges)

    await executeTurn(session, '3', deps)

    expect(deps.sentMessages.some(m => m.toLowerCase().includes('hi'))).toBe(true)
    expect(deps.killedSessions).toHaveLength(0)
  })

  it('state is persisted before messages are sent (state-first guarantee)', async () => {
    const calls: string[] = []
    const nodes = [
      makeNode('n1', 'message', { text: 'Hello' }),
      makeNode('n_end', 'end', {}),
    ]
    const edges = [makeEdge('n1', 'n_end')]
    const session = makeSession({ current_node_id: 'n1' })

    const deps = makeDeps(nodes, edges)
    deps.saveSession = async () => { calls.push('save') }
    deps.enqueueMessages = async () => { calls.push('send') }

    await executeTurn(session, '', deps)

    // First occurrence of 'save' must come before first occurrence of 'send'
    const firstSave = calls.indexOf('save')
    const firstSend = calls.indexOf('send')
    expect(firstSave).toBeLessThan(firstSend)
  })

  it('sets session.status to handoff when handoff node executes', async () => {
    const nodes = [
      makeNode('n_handoff', 'handoff', {
        department: 'sales', message: 'Connecting you...', allow_resume: false,
        queue_strategy: 'round_robin', handoff_timeout_hours: 24,
      }),
    ]
    const edges: FlowEdge[] = []
    const session = makeSession({ current_node_id: 'n_handoff' })
    const deps = makeDeps(nodes, edges)
    const alertsSent: string[] = []
    deps.sendHandoffAlert = async (_ownerPhone, customerPhone) => { alertsSent.push(customerPhone) }
    deps.ownerReceptionPhone = '+919999999999'

    await executeTurn(session, '', deps)

    expect(session.status).toBe('handoff')
    expect(deps.sentMessages).toContain('Connecting you...')
    expect(alertsSent).toContain('911234567890')
    expect(deps.closedSessions).toHaveLength(0)
  })

  it('kills session with missing_node when initial current_node_id does not exist', async () => {
    const session = makeSession({ current_node_id: 'nonexistent_node' })
    const deps = makeDeps([], [])

    await executeTurn(session, '', deps)

    expect(deps.killedSessions).toContain('s1')
  })

  it('follows call stack return on end node inside a subflow', async () => {
    // Simulates: parent flow → subflow → end → return to parent message → end
    const nodes = [
      makeNode('n_subflow_end', 'end', { farewell_message: 'Subflow done' }),
      makeNode('n_parent_msg', 'message', { text: 'Back in parent' }),
      makeNode('n_parent_end', 'end', {}),
    ]
    const edges = [
      makeEdge('n_parent_msg', 'n_parent_end'),
    ]
    // Session has a call stack frame pointing back to parent message
    const session = makeSession({
      current_node_id: 'n_subflow_end',
      call_stack: [{
        flow_id: 'f1',
        return_node_id: 'n_parent_msg',
        context_snapshot: {},
      }],
    })
    const deps = makeDeps(nodes, edges)

    await executeTurn(session, '', deps)

    expect(deps.sentMessages).toContain('Subflow done')
    expect(deps.sentMessages).toContain('Back in parent')
    expect(deps.closedSessions).toContain('s1')
  })

  it('returns from a subflow call-site to the call-site successor', async () => {
    const nodes = [
      makeNode('n_subflow_call', 'subflow', { subflow_id: 'child_flow', return_mode: 'auto' }),
      makeNode('n_subflow_end', 'end', { farewell_message: 'Subflow done' }),
      makeNode('n_parent_msg', 'message', { text: 'Back in parent' }),
      makeNode('n_parent_end', 'end', {}),
    ]
    const edges = [
      makeEdge('n_subflow_call', 'n_parent_msg'),
      makeEdge('n_parent_msg', 'n_parent_end'),
    ]
    const session = makeSession({
      current_node_id: 'n_subflow_end',
      flow_id: 'child_flow',
      call_stack: [{
        flow_id: 'f1',
        return_node_id: 'n_subflow_call',
        context_snapshot: {},
      }],
    })
    const deps = makeDeps(nodes, edges)

    await executeTurn(session, '', deps)

    expect(deps.sentMessages).toContain('Subflow done')
    expect(deps.sentMessages).toContain('Back in parent')
    expect(deps.closedSessions).toContain('s1')
  })

  it('kills session on cycle via message node edge self-loop', async () => {
    // Message node with unconditional edge back to itself (edge evaluator path, not jump)
    const nodes = [
      makeNode('n_loop', 'message', { text: 'looping' }),
    ]
    const edges = [
      makeEdge('n_loop', 'n_loop', 'always'),
    ]
    const session = makeSession({ current_node_id: 'n_loop' })
    const deps = makeDeps(nodes, edges)

    await executeTurn(session, '', deps)

    expect(deps.killedSessions).toContain('s1')
  })
})
