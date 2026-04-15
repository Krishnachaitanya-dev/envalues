import { Shield, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { useAdmin } from '@/contexts/AdminContext'

export default function AdminSecurity() {
  const { users } = useAdmin()

  // Banned users
  const bannedUsers = users.filter(u => !u.is_active && !u.is_admin)

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Security</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Account security, banned users, and platform health</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Shield size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{users.filter(u => u.is_active).length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Accounts</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{bannedUsers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Banned Accounts</p>
          </div>
        </div>
      </div>

      {/* Banned users */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden mobile-table-scroll">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Banned Users</h2>
        </div>
        {bannedUsers.length === 0 ? (
          <div className="py-12 text-center">
            <Shield size={24} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No banned users</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">User</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Joined</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Subscription</th>
              </tr>
            </thead>
            <tbody>
              {bannedUsers.map(u => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-foreground">{u.full_name ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {format(new Date(u.created_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground capitalize">
                    {u.subscription?.status ?? 'inactive'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground">
        Security events and rate-limit logs are managed by the service role and are not accessible from the frontend.
        Check your Supabase dashboard for raw <code className="bg-muted px-1 rounded">security_events</code> and <code className="bg-muted px-1 rounded">rate_limits</code> table data.
      </p>
    </div>
  )
}
