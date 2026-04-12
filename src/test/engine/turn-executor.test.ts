// src/test/engine/turn-executor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { executeTurn, TurnDeps } from '../../../supabase/functions/whatsapp-webhook/engine/turn-executor'
import type { FlowNode, FlowEdge, FlowSession } from '../../../supabase/functions/whatsapp-webhook/engine/types'

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
    expect(lastSave.status).toBe('active')
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
})
