import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const webhook = readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf-8')

describe('active session keyword interrupt contract', () => {
  it('resolves normal keyword triggers even while a session is active', () => {
    expect(webhook).toContain("session?.status === 'active' ? resolveTrigger(triggers, text)")
    expect(webhook).toContain("interrupt.trigger_type !== 'default'")
    expect(webhook).toContain("interrupt.flow_id !== session?.flow_id")
    expect(webhook).toContain('interrupt.target_node_id')
    expect(webhook).toContain('await expireSession(session.id)')
    expect(webhook).toContain('const newSession = await createSession(ownerId, phone, interrupt)')
  })
})
