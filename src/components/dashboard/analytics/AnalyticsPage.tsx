import { MessageSquare, Users, TrendingUp, CalendarDays, RefreshCw } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useDashboard } from '@/contexts/DashboardContext'
import { useAnalyticsData } from '@/hooks/useAnalyticsData'

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold font-display text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-display font-semibold text-sm text-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { chatbot } = useDashboard()
  const {
    totalConversations, conversationsToday, conversationsThisWeek,
    uniqueCustomers, daily, peakHours, topNodes, loading, error,
  } = useAnalyticsData(chatbot?.id ?? null)

  const GREEN = '#25D366'
  const MUTED = '#6b7280'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  // Peak hour label for sub-text
  const peakHour = peakHours.reduce((best, h) => h.count > best.count ? h : best, { hour: '—', count: 0 })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Analytics</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Conversation data for the last 90 days</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Conversations" value={totalConversations} icon={MessageSquare} color="bg-primary" />
        <KpiCard label="Unique Customers" value={uniqueCustomers} icon={Users} color="bg-blue-500" />
        <KpiCard label="This Week" value={conversationsThisWeek} sub="last 7 days" icon={TrendingUp} color="bg-violet-500" />
        <KpiCard label="Today" value={conversationsToday} sub={new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} icon={CalendarDays} color="bg-amber-500" />
      </div>

      {/* Daily conversations chart */}
      <Section title="Daily Conversations — Last 30 Days">
        {totalConversations === 0 ? (
          <EmptyState message="No conversations yet. Share your WhatsApp number to get started." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }}
                interval={4} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="conversations" name="Conversations"
                stroke={GREEN} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: GREEN }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Bottom row: Top nodes + Peak hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top nodes */}
        <Section title="Most Visited Menu Items">
          {topNodes.length === 0 ? (
            <EmptyState message="No flow data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topNodes} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: MUTED }}
                  tickLine={false} axisLine={false} width={90}
                  tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Visits" radius={[0, 4, 4, 0]}>
                  {topNodes.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? GREEN : `${GREEN}${Math.max(40, 99 - i * 12).toString(16)}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Peak hours */}
        <Section title={`Peak Hours${peakHour.count > 0 ? ` · Busiest: ${peakHour.hour}` : ''}`}>
          {totalConversations === 0 ? (
            <EmptyState message="No data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peakHours} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: MUTED }}
                  interval={2} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Conversations" fill={GREEN} radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-28 text-center">
      <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
    </div>
  )
}
