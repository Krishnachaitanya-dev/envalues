import { Users, Bot, CreditCard, TrendingUp, MessageSquare, UserPlus } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useAdmin } from '@/contexts/AdminContext'
import { format } from 'date-fns'

// ─── KPI Card ────────────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}

function KpiCard({ label, value, sub, icon: Icon, color }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Pie colours ────────────────────────────────────────────────────────────

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1']

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminOverview() {
  const { metrics, monthlyData, users } = useAdmin()

  // Subscription status breakdown for pie chart
  const subStatusData = (() => {
    const counts: Record<string, number> = {}
    users.forEach(u => {
      const status = u.subscription?.status ?? 'inactive'
      counts[status] = (counts[status] ?? 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  })()

  // Recent signups
  const recentSignups = [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time snapshot of Envalues</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Users"
          value={metrics?.totalUsers ?? '—'}
          sub={`${metrics?.newUsersThisWeek ?? 0} this week`}
          icon={Users}
          color="bg-blue-500/10 text-blue-400"
        />
        <KpiCard
          label="Active Bots"
          value={metrics?.activeBots ?? '—'}
          sub={`of ${metrics?.totalUsers ?? 0} users`}
          icon={Bot}
          color="bg-primary/10 text-primary"
        />
        <KpiCard
          label="Active Subscriptions"
          value={metrics?.activeSubscriptions ?? '—'}
          icon={CreditCard}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <KpiCard
          label="MRR"
          value={metrics ? `₹${metrics.mrr.toLocaleString('en-IN')}` : '—'}
          sub="Monthly Recurring Revenue"
          icon={TrendingUp}
          color="bg-yellow-500/10 text-yellow-400"
        />
        <KpiCard
          label="Sessions Today"
          value={metrics?.sessionsToday ?? '—'}
          sub={`${metrics?.sessionsThisMonth ?? 0} this month`}
          icon={MessageSquare}
          color="bg-violet-500/10 text-violet-400"
        />
        <KpiCard
          label="New Users"
          value={metrics?.newUsersThisMonth ?? '—'}
          sub="This month"
          icon={UserPlus}
          color="bg-rose-500/10 text-rose-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* User growth bar chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">User & Subscription Growth</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }}
                cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="newUsers" name="New Users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="newSubscriptions" name="New Subscriptions" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Subscription status pie */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Subscription Status</h2>
          {subStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={subStatusData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {subStatusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          )}
        </div>
      </div>

      {/* Revenue line chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Monthly Revenue Trend (₹)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }}
            />
            <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent signups */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Signups</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">User</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Signed up</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Bot Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Subscription</th>
            </tr>
          </thead>
          <tbody>
            {recentSignups.map(u => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {(u.full_name ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-xs truncate">{u.full_name ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground hidden md:table-cell">
                  {format(new Date(u.created_at), 'd MMM yyyy')}
                </td>
                <td className="px-5 py-3">
                  {u.chatbot?.is_active ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Live
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Draft</span>
                  )}
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <SubStatusBadge status={u.subscription?.status} />
                </td>
              </tr>
            ))}
            {recentSignups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">No users yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SubStatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Active',    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    inactive:  { label: 'Inactive',  cls: 'bg-muted text-muted-foreground border-border' },
    paused:    { label: 'Paused',    cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  }
  const s = map[status ?? 'inactive'] ?? map.inactive
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
  )
}
