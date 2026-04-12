import { describe, it, expect } from 'vitest'
import type { Flow, FlowNode, FlowEdge, FlowTrigger, NodeType, ConditionType } from '@/integrations/supabase/flow-types'

describe('flow-types exports', () => {
  it('Flow type has expected shape', () => {
    const f: Flow = {
      id: 'abc', owner_id: 'xyz', name: 'Test Flow', description: null,
      status: 'draft', version: 1, entry_node_id: null,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    }
    expect(f.status).toBe('draft')
  })

  it('NodeType union covers all 10 types', () => {
    const types: NodeType[] = [
      'start','message','input','condition','api','delay','jump','subflow','handoff','end'
    ]
    expect(types.length).toBe(10)
  })

  it('ConditionType union covers all 7 types', () => {
    const types: ConditionType[] = [
      'always','equals','contains','starts_with','regex','variable_equals','variable_contains'
    ]
    expect(types.length).toBe(7)
  })

  it('FlowNode has config typed as Record<string,unknown>', () => {
    const n: FlowNode = {
      id: 'n1', flow_id: 'f1', owner_id: 'o1', node_type: 'message',
      label: 'Say hi', config: { text: 'Hello!' },
      position_x: 100, position_y: 200,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    }
    expect(n.config['text']).toBe('Hello!')
  })

  it('FlowEdge has source/target node ids', () => {
    const e: FlowEdge = {
      id: 'e1', flow_id: 'f1', owner_id: 'o1',
      source_node_id: 'n1', target_node_id: 'n2',
      condition_type: 'always', condition_value: null,
      condition_variable: null, is_fallback: false,
      priority: 0, label: null, created_at: '2026-01-01',
    }
    expect(e.condition_type).toBe('always')
  })

  it('FlowTrigger has trigger_type', () => {
    const t: FlowTrigger = {
      id: 't1', owner_id: 'o1', flow_id: 'f1', target_node_id: null,
      trigger_type: 'keyword', trigger_value: 'hi',
      priority: 0, is_active: true, created_at: '2026-01-01',
    }
    expect(t.trigger_type).toBe('keyword')
  })
})
