import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'

const mockFlows = [
  {
    id: 'f1',
    owner_id: 'o1',
    name: 'Main Flow',
    description: null,
    status: 'draft',
    version: 1,
    entry_node_id: null,
    created_at: '',
    updated_at: '',
  },
]

const mockNodes = [
  {
    id: 'n1',
    flow_id: 'f1',
    owner_id: 'o1',
    node_type: 'start',
    label: 'Start',
    config: {},
    position_x: 100,
    position_y: 100,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'n2',
    flow_id: 'f1',
    owner_id: 'o1',
    node_type: 'message',
    label: 'Hello',
    config: { text: 'Hi there!' },
    position_x: 300,
    position_y: 100,
    created_at: '',
    updated_at: '',
  },
]

const mockEdges = [
  {
    id: 'e1',
    flow_id: 'f1',
    owner_id: 'o1',
    source_node_id: 'n1',
    target_node_id: 'n2',
    condition_type: 'always',
    condition_value: null,
    condition_variable: null,
    condition_expression: null,
    is_fallback: false,
    priority: 0,
    label: null,
    created_at: '',
  },
]

const mockTriggers = [
  {
    id: 't1',
    owner_id: 'o1',
    flow_id: 'f1',
    target_node_id: null,
    trigger_type: 'keyword',
    trigger_value: 'hi',
    priority: 0,
    is_active: true,
    metadata: {},
    created_at: '',
  },
]

function rowsFor(table: string) {
  if (table === 'flows') return mockFlows
  if (table === 'flow_nodes') return mockNodes
  if (table === 'flow_edges') return mockEdges
  if (table === 'flow_triggers') return mockTriggers
  return []
}

function makeQuery(table: string) {
  const query: any = {
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data: rowsFor(table), error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: rowsFor(table)[0] ?? null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: rowsFor(table)[0] ?? null, error: null })),
    select: vi.fn(() => query),
  }
  return query
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({
      data: {
        ok: true,
        flow: { ...mockFlows[0], id: 'flow-from-template', name: 'Clinic / Doctor Appointment' },
        nodes: mockNodes.map(node => ({ ...node, flow_id: 'flow-from-template' })),
        edges: mockEdges.map(edge => ({ ...edge, flow_id: 'flow-from-template' })),
        triggers: mockTriggers.map(trigger => ({ ...trigger, flow_id: 'flow-from-template', is_active: false })),
      },
      error: null,
    })),
    from: vi.fn((table: string) => ({
      select: vi.fn(() => makeQuery(table)),
      insert: vi.fn((payload: Record<string, unknown>) => {
        const idPrefix = table === 'flow_nodes' ? 'n' : table === 'flow_edges' ? 'e' : table === 'flow_triggers' ? 't' : 'f'
        const data = {
          id: `${idPrefix}-new`,
          created_at: '',
          updated_at: '',
          ...payload,
        }
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data, error: null })),
          })),
        }
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}))

describe('useFlowBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty state without an owner id', () => {
    const { result } = renderHook(() => useFlowBuilder(null))

    expect(result.current.flows).toEqual([])
    expect(result.current.rfNodes).toEqual([])
    expect(result.current.rfEdges).toEqual([])
  })

  it('loads flows for an owner', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))

    await waitFor(() => expect(result.current.flows).toHaveLength(1))
    expect(result.current.flows[0].name).toBe('Main Flow')
  })

  it('selectFlow populates React Flow nodes and edges', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))

    await waitFor(() => expect(result.current.flows).toHaveLength(1))
    await act(async () => {
      await result.current.selectFlow('f1')
    })

    expect(result.current.selectedFlowId).toBe('f1')
    expect(result.current.rfNodes).toHaveLength(2)
    expect(result.current.rfEdges).toHaveLength(1)
  })

  it('maps database node positions to React Flow positions', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))

    await waitFor(() => expect(result.current.flows).toHaveLength(1))
    await act(async () => {
      await result.current.selectFlow('f1')
    })

    expect(result.current.rfNodes[0].position).toEqual({ x: 100, y: 100 })
    expect(result.current.rfNodes[1].position).toEqual({ x: 300, y: 100 })
  })

  it('maps database edge source and target ids', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))

    await waitFor(() => expect(result.current.flows).toHaveLength(1))
    await act(async () => {
      await result.current.selectFlow('f1')
    })

    expect(result.current.rfEdges[0].source).toBe('n1')
    expect(result.current.rfEdges[0].target).toBe('n2')
  })

  it('getFlowNode returns the matching database node', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))

    await waitFor(() => expect(result.current.flows).toHaveLength(1))
    await act(async () => {
      await result.current.selectFlow('f1')
    })

    expect(result.current.getFlowNode('n1')?.node_type).toBe('start')
  })

  it('applyFlowTemplate hydrates the created graph and selects the created flow', async () => {
    const { result } = renderHook(() => useFlowBuilder('o1'))

    await waitFor(() => expect(result.current.flows).toHaveLength(1))
    await act(async () => {
      await result.current.applyFlowTemplate('clinic_doctor_appointment', 1, 'Clinic / Doctor Appointment')
    })

    expect(result.current.selectedFlowId).toBe('flow-from-template')
    expect(result.current.flows[0].id).toBe('flow-from-template')
    expect(result.current.rfNodes).toHaveLength(2)
    expect(result.current.triggers[0].is_active).toBe(false)
  })
})
