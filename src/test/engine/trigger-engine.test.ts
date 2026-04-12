import { describe, it, expect } from 'vitest'
import { resolveTrigger, findRestartTrigger } from '../../../supabase/functions/whatsapp-webhook/engine/trigger-engine'
import type { FlowTrigger } from '../../../supabase/functions/whatsapp-webhook/engine/types'

function makeTrigger(overrides: Partial<FlowTrigger>): FlowTrigger {
  return {
    id: 't1', owner_id: 'o1', flow_id: 'f1',
    target_node_id: null,
    trigger_type: 'keyword',
    trigger_value: null,
    priority: 0,
    is_active: true,
    ...overrides,
  }
}

describe('findRestartTrigger', () => {
  const triggers: FlowTrigger[] = [
    makeTrigger({ id: 'r1', trigger_type: 'restart', trigger_value: 'hi', priority: 0 }),
    makeTrigger({ id: 'r2', trigger_type: 'restart', trigger_value: 'hello', priority: 1 }),
    makeTrigger({ id: 'k1', trigger_type: 'keyword', trigger_value: 'order', priority: 0 }),
  ]

  it('matches restart trigger on exact normalized text', () => {
    const result = findRestartTrigger(triggers, 'hi')
    expect(result?.id).toBe('r1')
  })

  it('matches restart trigger on normalized variant (punctuation stripped)', () => {
    const result = findRestartTrigger(triggers, 'hello')
    expect(result?.id).toBe('r2')
  })

  it('returns null when text matches keyword but not restart', () => {
    expect(findRestartTrigger(triggers, 'order')).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(findRestartTrigger(triggers, 'xyz')).toBeNull()
  })
})

describe('resolveTrigger — 4-pass pipeline', () => {
  const triggers: FlowTrigger[] = [
    makeTrigger({ id: 'r1', trigger_type: 'restart', trigger_value: 'hi', priority: 0 }),
    makeTrigger({ id: 'k_exact', trigger_type: 'keyword', trigger_value: 'order', priority: 10 }),
    makeTrigger({ id: 'k_ice_cream', trigger_type: 'keyword', trigger_value: 'ice cream', priority: 10 }),
    makeTrigger({ id: 'k_ice', trigger_type: 'keyword', trigger_value: 'ice', priority: 30 }),
    makeTrigger({ id: 'def', trigger_type: 'default', trigger_value: null, priority: 0 }),
  ]

  it('Pass 1 — restart trigger matched (no active session needed)', () => {
    const result = resolveTrigger(triggers, 'hi')
    expect(result?.id).toBe('r1')
  })

  it('Pass 2 — keyword exact match', () => {
    const result = resolveTrigger(triggers, 'order')
    expect(result?.id).toBe('k_exact')
  })

  it('Pass 3 — contains match, longest value wins (ice cream > ice)', () => {
    const result = resolveTrigger(triggers, 'i want ice cream')
    expect(result?.id).toBe('k_ice_cream')
  })

  it('Pass 3 — shorter keyword matches when longer does not', () => {
    const result = resolveTrigger(triggers, 'i want ice')
    expect(result?.id).toBe('k_ice')
  })

  it('Pass 4 — default fallback when nothing else matches', () => {
    const result = resolveTrigger(triggers, 'something random')
    expect(result?.id).toBe('def')
  })

  it('returns null when no triggers match and no default', () => {
    const noDefault = triggers.filter(t => t.trigger_type !== 'default')
    expect(resolveTrigger(noDefault, 'something random')).toBeNull()
  })

  it('inactive triggers are ignored', () => {
    const withInactive = [
      makeTrigger({ id: 'inactive', trigger_type: 'keyword', trigger_value: 'order', priority: 0, is_active: false }),
      makeTrigger({ id: 'def', trigger_type: 'default', trigger_value: null, priority: 0 }),
    ]
    const result = resolveTrigger(withInactive, 'order')
    expect(result?.id).toBe('def')
  })
})
