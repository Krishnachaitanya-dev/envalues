import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import NodeConfigPanel from '@/components/dashboard/builder/NodeConfigPanel'
import type { FlowNode } from '@/integrations/supabase/flow-types'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn(() => Promise.resolve({ error: null })),
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    },
  },
}))

const messageNode: FlowNode = {
  id: 'node-1',
  flow_id: 'flow-1',
  owner_id: 'owner-1',
  node_type: 'message',
  label: 'Message',
  config: {
    text: 'Hello',
    media_url: 'https://example.com/old.pdf',
    media_type: 'document',
  },
  position_x: 0,
  position_y: 0,
  created_at: '',
  updated_at: '',
}

function renderPanel(overrides: Partial<ComponentProps<typeof NodeConfigPanel>> = {}) {
  const props: ComponentProps<typeof NodeConfigPanel> = {
    node: messageNode,
    ownerId: 'owner-1',
    flowId: 'flow-1',
    flows: [],
    allNodes: [messageNode],
    onClose: vi.fn(),
    onUpdateConfig: vi.fn<ComponentProps<typeof NodeConfigPanel>['onUpdateConfig']>(() => Promise.resolve()),
    onDeleteNode: vi.fn(() => Promise.resolve()),
    onDirtyChange: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<NodeConfigPanel {...props} />) }
}

describe('NodeConfigPanel media editor', () => {
  it('renders a single unified message content composer', () => {
    renderPanel()

    expect(screen.getByText('Message content')).toBeInTheDocument()
    expect(screen.getByText('Unified message preview')).toBeInTheDocument()
    expect(screen.getByText('Media inside this message')).toBeInTheDocument()
    expect(screen.getByText('Links inside this message')).toBeInTheDocument()
    expect(screen.getByText('Quick replies inside this message')).toBeInTheDocument()
    expect(screen.queryByText('Message text')).not.toBeInTheDocument()
    expect(screen.queryByText('Media attachments')).not.toBeInTheDocument()
    expect(screen.queryByText('External links')).not.toBeInTheDocument()
    expect(screen.queryByText('Quick Reply Buttons')).not.toBeInTheDocument()
  })

  it('normalizes legacy media fields and saves only attachments/links', async () => {
    const onUpdateConfig = vi.fn<ComponentProps<typeof NodeConfigPanel>['onUpdateConfig']>(() => Promise.resolve())
    renderPanel({ onUpdateConfig })

    fireEvent.click(screen.getByText('Save node'))

    await waitFor(() => expect(onUpdateConfig).toHaveBeenCalled())
    const [, params] = onUpdateConfig.mock.calls[0]
    expect(params.config.media_url).toBeUndefined()
    expect(params.config.media_type).toBeUndefined()
    expect(params.config.attachments[0]).toMatchObject({
      type: 'document',
      url: 'https://example.com/old.pdf',
      source: 'url',
    })
  })

  it('saves text, attachments, links, and buttons together on one message node config', async () => {
    const onUpdateConfig = vi.fn<ComponentProps<typeof NodeConfigPanel>['onUpdateConfig']>(() => Promise.resolve())
    const richNode: FlowNode = {
      ...messageNode,
      config: {
        text: 'Here is everything',
        attachments: [{ id: 'a1', type: 'image', url: 'https://example.com/photo.jpg', source: 'url' }],
        links: [{ id: 'l1', label: 'Watch', url: 'https://youtube.com/watch?v=abc' }],
        buttons: [{ id: 'b1', title: 'Pricing' }],
      },
    }

    renderPanel({ node: richNode, allNodes: [richNode], onUpdateConfig })
    fireEvent.click(screen.getByText('Save node'))

    await waitFor(() => expect(onUpdateConfig).toHaveBeenCalled())
    const [, params] = onUpdateConfig.mock.calls[0]
    expect(params.config).toMatchObject({
      text: 'Here is everything',
      attachments: [{ id: 'a1', type: 'image', url: 'https://example.com/photo.jpg', source: 'url' }],
      links: [{ id: 'l1', label: 'Watch', url: 'https://youtube.com/watch?v=abc' }],
      buttons: [{ id: 'b1', title: 'Pricing' }],
    })
    expect(params.config.media_url).toBeUndefined()
    expect(params.config.media_type).toBeUndefined()
  })

  it('blocks upload when owner, flow, or persisted node context is missing', () => {
    renderPanel({ ownerId: null })
    expect(screen.getByText('Save/select a persisted flow node before uploading media.')).toBeInTheDocument()
    expect(screen.getByText('Upload image').closest('button')).toBeDisabled()
  })

  it('saves WhatsApp quick reply buttons on message nodes', async () => {
    const onUpdateConfig = vi.fn<ComponentProps<typeof NodeConfigPanel>['onUpdateConfig']>(() => Promise.resolve())
    renderPanel({ onUpdateConfig })

    fireEvent.click(screen.getByText('Add button'))
    fireEvent.change(screen.getByPlaceholderText('Button 1 title'), { target: { value: 'Pricing' } })
    fireEvent.click(screen.getByText('Save node'))

    await waitFor(() => expect(onUpdateConfig).toHaveBeenCalled())
    const [, params] = onUpdateConfig.mock.calls[0]
    expect(params.config.buttons).toHaveLength(1)
    expect(params.config.buttons[0]).toMatchObject({
      id: expect.any(String),
      title: 'Pricing',
    })
  })

  it('asks before closing dirty node edits', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onClose = vi.fn()
    renderPanel({ onClose })

    fireEvent.change(screen.getByPlaceholderText('Text to send'), { target: { value: 'Changed' } })
    fireEvent.click(screen.getAllByRole('button')[0])

    expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved node changes?')
    expect(onClose).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
