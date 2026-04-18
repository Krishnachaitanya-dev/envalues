import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('Flow delete runtime contract', () => {
  it('deleteFlow detaches entry and clears sessions before deleting flow rows', () => {
    const src = readFileSync('src/hooks/useFlowBuilder.ts', 'utf-8')

    const deleteFlowPos = src.indexOf('const deleteFlow')
    expect(deleteFlowPos).toBeGreaterThan(-1)

    const detachPos = src.indexOf('update({ entry_node_id: null })', deleteFlowPos)
    const sessionsPos = src.indexOf(".from('flow_sessions')", deleteFlowPos)
    const triggersPos = src.indexOf(".from('flow_triggers')", deleteFlowPos)
    const edgesPos = src.indexOf(".from('flow_edges')", deleteFlowPos)
    const nodesPos = src.indexOf(".from('flow_nodes')", deleteFlowPos)
    const deleteFlowRowPos = src.indexOf("const flow = await (supabase.from('flows')", deleteFlowPos)

    expect(detachPos).toBeGreaterThan(deleteFlowPos)
    expect(sessionsPos).toBeGreaterThan(detachPos)
    expect(triggersPos).toBeGreaterThan(sessionsPos)
    expect(edgesPos).toBeGreaterThan(triggersPos)
    expect(nodesPos).toBeGreaterThan(edgesPos)
    expect(deleteFlowRowPos).toBeGreaterThan(nodesPos)
  })

  it('deleteNode clears sessions and detaches entry node when needed', () => {
    const src = readFileSync('src/hooks/useFlowBuilder.ts', 'utf-8')

    const deleteNodePos = src.indexOf('const deleteNode')
    expect(deleteNodePos).toBeGreaterThan(-1)

    const detachPos = src.indexOf('update({ entry_node_id: null })', deleteNodePos)
    const sessionsPos = src.indexOf(".from('flow_sessions')", deleteNodePos)
    const currentNodeEqPos = src.indexOf("eq('current_node_id'", deleteNodePos)
    const nodeDeletePos = src.indexOf(".from('flow_nodes')", deleteNodePos)

    expect(detachPos).toBeGreaterThan(deleteNodePos)
    expect(sessionsPos).toBeGreaterThan(deleteNodePos)
    expect(currentNodeEqPos).toBeGreaterThan(sessionsPos)
    expect(nodeDeletePos).toBeGreaterThan(currentNodeEqPos)
  })
})
