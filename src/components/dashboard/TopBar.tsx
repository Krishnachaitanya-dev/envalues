import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, User, LogOut, LayoutDashboard, Workflow, Settings2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboard } from '@/contexts/DashboardContext'
import { SidebarTrigger } from '@/components/ui/sidebar'

const breadcrumbMap: Record<string, { label: string; icon: React.ElementType }> = {
  '/dashboard': { label: 'Overview', icon: LayoutDashboard },
  '/dashboard/builder': { label: 'Builder', icon: Workflow },
  '/dashboard/settings': { label: 'Settings', icon: Settings2 },
}

export function TopBar() {
  const { ownerData, handleLogout, brand } = useDashboard()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    if (showUserMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  const currentPage = breadcrumbMap[location.pathname] || breadcrumbMap['/dashboard']

  return (
    <nav className="h-[52px] shrink-0 border-b border-border z-50 backdrop-blur-xl bg-background/90">
      <div className="h-full flex items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <SidebarTrigger className="md:hidden touch-target rounded-xl" />
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
            {brand?.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="h-8 sm:h-10 w-auto rounded-lg object-contain" />
            ) : (
              <img src="/envalues-logo.png" alt="Envalues" className="h-8 sm:h-10 w-auto" />
            )}
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
            <ChevronRight size={12} className="text-border" />
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5"
            >
              <currentPage.icon size={13} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">{currentPage.label}</span>
            </motion.div>
          </div>
        </div>

        <div className="relative" ref={userMenuRef}>
          <button onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:bg-muted px-2 py-1.5 rounded-lg transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/25 to-secondary/25 flex items-center justify-center text-primary font-bold text-[11px] ring-1 ring-border">
              {ownerData?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <ChevronDown size={11} className="text-muted-foreground hidden sm:block" />
          </button>
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs font-bold text-foreground truncate">{ownerData?.full_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{ownerData?.email}</p>
                </div>
                <div className="p-1">
                  <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-xl transition-colors" onClick={() => setShowUserMenu(false)}>
                    <User size={14} className="text-muted-foreground" /> Profile
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 rounded-xl transition-colors">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  )
}
