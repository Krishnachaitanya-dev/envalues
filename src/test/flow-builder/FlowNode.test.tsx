import { ReactFlowProvider } from '@xyflow/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FlowNode from '@/components/dashboard/builder/nodes/FlowNode'
import type { NodeType } from '@/integrations/supabase/flow-types'

function renderFlowNode(
  nodeType: NodeType,
  label: string | null = null,
  config: Record<string, unknown> = {},
  selected = false,
) {
  return render(
    <ReactFlowProvider>
      <FlowNode
        id="n1"
        type="flowNode"
        selected={selected}
        data={{ nodeType, label, config }}
      />
    </ReactFlowProvider>,
  )
}

describe('FlowNode', () => {
  it('renders a custom node label', () => {
    renderFlowNode('message', 'Say hi', { text: 'Hello!' })
    expect(screen.getByText('Say hi')).toBeInTheDocument()
  })

  it('renders a fallback Start label', () => {
    renderFlowNode('start')
    expect(screen.getByText('Start')).toBeInTheDocument()
  })

  it('renders a fallback End label', () => {
    renderFlowNode('end')
    expect(screen.getByText('End')).toBeInTheDocument()
  })

  it('renders condition nodes', () => {
    renderFlowNode('condition')
    expect(screen.getByText('Condition')).toBeInTheDocument()
    expect(screen.getByText('Branches by edge conditions')).toBeInTheDocument()
  })

  it('adds selected styling when selected', () => {
    renderFlowNode('message', 'Selected message', {}, true)
    expect(screen.getByTestId('flow-node').className).toContain('border-primary')
  })

  it('renders delay hint from config', () => {
    renderFlowNode('delay', null, { delay_secs: 12 })
    expect(screen.getByText('12s delay')).toBeInTheDocument()
  })
})
