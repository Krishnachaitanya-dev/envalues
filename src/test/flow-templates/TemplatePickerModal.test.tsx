import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TemplatePickerModal from '@/features/flow-templates/ui/TemplatePickerModal'
import { stockFlowTemplates } from '@/features/flow-templates/catalog'

vi.mock('@/features/flow-templates/services/getTemplates', () => ({
  getFlowTemplates: vi.fn(() => Promise.resolve(stockFlowTemplates)),
}))

vi.mock('@/features/flow-templates/services/templateEvents', () => ({
  trackTemplateEvent: vi.fn(() => Promise.resolve()),
}))

describe('TemplatePickerModal', () => {
  it('loads templates, filters by search, shows approval badges, and applies selection', async () => {
    const onApply = vi.fn(() => Promise.resolve())
    render(
      <TemplatePickerModal
        ownerId="owner-1"
        open
        applying={false}
        onClose={() => undefined}
        onApply={onApply}
      />,
    )

    expect(await screen.findByText('Stock Flow Templates')).toBeInTheDocument()
    expect((await screen.findAllByText('Clinic / Doctor Appointment')).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText('Search templates'), { target: { value: 'ecommerce' } })
    await waitFor(() => expect(screen.getAllByText('Ecommerce Store').length).toBeGreaterThan(0))
    expect(screen.queryAllByText('Clinic / Doctor Appointment')).toHaveLength(0)

    fireEvent.click(screen.getAllByText('Ecommerce Store')[0])
    expect(await screen.findByText('Approval')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Use Template'))
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: 'ecommerce_store' })))
  })

  it('disables apply while a template is applying', async () => {
    render(
      <TemplatePickerModal
        ownerId="owner-1"
        open
        applying
        onClose={() => undefined}
        onApply={() => Promise.resolve()}
      />,
    )

    const button = await screen.findByText('Applying...')
    expect(button.closest('button')).toBeDisabled()
  })
})
