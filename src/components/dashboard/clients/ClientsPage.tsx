import { useState } from 'react'
import { Users, Plus, RefreshCw, CheckCircle2, Ban, Bot, X, Send, Loader2, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { useDashboard } from '@/contexts/DashboardContext'
import { useClientsData } from '@/hooks/useClientsData'
import { useToast } from '@/hooks/use-toast'

export default function ClientsPage() {
  const { ownerData, isEnterprise } = useDashboard()
  const { clients, loading, inviting, inviteError, setInviteError, inviteClient, toggleClientActive, refresh } = useClientsData(ownerData?.id ?? null)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '' })
  const { toast } = useToast()

  if (!isEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Building2 size={36} className="text-muted-foreground/30" />
        <p className="text-sm font-semibold text-foreground">Enterprise plan required</p>
        <p className="text-xs text-muted-foreground">Contact support to upgrade your account.</p>
      </div>
    )
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = await inviteClient(form.email.trim(), form.full_name.trim())
    if (id) {
      toast({ title: 'Client invited!', description: `An invite email has been sent to ${form.email}` })
      setForm({ email: '', full_name: '' })
      setShowInvite(false)
    }
  }

  const maxClients = ownerData?.max_clients ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="font-display font-bold text-foreground">Clients</h2>
            <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {clients.length} / {maxClients}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your white-label client accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <RefreshCw size={13} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => { setShowInvite(true); setInviteError('') }}
            disabled={clients.length >= maxClients}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus size={13} /> Invite Client
          </button>
        </div>
      </div>

      {/* Usage bar */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Client Slots Used</p>
          <p className="text-xs text-muted-foreground">{clients.length} of {maxClients}</p>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: maxClients > 0 ? `${Math.min(100, (clients.length / maxClients) * 100)}%` : '0%' }}
          />
        </div>
        {clients.length >= maxClients && maxClients > 0 && (
          <p className="text-[10px] text-warning mt-1.5">Limit reached — contact support to increase your client limit.</p>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-card border border-primary/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus size={14} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground">Invite New Client</p>
            </div>
            <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text" required value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Ravi Kumar"
                  className="w-full px-3 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
            <p className="text-[10px] text-muted-foreground">An invite email will be sent. The client sets their own password and gets a branded dashboard.</p>
            <div className="flex gap-2">
              <button type="submit" disabled={inviting}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
                {inviting ? <><Loader2 size={12} className="animate-spin" /> Sending…</> : <><Send size={12} /> Send Invite</>}
              </button>
              <button type="button" onClick={() => setShowInvite(false)}
                className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Client list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
            <RefreshCw size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-8">
            <Users size={32} className="text-muted-foreground/20" />
            <p className="text-sm font-semibold text-foreground">No clients yet</p>
            <p className="text-xs text-muted-foreground">Invite your first client to get started</p>
            <button onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
              <Plus size={12} /> Invite Client
            </button>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Joined</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bot</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(c.full_name ?? c.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{c.full_name ?? '—'}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                    {format(new Date(c.created_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.chatbot ? (
                      <div className="flex items-center gap-1.5">
                        <Bot size={12} className={c.chatbot.is_active ? 'text-primary' : 'text-muted-foreground'} />
                        <span className={c.chatbot.is_active ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                          {c.chatbot.is_active ? 'Live' : 'Draft'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.is_active
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400"><CheckCircle2 size={11} /> Active</span>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400"><Ban size={11} /> Suspended</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => toggleClientActive(c.id, c.is_active)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                        c.is_active
                          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {c.is_active ? 'Suspend' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
