import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('mobile responsive layout source contract', () => {
  it('keeps app shells mobile-safe with drawer navigation and no horizontal page overflow', () => {
    const dashboard = readFileSync('src/layouts/DashboardLayout.tsx', 'utf-8')
    const admin = readFileSync('src/layouts/AdminLayout.tsx', 'utf-8')
    const adminTopBar = readFileSync('src/components/admin/AdminTopBar.tsx', 'utf-8')
    const sidebar = readFileSync('src/components/ui/sidebar.tsx', 'utf-8')

    expect(dashboard).toContain('overflow-x-hidden')
    expect(dashboard).toContain('safe-area-page')
    expect(dashboard).toContain('fixed inset-0')
    expect(dashboard).toContain('html.style.overflow =')
    expect(dashboard).toContain('window.scrollTo(0, 0)')
    expect(dashboard).toContain('[dashboard-layout]')
    expect(dashboard).toContain('className="flex h-full min-h-0 w-full overflow-hidden"')
    expect(dashboard).toContain("height: '100%'")
    expect(dashboard).toContain("maxHeight: '100%'")
    expect(dashboard).toContain("'--sidebar-top': '52px'")
    expect(dashboard).toContain("'--sidebar-height': 'calc(100svh - 52px)'")
    expect(dashboard).toContain("isBuilderCanvas ? 'p-0 overflow-hidden'")
    expect(dashboard).toContain('{showRightPanel && <RightPanel />}')
    expect(sidebar).toContain('h-[var(--sidebar-height)]')
    expect(sidebar).toContain('top-[var(--sidebar-top)]')
    expect(admin).toContain('mobileNavOpen')
    expect(admin).toContain('fixed inset-0 z-50 md:hidden')
    expect(adminTopBar).toContain('Open admin navigation')
  })

  it('keeps the Phase 3 builder editable on mobile without permanent side panels', () => {
    const page = readFileSync('src/components/dashboard/builder/FlowBuilderPage.tsx', 'utf-8')
    const canvas = readFileSync('src/components/dashboard/builder/FlowCanvas.tsx', 'utf-8')
    const nodePanel = readFileSync('src/components/dashboard/builder/NodeConfigPanel.tsx', 'utf-8')
    const edgePanel = readFileSync('src/components/dashboard/builder/EdgeConfigPanel.tsx', 'utf-8')

    expect(page).toContain('flowListOpen')
    expect(page).toContain('md:hidden')
    expect(page).toContain('h-full min-h-0')
    expect(canvas).toContain('useIsMobile')
    expect(canvas).toContain('!isMobile')
    expect(nodePanel).toContain('mobile-sheet')
    expect(edgePanel).toContain('mobile-sheet')
  })

  it('turns fixed split panes into mobile list-detail flows', () => {
    const inbox = readFileSync('src/components/dashboard/inbox/InboxPage.tsx', 'utf-8')
    const contacts = readFileSync('src/components/dashboard/contacts/ContactsPage.tsx', 'utf-8')
    const adminEvolution = readFileSync('src/components/admin/pages/AdminEvolutionInbox.tsx', 'utf-8')

    expect(inbox).toContain('Back to conversations')
    expect(inbox).toContain("selectedPhone ? 'hidden md:flex' : 'flex'")
    expect(contacts).toContain('md:hidden p-3 space-y-2')
    expect(contacts).toContain('hidden md:table')
    expect(adminEvolution).toContain('Back to conversations')
    expect(adminEvolution).toContain("selectedPhone ? 'hidden md:flex' : 'flex'")
  })

  it('keeps deployment-critical data tables contained on mobile', () => {
    const broadcast = readFileSync('src/components/dashboard/broadcast/BroadcastPage.tsx', 'utf-8')
    const adminOverview = readFileSync('src/components/admin/pages/AdminOverview.tsx', 'utf-8')
    const adminSecurity = readFileSync('src/components/admin/pages/AdminSecurity.tsx', 'utf-8')

    expect(broadcast.match(/mobile-table-scroll/g)?.length).toBeGreaterThanOrEqual(2)
    expect(adminOverview).toContain('mobile-table-scroll')
    expect(adminSecurity).toContain('mobile-table-scroll')
  })
})
