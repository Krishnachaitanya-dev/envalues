import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck, ChevronDown, LogOut, RefreshCw, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdmin } from '@/contexts/AdminContext'

const breadcrumbMap: Record<string, string> = {
  '/admin':           'Overview',
  '/admin/users':     'Users',
  '/admin/revenue':   'Revenue',
  '/admin/activity':  'Activity',
  '/admin/security':  'Security',
}

export function AdminTopBar() {
  const { adminEmail, adminName, handleLogout, refreshAll } = useAdmin()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    if (showMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  const currentLabel = breadcrumbMap[location.pathname] ?? 'Admin'

  return (
    <nav className="h-[52px] border-b border-border sticky top-0 z-50 backdrop-blur-xl bg-background/90">
      <div className="h-full flex items-center justify-between px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/25">
              <ShieldCheck size={15} className="text-white" />
            </div>
            <span className="font-display font-bold text-foreground text-sm hidden sm:inline">Admin</span>
          </Link>

          <span className="text-border text-sm">/</span>
          <motion.span
            key={location.pathname}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs font-semibold text-foreground"
          >
            {currentLabel}
          </motion.span>

          <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/20">
            Super Admin
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh all data"
          >
            <RefreshCw size={14} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="flex items-center gap-2 hover:bg-muted px-2 py-1.5 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/25 to-purple-500/25 flex items-center justify-center text-violet-400 font-bold text-[11px] ring-1 ring-border">
                {adminName?.charAt(0)?.toUpperCase() ?? adminEmail?.charAt(0)?.toUpperCase() ?? 'A'}
              </div>
              <ChevronDown size={11} className="text-muted-foreground hidden sm:block" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-bold text-foreground truncate">{adminName ?? 'Admin'}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{adminEmail}</p>
                  </div>
                  <div className="p-1">
                    <Link
                      to="/profile"
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-xl transition-colors"
                      onClick={() => setShowMenu(false)}
                    >
                      <User size={14} className="text-muted-foreground" /> Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  )
}
