// src/test/reception-phone.test.ts
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardContext } from '../contexts/DashboardContext'
import SettingsPage from '../components/dashboard/settings/SettingsPage'
import { createMockDashboardContext } from './helpers/mock-dashboard-context'

vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}))

describe('SettingsPage — reception phone', () => {
  it('renders Reception Phone field', () => {
    const ctx = createMockDashboardContext({
      ownerData: { reception_phone: '' },
      handleSaveReceptionPhone: vi.fn(),
    })
    render(
      React.createElement(DashboardContext.Provider, { value: ctx as any },
        React.createElement(SettingsPage)
      )
    )
    expect(screen.getByLabelText(/reception/i)).toBeDefined()
  })

  it('pre-fills existing reception_phone value', () => {
    const ctx = createMockDashboardContext({
      ownerData: { reception_phone: '919876543210' },
      handleSaveReceptionPhone: vi.fn(),
    })
    render(
      React.createElement(DashboardContext.Provider, { value: ctx as any },
        React.createElement(SettingsPage)
      )
    )
    expect(screen.getByDisplayValue('919876543210')).toBeDefined()
  })
})
