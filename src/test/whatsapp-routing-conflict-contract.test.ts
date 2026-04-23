import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const sharedWhatsApp = readFileSync('supabase/functions/_shared/whatsapp.ts', 'utf-8')

describe('whatsapp inbound routing conflict contract', () => {
  it('detects duplicate owner mappings for fallback business number routing', () => {
    expect(sharedWhatsApp).toContain('.limit(2)')
    expect(sharedWhatsApp).toContain("if (owners.length > 1)")
  })

  it('logs routing conflict events and fails deterministically', () => {
    expect(sharedWhatsApp).toContain("event_type: 'routing_conflict'")
    expect(sharedWhatsApp).toContain('Inbound routing conflict: duplicate business number mapping')
    expect(sharedWhatsApp).toContain('return null')
  })
})
