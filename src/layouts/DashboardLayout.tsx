import { Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardProvider, useDashboard } from '@/contexts/DashboardContext'
import { TopBar } from '@/components/dashboard/TopBar'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { RightPanel } from '@/components/dashboard/RightPanel'

function DashboardShell() {
  const { loading } = useDashboard()
  const location = useLocation()
  const isBuilderRoute = location.pathname.startsWith('/dashboard/builder')

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
    <div className="h-dvh max-h-dvh bg-background flex flex-col overflow-hidden">
      <SidebarProvider defaultOpen={false} className="h-full min-h-0 max-h-full flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 min-h-0 flex w-full min-w-0 overflow-hidden">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <main className={[
              'flex-1 min-h-0 min-w-0 overflow-x-hidden',
              // Builder pages handle their own internal scrolling; keep shell fixed-height (no page scroll).
              isBuilderRoute ? 'p-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6 overflow-y-auto safe-area-page',
            ].join(' ')}>
              <Outlet />
            </main>
          </div>
          {!isBuilderRoute && <RightPanel />}
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
