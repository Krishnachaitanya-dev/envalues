import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AdminProvider, useAdmin } from '@/contexts/AdminContext'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopBar } from '@/components/admin/AdminTopBar'

function AdminShell() {
  const { loading } = useAdmin()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/15 to-purple-500/5 flex items-center justify-center ring-1 ring-violet-500/10">
          <Loader2 size={24} className="animate-spin text-violet-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Loading admin dashboard</p>
          <p className="text-xs text-muted-foreground mt-0.5">Verifying access...</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-clip">
      <AdminTopBar onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex-1 flex min-w-0 overflow-hidden">
        <AdminSidebar className="hidden md:flex" />

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close admin navigation"
              onClick={() => setMobileNavOpen(false)}
            />
            <AdminSidebar
              className="relative h-full w-[82vw] max-w-80 shadow-2xl"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 safe-area-page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminShell />
    </AdminProvider>
  )
}
