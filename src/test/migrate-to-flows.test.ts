// src/test/migrate-to-flows.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildFlowFromChatbot,
  buildStartAndGreetingNodes,
  buildMessageNodesFromQAPairs,
  buildEdgesFromQAPairs,
  buildTriggersFromChatbot,
  validateMigrationResult,
  normalizePhone,
} from '../../scripts/migrate-to-flows'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_ID = 'owner-uuid-1'
const CHATBOT_ID = 'chatbot-uuid-1'

const mockChatbot = {
  id: CHATBOT_ID,
  owner_id: OWNER_ID,
  chatbot_name: 'Test Bot',
  greeting_message: 'Welcome! How can I help?',
  farewell_message: 'Thanks! Goodbye.',
  is_active: true,
}

const mockRootQAPair = {
  id: 'qa-root-1',
  chatbot_id: CHATBOT_ID,
  question_text: 'Services',
  answer_text: 'Here are our services.',
  is_main_question: true,
  parent_question_id: null,
  display_order: 1,
  media_url: null,
  media_type: null,
}

const mockRootQAPairWithMedia = {
  ...mockRootQAPair,
  id: 'qa-root-2',
  question_text: 'Gallery',
  answer_text: 'Check our gallery.',
  display_order: 2,
  media_url: 'https://storage.supabase.co/chatbot-media/owner/bot/photo.jpg',
  media_type: 'image',
}

const mockChildQAPair = {
  id: 'qa-child-1',
  chatbot_id: CHATBOT_ID,
  question_text: 'Consulting',
  answer_text: 'We offer consulting.',
  is_main_question: false,
  parent_question_id: 'qa-root-1',
  display_order: 1,
  media_url: null,
  media_type: null,
}

// ── buildFlowFromChatbot ──────────────────────────────────────────────────────

describe('buildFlowFromChatbot', () => {
  it('maps active chatbot to published flow', () => {
    const flow = buildFlowFromChatbot(mockChatbot)
    expect(flow.name).toBe('Test Bot')
    expect(flow.owner_id).toBe(OWNER_ID)
    expect(flow.status).toBe('published')
    expect(flow.version).toBe(1)
  })

  it('maps inactive chatbot to draft flow', () => {
    const flow = buildFlowFromChatbot({ ...mockChatbot, is_active: false })
    expect(flow.status).toBe('draft')
  })
})

// ── buildStartAndGreetingNodes ────────────────────────────────────────────────

describe('buildStartAndGreetingNodes', () => {
  it('creates a start node', () => {
    const { startNode } = buildStartAndGreetingNodes(mockChatbot, 'flow-uuid-1')
    expect(startNode.node_type).toBe('start')
    expect(startNode.flow_id).toBe('flow-uuid-1')
    expect(startNode.owner_id).toBe(OWNER_ID)
    expect(startNode.label).toBe('Start')
  })

  it('creates a greeting message node with chatbot greeting', () => {
    const { greetingNode } = buildStartAndGreetingNodes(mockChatbot, 'flow-uuid-1')
    expect(greetingNode.node_type).toBe('message')
    expect(greetingNode.config.text).toBe('Welcome! How can I help?')
    expect(greetingNode.owner_id).toBe(OWNER_ID)
  })

  it('creates an end node with farewell message', () => {
    const { endNode } = buildStartAndGreetingNodes(mockChatbot, 'flow-uuid-1')
    expect(endNode.node_type).toBe('end')
    expect(endNode.config.farewell_message).toBe('Thanks! Goodbye.')
  })
})

// ── buildMessageNodesFromQAPairs ──────────────────────────────────────────────

describe('buildMessageNodesFromQAPairs', () => {
  it('creates one message node per qa_pair', () => {
    const qaPairs = [mockRootQAPair, mockChildQAPair]
    const nodes = buildMessageNodesFromQAPairs(qaPairs, 'flow-uuid-1', OWNER_ID)
    expect(nodes).toHaveLength(2)
  })

  it('maps answer_text to config.text', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPair], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].config.text).toBe('Here are our services.')
    expect(nodes[0].node_type).toBe('message')
  })

  it('maps media to config.attachments when present', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPairWithMedia], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].config.attachments).toHaveLength(1)
    expect(nodes[0].config.attachments[0].type).toBe('image')
    expect(nodes[0].config.attachments[0].url).toBe(mockRootQAPairWithMedia.media_url)
  })

  it('sets no attachments when media_url is null', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPair], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].config.attachments).toBeUndefined()
  })

  it('stores legacy_qa_pair_id for migration tracing', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPair], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].legacy_qa_pair_id).toBe('qa-root-1')
  })
})

// ── buildEdgesFromQAPairs ─────────────────────────────────────────────────────

