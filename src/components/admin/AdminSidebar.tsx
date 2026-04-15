import { LayoutDashboard, Users, CreditCard, ScrollText, Shield, Settings, Zap } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { title: 'Overview',   url: '/admin',          icon: LayoutDashboard, end: true },
  { title: 'Users',      url: '/admin/users',     icon: Users },
  { title: 'Revenue',    url: '/admin/revenue',   icon: CreditCard },
  { title: 'Activity',   url: '/admin/activity',  icon: ScrollText },
  { title: 'Security',   url: '/admin/security',  icon: Shield },
  { title: 'Evolution API', url: '/admin/evolution', icon: Zap },
]

interface AdminSidebarProps {
  className?: string
  onNavigate?: () => void
}

export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const location = useLocation()

  return (
    <aside className={cn('w-56 shrink-0 border-r border-border bg-card flex flex-col h-full', className)}>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(item => {
          const isActive = item.end
            ? location.pathname === item.url
            : location.pathname.startsWith(item.url)

          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.end}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon size={15} />
              {item.title}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <NavLink
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings size={15} />
          Back to Dashboard
        </NavLink>
      </div>
    </aside>
  )
}
