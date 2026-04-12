import { Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { DashboardProvider, useDashboard } from '@/contexts/DashboardContext'
import { TopBar } from '@/components/dashboard/TopBar'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { RightPanel } from '@/components/dashboard/RightPanel'

function DashboardShell() {
  const { loading } = useDashboard()

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
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      <div className="flex-1 flex w-full overflow-hidden">
        <SidebarProvider defaultOpen={false}>
          <DashboardSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile sidebar trigger */}
            <div className="md:hidden h-10 flex items-center border-b border-border px-2">
              <SidebarTrigger />
            </div>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
              <Outlet />
            </main>
          </div>
        </SidebarProvider>
        <RightPanel />
      </div>
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
