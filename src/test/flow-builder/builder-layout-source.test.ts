import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('Phase 3 builder layout source contract', () => {
  it('does not render a permanent empty right config panel', () => {
    const src = readFileSync('src/components/dashboard/builder/FlowBuilderPage.tsx', 'utf-8')
    expect(src).not.toContain('node={null}')
    expect(src).toContain('showNodePanel')
    expect(src).toContain('showEdgePanel')
  })

  it('uses grouped Add node menu taxonomy instead of a long horizontal strip', () => {
    const src = readFileSync('src/components/dashboard/builder/FlowCanvas.tsx', 'utf-8')
    expect(src).toContain('ADD_NODE_GROUPS')
    expect(src).toContain("label: 'Messages'")
    expect(src).toContain("label: 'Logic'")
    expect(src).toContain("label: 'Actions'")
    expect(src).toContain("label: 'Flow control'")
    expect(src).toContain('Add node')
  })

  it('passes owner, flow, and node context into the node panel for uploads', () => {
    const page = readFileSync('src/components/dashboard/builder/FlowBuilderPage.tsx', 'utf-8')
    const panel = readFileSync('src/components/dashboard/builder/NodeConfigPanel.tsx', 'utf-8')
    expect(page).toContain('ownerId={user?.id ?? null}')
    expect(page).toContain('flowId={fb.selectedFlowId}')
    expect(panel).toContain('uploadFlowNodeMedia')
    expect(panel).toContain('Save/select a persisted flow node before uploading media.')
  })
})
