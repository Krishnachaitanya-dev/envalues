import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
  plan_type: string
  brand_name: string | null
  brand_logo_url: string | null
  brand_primary_color: string | null
  max_clients: number
  enterprise_id: string | null
  chatbot: {
    id: string
    chatbot_name: string
    is_active: boolean
  } | null
  subscription: {
    id: string
    status: string
    amount: number
    created_at: string
    current_period_end: string | null
  } | null
}

export type AdminMetrics = {
  totalUsers: number
  activeUsers: number
  activeBots: number
  activeSubscriptions: number
  cancelledSubscriptions: number
  mrr: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  sessionsToday: number
  sessionsThisMonth: number
}

export type MonthlyDataPoint = {
  month: string
  newUsers: number
  newSubscriptions: number
  revenue: number
}

export type SubscriptionRow = {
  id: string
  owner_id: string
  status: string
  amount: number
  created_at: string
  current_period_start: string | null
  current_period_end: string | null
  razorpay_subscription_id: string | null
  owner_email: string
  owner_name: string | null
}

export type AuditLogRow = {
  id: string
  owner_id: string
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
  owner_email: string
  owner_name: string | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminData() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState<string>('')
  const [adminName, setAdminName] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([])

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [subsLoading, setSubsLoading] = useState(false)

  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }

      const { data: owner } = await supabase
        .from('owners')
        .select('is_admin, email, full_name')
        .eq('id', session.user.id)
        .single()

      if (!owner?.is_admin) { navigate('/dashboard'); return }

      setIsAdmin(true)
      setAdminEmail(owner.email)
      setAdminName(owner.full_name)
      setLoading(false)

      // Load all data
      fetchMetrics()
      fetchUsers()
      fetchSubscriptions()
      fetchAuditLogs()
    }
    checkAdmin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: activeBots },
      { count: activeSubs },
      { count: cancelledSubs },
      { count: newUsersWeek },
      { count: newUsersMonth },
      { count: sessionsToday },
      { count: sessionsMonth },
    ] = await Promise.all([
      supabase.from('owners').select('*', { count: 'exact', head: true }),
      supabase.from('owners').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('chatbots').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
      supabase.from('owners').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('owners').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('customer_sessions').select('*', { count: 'exact', head: true }).gte('last_activity_at', todayStart),
      supabase.from('customer_sessions').select('*', { count: 'exact', head: true }).gte('last_activity_at', monthStart),
    ])

    setMetrics({
      totalUsers: totalUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      activeBots: activeBots ?? 0,
      activeSubscriptions: activeSubs ?? 0,
      cancelledSubscriptions: cancelledSubs ?? 0,
      mrr: (activeSubs ?? 0) * 500,
      newUsersThisWeek: newUsersWeek ?? 0,
      newUsersThisMonth: newUsersMonth ?? 0,
      sessionsToday: sessionsToday ?? 0,
      sessionsThisMonth: sessionsMonth ?? 0,
    })
  }, [])

  // ── Users ───────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    const { data } = await (supabase.from('owners') as any)
      .select(`
        id, email, full_name, is_active, is_admin, created_at,
        plan_type, brand_name, brand_logo_url, brand_primary_color, max_clients, enterprise_id,
        chatbots (id, chatbot_name, is_active),
        subscriptions (id, status, amount, created_at, current_period_end)
      `)
      .order('created_at', { ascending: false })

    if (data) {
      const mapped: AdminUser[] = data.map((o: any) => ({
        id: o.id,
        email: o.email,
        full_name: o.full_name,
        is_active: o.is_active,
        is_admin: o.is_admin,
        created_at: o.created_at,
        plan_type: o.plan_type ?? 'individual',
        brand_name: o.brand_name ?? null,
        brand_logo_url: o.brand_logo_url ?? null,
        brand_primary_color: o.brand_primary_color ?? null,
        max_clients: o.max_clients ?? 0,
        enterprise_id: o.enterprise_id ?? null,
        chatbot: o.chatbots?.[0] ?? null,
        subscription: o.subscriptions?.[0] ?? null,
      }))
      setUsers(mapped)
      buildMonthlyData(mapped)
    }
    setUsersLoading(false)
  }, [])

  // ── Subscriptions ───────────────────────────────────────────────────────────
  const fetchSubscriptions = useCallback(async () => {
    setSubsLoading(true)
    const { data } = await supabase
      .from('subscriptions')
      .select(`
        id, owner_id, status, amount, created_at,
        current_period_start, current_period_end, razorpay_subscription_id
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (data) {
      // Enrich with owner info
      const ownerIds = [...new Set(data.map((s: any) => s.owner_id))]
      const { data: owners } = await supabase
        .from('owners')
        .select('id, email, full_name')
        .in('id', ownerIds)

      const ownerMap = new Map((owners ?? []).map((o: any) => [o.id, o]))
      const mapped: SubscriptionRow[] = data.map((s: any) => {
        const owner = ownerMap.get(s.owner_id)
        return {
          ...s,
          owner_email: owner?.email ?? '',
          owner_name: owner?.full_name ?? null,
        }
      })
      setSubscriptions(mapped)
    }
    setSubsLoading(false)
  }, [])

  // ── Audit logs ──────────────────────────────────────────────────────────────
  const fetchAuditLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('id, owner_id, action, resource_type, resource_id, metadata, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (data) {
      const ownerIds = [...new Set(data.map((l: any) => l.owner_id))]
      const { data: owners } = await supabase
        .from('owners')
        .select('id, email, full_name')
        .in('id', ownerIds)

      const ownerMap = new Map((owners ?? []).map((o: any) => [o.id, o]))
      const mapped: AuditLogRow[] = data.map((l: any) => {
        const owner = ownerMap.get(l.owner_id)
        return {
          ...l,
          owner_email: owner?.email ?? '',
          owner_name: owner?.full_name ?? null,
        }
      })
      setAuditLogs(mapped)
    }
    setLogsLoading(false)
  }, [])

  // ── Monthly chart data ──────────────────────────────────────────────────────
  const buildMonthlyData = useCallback((userList: AdminUser[]) => {
    const months: Record<string, MonthlyDataPoint> = {}
    const now = new Date()

    // Pre-populate last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[key] = {
        month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        newUsers: 0,
        newSubscriptions: 0,
        revenue: 0,
      }
    }

    userList.forEach(u => {
      const key = u.created_at.slice(0, 7)
      if (months[key]) months[key].newUsers++
      if (u.subscription) {
        const subKey = u.subscription.created_at.slice(0, 7)
        if (months[subKey]) {
          months[subKey].newSubscriptions++
          months[subKey].revenue += u.subscription.amount ?? 500
        }
      }
    })

    setMonthlyData(Object.values(months))
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleToggleUserActive = useCallback(async (userId: string, currentState: boolean) => {
    const { error } = await supabase
      .from('owners')
      .update({ is_active: !currentState })
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentState } : u))
    }
    return !error
  }, [])

  const handleSetEnterprise = useCallback(async (
    userId: string,
    data: { plan_type: string; brand_name: string; brand_logo_url: string; brand_primary_color: string; max_clients: number }
  ) => {
    const { error } = await (supabase.from('owners') as any)
      .update(data)
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u))
    }
    return !error
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }, [navigate])

  const refreshAll = useCallback(() => {
    fetchMetrics()
    fetchUsers()
    fetchSubscriptions()
    fetchAuditLogs()
  }, [fetchMetrics, fetchUsers, fetchSubscriptions, fetchAuditLogs])

  return {
    loading,
    isAdmin,
    adminEmail,
    adminName,
    metrics,
    monthlyData,
    users,
    usersLoading,
    subscriptions,
    subsLoading,
    auditLogs,
    logsLoading,
    handleToggleUserActive,
    handleSetEnterprise,
    handleLogout,
    refreshAll,
  }
}
