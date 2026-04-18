import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, type CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardProvider, useDashboard } from '@/contexts/DashboardContext'
import { TopBar } from '@/components/dashboard/TopBar'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { RightPanel } from '@/components/dashboard/RightPanel'

function DashboardShell() {
  const { loading } = useDashboard()
  const location = useLocation()
  // Canvas editors need p-0 overflow-hidden so ReactFlow fills the viewport.
  // The simple builder LIST page (/dashboard/builder with no ?flow=) is a normal scrollable page.
  const isBuilderCanvas =
    location.pathname.startsWith('/dashboard/builder/') ||
    (location.pathname === '/dashboard/builder' && new URLSearchParams(location.search).has('flow'))

  // WhatsApp preview panel only makes sense on overview + inbox
  const showRightPanel = location.pathname === '/dashboard' || location.pathname === '/dashboard/inbox'

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')
    const previous = {
      htmlHeight: html.style.height,
      htmlOverflow: html.style.overflow,
      bodyHeight: body.style.height,
      bodyOverflow: body.style.overflow,
      rootHeight: root?.style.height ?? '',
      rootOverflow: root?.style.overflow ?? '',
    }

    html.style.height = '100%'
    html.style.overflow = 'hidden'
    body.style.height = '100%'
    body.style.overflow = 'hidden'
    if (root) {
      root.style.height = '100%'
      root.style.overflow = 'hidden'
    }

    return () => {
      html.style.height = previous.htmlHeight
      html.style.overflow = previous.htmlOverflow
      body.style.height = previous.bodyHeight
      body.style.overflow = previous.bodyOverflow
      if (root) {
        root.style.height = previous.rootHeight
        root.style.overflow = previous.rootOverflow
      }
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    if (!import.meta.env.DEV || !location.pathname.startsWith('/dashboard/builder')) return

    const frame = window.requestAnimationFrame(() => {
      const shell = document.querySelector<HTMLElement>('[data-dashboard-shell]')
      const topbar = document.querySelector<HTMLElement>('[data-dashboard-topbar]')
      const body = document.querySelector<HTMLElement>('[data-dashboard-body]')
      const shellRect = shell?.getBoundingClientRect()
      const topbarRect = topbar?.getBoundingClientRect()
      const bodyRect = body?.getBoundingClientRect()
      const metrics = {
        path: `${location.pathname}${location.search}`,
        scrollY: window.scrollY,
        documentTop: document.documentElement.scrollTop,
        shellTop: shellRect?.top ?? null,
        shellHeight: shellRect?.height ?? null,
        topbarTop: topbarRect?.top ?? null,
        topbarHeight: topbarRect?.height ?? null,
        bodyTop: bodyRect?.top ?? null,
        bodyHeight: bodyRect?.height ?? null,
      }

      console.info('[dashboard-layout]', metrics)
      if ((topbarRect?.height ?? 0) < 50 || (bodyRect && topbarRect && bodyRect.top < topbarRect.bottom - 1)) {
        console.warn('[dashboard-layout] clipped header detected', metrics)
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.search])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Loading dashboard</p>
          <p className="text-xs text-muted-foreground mt-0.5">Please wait...</p>
        </div>
      </div>
    </div>
  )

  return (
    <div data-dashboard-shell className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <SidebarProvider
        defaultOpen={false}
        className="flex h-full min-h-0 w-full overflow-hidden"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          maxHeight: '100%',
          '--sidebar-top': '52px',
          '--sidebar-height': 'calc(100svh - 52px)',
        } as CSSProperties}
      >
        <TopBar />
        <div data-dashboard-body className="flex-1 min-h-0 flex w-full min-w-0 overflow-hidden">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <main className={[
              'flex-1 min-h-0 min-w-0 overflow-x-hidden',
              isBuilderCanvas ? 'p-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6 overflow-y-auto safe-area-page',
            ].join(' ')}>
              <Outlet />
            </main>
          </div>
          {showRightPanel && <RightPanel />}
        </div>
      </SidebarProvider>
    </div>
  )
}

export default function DashboardLayout() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  )
}
