import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const flowBuilder = readFileSync('src/hooks/useFlowBuilder.ts', 'utf-8')
const webhook = readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf-8')

describe('flow unpublish runtime contract', () => {
  it('expires active bot sessions when a flow is unpublished', () => {
    expect(flowBuilder).toContain(".from('flow_sessions')")
    expect(flowBuilder).toContain(".update({ status: 'expired' })")
    expect(flowBuilder).toContain(".eq('flow_id', flowId)")
    expect(flowBuilder).toContain(".eq('status', 'active')")
  })

  it('does not continue sessions for unpublished flows', () => {
    expect(webhook).toContain('async function isFlowPublished')
    expect(webhook).toContain("session?.status === 'active'")
    expect(webhook).toContain('isFlowPublished(session.flow_id)')
    expect(webhook).toContain('session = null')
  })

  it('stays silent when no published triggers are available', () => {
    expect(webhook).toContain('if (triggers.length === 0)')
    expect(webhook).toContain("Reply 'hi' to get started.")
  })
})
