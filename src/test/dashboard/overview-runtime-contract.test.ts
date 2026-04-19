import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const dashboardData = readFileSync('src/hooks/useDashboardData.ts', 'utf-8')
const overview = readFileSync('src/components/dashboard/overview/OverviewPage.tsx', 'utf-8')
const dashboardLayout = readFileSync('src/layouts/DashboardLayout.tsx', 'utf-8')

describe('overview dashboard contract', () => {
  it('verifies first-flow setup against real flow rows', () => {
    expect(dashboardData).toContain(".from('flows')")
    expect(dashboardData).toContain(".select('id, status')")
    expect(dashboardData).toContain(".neq('status', 'archived')")
    expect(dashboardData).toContain('flowSummary')
    expect(dashboardData).toContain('hasAnyFlow')
    expect(dashboardData).toContain('hasPublishedFlow')
    expect(overview).toContain('done: hasAnyFlow')
    expect(overview).toContain('saved flow')
    expect(overview).toContain('live flow')
  })

  it('does not mount stale global WhatsApp preview outside builders', () => {
    expect(dashboardLayout).not.toContain('RightPanel')
    expect(dashboardLayout).not.toContain('WhatsAppPreview')
  })
})