describe('buildEdgesFromQAPairs', () => {
  it('creates start → greeting edge (always)', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const startEdge = edges.find(e => e.source_node_id === 'node-start-id')
    expect(startEdge).toBeDefined()
    expect(startEdge!.target_node_id).toBe('node-greeting-id')
    expect(startEdge!.condition_type).toBe('always')
    expect(startEdge!.is_fallback).toBe(false)
  })

  it('creates greeting → root-message edge with equals condition on question_text', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const greetingEdge = edges.find(
      e => e.source_node_id === 'node-greeting-id' && !e.is_fallback
    )
    expect(greetingEdge).toBeDefined()
    expect(greetingEdge!.condition_type).toBe('equals')
    expect(greetingEdge!.condition_value).toBe('Services')
    expect(greetingEdge!.target_node_id).toBe('node-msg-1')
  })

  it('creates a fallback edge from greeting back to greeting', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const fallback = edges.find(
      e => e.source_node_id === 'node-greeting-id' && e.is_fallback
    )
    expect(fallback).toBeDefined()
    expect(fallback!.target_node_id).toBe('node-greeting-id')
    expect(fallback!.condition_type).toBe('always')
  })

  it('creates parent → child edge with equals condition', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-root',
      'qa-child-1': 'node-msg-child',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair, mockChildQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const childEdge = edges.find(
      e => e.source_node_id === 'node-msg-root' && !e.is_fallback
    )
    expect(childEdge).toBeDefined()
    expect(childEdge!.condition_value).toBe('Consulting')
    expect(childEdge!.target_node_id).toBe('node-msg-child')
  })

  it('gives leaf nodes a fallback edge back to greeting', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-root',
      'qa-child-1': 'node-msg-child',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair, mockChildQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const leafFallback = edges.find(
      e => e.source_node_id === 'node-msg-child' && e.is_fallback
    )
    expect(leafFallback).toBeDefined()
    expect(leafFallback!.target_node_id).toBe('node-greeting-id')
  })

  it('sets priority from display_order', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const greetingEdge = edges.find(
      e => e.source_node_id === 'node-greeting-id' && !e.is_fallback
    )
    expect(greetingEdge!.priority).toBe(1)  // display_order: 1
  })
})

// ── buildTriggersFromChatbot ──────────────────────────────────────────────────

describe('buildTriggersFromChatbot', () => {
  it('creates restart triggers for hi, hello, start', () => {
    const triggers = buildTriggersFromChatbot(
      mockChatbot,
      'flow-uuid-1',
      OWNER_ID,
      'greeting-node-id'
    )
    const restarts = triggers.filter(t => t.trigger_type === 'restart')
    const values = restarts.map(t => t.trigger_value)
    expect(values).toContain('hi')
    expect(values).toContain('hello')
    expect(values).toContain('start')
  })

  it('creates a default trigger pointing to greeting node', () => {
    const triggers = buildTriggersFromChatbot(
      mockChatbot,
      'flow-uuid-1',
      OWNER_ID,
      'greeting-node-id'
    )
    const def = triggers.find(t => t.trigger_type === 'default')
    expect(def).toBeDefined()
    expect(def!.target_node_id).toBe('greeting-node-id')
    expect(def!.flow_id).toBe('flow-uuid-1')
  })

  it('all triggers have owner_id and flow_id', () => {
    const triggers = buildTriggersFromChatbot(
      mockChatbot,
      'flow-uuid-1',
      OWNER_ID,
      'greeting-node-id'
    )
    for (const t of triggers) {
      expect(t.owner_id).toBe(OWNER_ID)
      expect(t.flow_id).toBe('flow-uuid-1')
    }
  })
})

// ── validateMigrationResult ───────────────────────────────────────────────────

describe('validateMigrationResult', () => {
  it('passes for a valid migration with entry set and fallbacks present', () => {
    const nodes = [
      { id: 'n-start', node_type: 'start' },
      { id: 'n-greeting', node_type: 'message' },
      { id: 'n-msg1', node_type: 'message' },
    ]
    const edges = [
      { source_node_id: 'n-start', target_node_id: 'n-greeting', is_fallback: false },
      { source_node_id: 'n-greeting', target_node_id: 'n-msg1', is_fallback: false, condition_value: 'Services' },
      { source_node_id: 'n-greeting', target_node_id: 'n-greeting', is_fallback: true },
      { source_node_id: 'n-msg1', target_node_id: 'n-greeting', is_fallback: true },
    ]
    const result = validateMigrationResult('n-start', nodes, edges, 1)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when entry_node_id is missing', () => {
    const result = validateMigrationResult(null, [], [], 0)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('entry_node_id is not set')
  })

  it('fails when a non-terminal node has no outgoing edges', () => {
    const nodes = [
      { id: 'n-start', node_type: 'start' },
      { id: 'n-orphan', node_type: 'message' },
    ]
    const edges = [
      { source_node_id: 'n-start', target_node_id: 'n-orphan', is_fallback: false },
      // n-orphan has no outgoing edge
    ]
    const result = validateMigrationResult('n-start', nodes, edges, 2)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('no outgoing edge'))).toBe(true)
  })

  it('fails when a non-terminal node is missing a fallback edge', () => {
    const nodes = [
      { id: 'n-start', node_type: 'start' },
      { id: 'n-greeting', node_type: 'message' },
    ]
    const edges = [
      { source_node_id: 'n-start', target_node_id: 'n-greeting', is_fallback: false },
      { source_node_id: 'n-greeting', target_node_id: 'n-greeting', is_fallback: false, condition_type: 'equals', condition_value: 'test' },
    ]
    const result = validateMigrationResult('n-start', nodes, edges, 1)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('missing fallback edge'))).toBe(true)
  })
})

// ── normalizePhone ────────────────────────────────────────────────────────────

describe('normalizePhone', () => {
  it('strips non-digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210')
  })

  it('prepends 91 to 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210')
  })

  it('leaves 12-digit number unchanged', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210')
  })
})
