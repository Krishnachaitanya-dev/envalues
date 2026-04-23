import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const dashboardData = readFileSync('src/hooks/useDashboardData.ts', 'utf-8')

describe('dashboard whatsapp settings contract', () => {
  it('saves whatsapp account row before owner legacy fields', () => {
    const accountUpsertAt = dashboardData.indexOf(".from('whatsapp_accounts')")
    const ownerUpdateAt = dashboardData.indexOf(".from('owners').update({")
    expect(accountUpsertAt).toBeGreaterThan(-1)
    expect(ownerUpdateAt).toBeGreaterThan(-1)
    expect(accountUpsertAt).toBeLessThan(ownerUpdateAt)
  })

  it('shows explicit duplicate phone-number-id error', () => {
    expect(dashboardData).toContain('This WhatsApp number is already connected to another account.')
    expect(dashboardData).toContain("waError.code === '23505'")
  })

  it('derives connection status from whatsapp_accounts only', () => {
    expect(dashboardData).toContain("const whatsappConnectionStatus = whatsappAccount?.status ?? 'disconnected'")
    expect(dashboardData).not.toContain('hasLegacyWhatsappCreds')
  })
})
