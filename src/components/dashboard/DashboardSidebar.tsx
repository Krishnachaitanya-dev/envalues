import { LayoutDashboard, Workflow, Settings2, CreditCard, BarChart3, ScrollText, HelpCircle, Inbox, Users, Building2, Send } from 'lucide-react'
import { NavLink } from '@/components/NavLink'
import { useDashboard } from '@/contexts/DashboardContext'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const baseNavItems = [
  { title: 'Overview', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Builder', url: '/dashboard/builder', icon: Workflow },
  { title: 'Inbox', url: '/dashboard/inbox', icon: Inbox },
  { title: 'Contacts', url: '/dashboard/contacts', icon: Users },
  { title: 'Analytics', url: '/dashboard/analytics', icon: BarChart3 },
  { title: 'Help', url: '/dashboard/help', icon: HelpCircle },
  { title: 'Settings', url: '/dashboard/settings', icon: Settings2 },
  { title: 'Billing', url: '/dashboard/billing', icon: CreditCard },
]

const futureItems = [
  { title: 'Audit Logs', url: '#', icon: ScrollText, disabled: true },
]

export function DashboardSidebar() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const { isEnterprise, isEnterpriseClient } = useDashboard()

  const navItems = (() => {
    let items = [
      ...baseNavItems.slice(0, 5),
      { title: 'Broadcast', url: '/dashboard/broadcast', icon: Send },
      ...baseNavItems.slice(5),
    ]
    if (isEnterprise) {
      items.splice(4, 0, { title: 'Clients', url: '/dashboard/clients', icon: Building2 })
    }
    if (isEnterpriseClient) {
      items = items.filter(i => i.url !== '/dashboard/broadcast')
    }
    return items
  })()

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-surface-raised">
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Future items */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {futureItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                    <span className="opacity-40 cursor-not-allowed flex items-center gap-2 px-2 py-1.5">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          {item.title}
                          <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Soon</span>
                        </span>
                      )}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
