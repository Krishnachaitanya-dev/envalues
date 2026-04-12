import { TrendingUp, CreditCard, XCircle, IndianRupee } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { useAdmin } from '@/contexts/AdminContext'

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#94a3b8']

export default function AdminRevenue() {
  const { metrics, subscriptions, subsLoading, monthlyData } = useAdmin()

  // Sub status breakdown
  const statusBreakdown = (() => {
    const counts: Record<string, number> = {}
    subscriptions.forEach(s => {
      counts[s.status] = (counts[s.status] ?? 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  })()

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Revenue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Subscription and payment analytics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-3">
            <TrendingUp size={16} className="text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {metrics ? `₹${metrics.mrr.toLocaleString('en-IN')}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <CreditCard size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{metrics?.activeSubscriptions ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">Active Subscriptions</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
            <XCircle size={16} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{metrics?.cancelledSubscriptions ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">Cancelled</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
            <IndianRupee size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {metrics ? `₹${(metrics.mrr * 12).toLocaleString('en-IN')}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">ARR (Projected)</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly revenue bar */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Monthly Revenue (₹)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }}
                cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
              />
              <Bar dataKey="revenue" name="Revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Subscription status donut */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Subscription Breakdown</h2>
          {statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusBreakdown} cx="50%" cy="42%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {statusBreakdown.map((_, i) => (
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
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No subscriptions yet</div>
          )}
        </div>
      </div>

      {/* Subscription events table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">All Subscriptions</h2>
          <span className="text-xs text-muted-foreground">{subscriptions.length} records</span>
        </div>

        {subsLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Owner</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Razorpay ID</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Expires</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(s => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-foreground">{s.owner_name ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{s.owner_email}</p>
                    </td>
                    <td className="px-5 py-3"><SubStatusBadge status={s.status} /></td>
                    <td className="px-5 py-3 text-xs text-foreground hidden md:table-cell">
                      ₹{(s.amount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {s.razorpay_subscription_id ?? '—'}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {s.current_period_end ? format(new Date(s.current_period_end), 'd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {format(new Date(s.created_at), 'd MMM yyyy')}
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">No subscriptions yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-emerald-500/10 text-emerald-400',
    inactive:  'bg-muted text-muted-foreground',
    paused:    'bg-yellow-500/10 text-yellow-400',
    cancelled: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`text-[10px] font-bold capitalize px-2 py-0.5 rounded-full ${map[status] ?? map.inactive}`}>
      {status}
    </span>
  )
}
