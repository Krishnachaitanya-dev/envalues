import { Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AdminProvider, useAdmin } from '@/contexts/AdminContext'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopBar } from '@/components/admin/AdminTopBar'

function AdminShell() {
  const { loading } = useAdmin()

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
    <div className="min-h-screen bg-background flex flex-col">
      <AdminTopBar />
      <div className="flex-1 flex overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-6">
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
