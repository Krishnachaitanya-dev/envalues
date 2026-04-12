import { useState, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { useAdmin } from '@/contexts/AdminContext'

const ACTION_COLORS: Record<string, string> = {
  create:   'bg-blue-500/10 text-blue-400',
  update:   'bg-yellow-500/10 text-yellow-400',
  delete:   'bg-red-500/10 text-red-400',
  login:    'bg-emerald-500/10 text-emerald-400',
  logout:   'bg-muted text-muted-foreground',
  payment:  'bg-violet-500/10 text-violet-400',
  webhook:  'bg-orange-500/10 text-orange-400',
}

function actionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k))
  return key ? ACTION_COLORS[key] : 'bg-muted text-muted-foreground'
}

export default function AdminActivity() {
  const { auditLogs, logsLoading } = useAdmin()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  // Distinct actions for filter dropdown
  const actions = useMemo(() => {
    const set = new Set(auditLogs.map(l => l.action))
    return ['all', ...Array.from(set).sort()]
  }, [auditLogs])

  const filtered = useMemo(() => {
    return auditLogs.filter(l => {
      const matchSearch =
        l.owner_email.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.resource_type.toLowerCase().includes(search.toLowerCase())

      const matchAction = actionFilter === 'all' || l.action === actionFilter

      return matchSearch && matchAction
    })
  }, [auditLogs, search, actionFilter])

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Activity Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Audit trail across all users — last 200 events
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, action, resource..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="text-sm bg-card border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            {actions.map(a => (
              <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total events', value: auditLogs.length },
          { label: 'Unique users', value: new Set(auditLogs.map(l => l.owner_id)).size },
          { label: 'Showing', value: filtered.length },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Logs table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {logsLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading audit logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Resource</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">IP</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden xl:table-cell">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'd MMM, HH:mm')}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-foreground">{log.owner_name ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{log.owner_email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <p className="text-xs text-foreground">{log.resource_type}</p>
                      {log.resource_id && (
                        <code className="text-[9px] text-muted-foreground">
                          {log.resource_id.slice(0, 8)}…
                        </code>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {log.ip_address ?? '—'}
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell">
                      {Object.keys(log.metadata).length > 0 ? (
                        <code className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded max-w-[200px] block truncate">
                          {JSON.stringify(log.metadata)}
                        </code>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      {search || actionFilter !== 'all' ? 'No logs match your filters' : 'No activity logged yet'}
                    </td>
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
