import type { FlowTrigger } from './types.ts'
import { normalize } from './normalize.ts'

/**
 * Check only restart triggers. Used for every incoming message, even when a
 * session is already active (restart kills the existing session).
 * normalizedText must already be normalized by the caller.
 */
export function findRestartTrigger(triggers: FlowTrigger[], normalizedText: string): FlowTrigger | null {
  const restarts = triggers
    .filter(t => t.trigger_type === 'restart' && t.is_active)
    .sort((a, b) => a.priority - b.priority)

  for (const t of restarts) {
    if (normalize(t.trigger_value ?? '') === normalizedText) return t
  }
  return null
}

/**
 * 4-pass trigger resolution pipeline:
 *   Pass 1: restart — exact normalized match
 *   Pass 2: keyword — exact normalized match, sorted by priority
 *   Pass 3: keyword — contains match, longest value first (prevents "ice" beating "ice cream")
 *   Pass 4: default — single default per owner, always last resort
 *
 * normalizedText must already be normalized by the caller.
 */
export function resolveTrigger(triggers: FlowTrigger[], normalizedText: string): FlowTrigger | null {
  const active = triggers.filter(t => t.is_active)

  // Pass 1: restart exact
  const restarts = active.filter(t => t.trigger_type === 'restart').sort((a, b) => a.priority - b.priority)
  for (const t of restarts) {
    if (normalize(t.trigger_value ?? '') === normalizedText) return t
  }

  // Pass 2: keyword exact match
  const keywords = active.filter(t => t.trigger_type === 'keyword').sort((a, b) => a.priority - b.priority)
  for (const t of keywords) {
    if (normalize(t.trigger_value ?? '') === normalizedText) return t
  }

  // Pass 3: keyword contains match — longest trigger_value first
  const byLength = [...keywords].sort((a, b) => (b.trigger_value?.length ?? 0) - (a.trigger_value?.length ?? 0))
  for (const t of byLength) {
    const normalized_value = normalize(t.trigger_value ?? '')
    if (normalized_value && normalizedText.includes(normalized_value)) return t
  }

  // Pass 4: default fallback
  return active.find(t => t.trigger_type === 'default') ?? null
}
