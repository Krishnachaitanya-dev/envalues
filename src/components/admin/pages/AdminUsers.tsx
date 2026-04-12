import { useState, useMemo, useRef } from 'react'
import { Search, ShieldCheck, Ban, CheckCircle2, Building2, ChevronDown, ChevronUp, Loader2, Upload, X } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { format } from 'date-fns'
import { useAdmin } from '@/contexts/AdminContext'
import { toast } from 'sonner'

type Filter = 'all' | 'live' | 'draft' | 'banned' | 'enterprise'

export default function AdminUsers() {
  const { users, usersLoading, handleToggleUserActive, handleSetEnterprise } = useAdmin()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [expandedEnterprise, setExpandedEnterprise] = useState<string | null>(null)
  const [enterpriseForms, setEnterpriseForms] = useState<Record<string, { plan_type: string; brand_name: string; brand_logo_url: string; brand_primary_color: string; max_clients: number }>>({})
  const [savingEnterprise, setSavingEnterprise] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null)
  const logoInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleLogoUpload = async (userId: string, file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    setUploadingLogo(userId)
    const ext = file.name.split('.').pop()
    const path = `brand-logos/${userId}.${ext}`
    const { error } = await supabase.storage.from('chatbot-media').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { toast.error('Upload failed: ' + error.message); setUploadingLogo(null); return }
    const { data } = supabase.storage.from('chatbot-media').getPublicUrl(path)
    setEnterpriseForms(f => ({ ...f, [userId]: { ...getEnterpriseForm(users.find(u => u.id === userId)!), brand_logo_url: data.publicUrl } }))
    setUploadingLogo(null)
    toast.success('Logo uploaded')
  }

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())

      const matchFilter =
        filter === 'all' ? true :
        filter === 'live' ? u.chatbot?.is_active === true :
        filter === 'draft' ? (u.chatbot?.is_active === false || !u.chatbot) :
        filter === 'banned' ? !u.is_active :
        filter === 'enterprise' ? u.plan_type === 'enterprise' :
        true

      return matchSearch && matchFilter
    })
  }, [users, search, filter])

  const getEnterpriseForm = (u: typeof users[0]) => {
    return enterpriseForms[u.id] ?? {
      plan_type: u.plan_type,
      brand_name: u.brand_name ?? '',
      brand_logo_url: u.brand_logo_url ?? '',
      brand_primary_color: u.brand_primary_color ?? '#25D366',
      max_clients: u.max_clients,
    }
  }

  const handleSaveEnterprise = async (userId: string) => {
    setSavingEnterprise(userId)
    const form = getEnterpriseForm(users.find(u => u.id === userId)!)
    const success = await handleSetEnterprise(userId, form)
    setSavingEnterprise(null)
    if (success) {
      toast.success('Enterprise settings saved')
      setExpandedEnterprise(null)
    } else {
      toast.error('Failed to save settings')
    }
  }

  const handleToggle = async (userId: string, isActive: boolean, email: string) => {
    setTogglingId(userId)
    const success = await handleToggleUserActive(userId, isActive)
    setTogglingId(null)
    if (success) {
      toast.success(isActive ? `${email} has been banned` : `${email} has been re-activated`)
    } else {
      toast.error('Action failed. Please try again.')
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} total users
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl border border-border self-start">
          {(['all', 'live', 'draft', 'banned', 'enterprise'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                filter === f
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {usersLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Joined</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Bot</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Subscription</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <>
                  <tr key={u.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {(u.full_name ?? u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-foreground text-xs truncate">{u.full_name ?? '—'}</p>
                            {u.is_admin && <ShieldCheck size={11} className="text-violet-400 shrink-0" />}
                            {u.plan_type === 'enterprise' && <Building2 size={11} className="text-amber-400 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                      {format(new Date(u.created_at), 'd MMM yyyy')}
                    </td>

                    {/* Bot */}
                    <td className="px-5 py-3.5">
                      {u.chatbot ? (
                        <div>
                          <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{u.chatbot.chatbot_name}</p>
                          <div className="mt-0.5">
                            {u.chatbot.is_active ? (
                              <span className="text-[10px] font-bold text-primary">● Live</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">● Draft</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No bot</span>
                      )}
                    </td>

                    {/* Subscription */}
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <SubBadge status={u.subscription?.status} />
                    </td>

                    {/* Account status */}
                    <td className="px-5 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400">
                          <Ban size={12} /> Banned
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {!u.is_admin && (
                          <button
                            onClick={() => handleToggle(u.id, u.is_active, u.email)}
                            disabled={togglingId === u.id}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                              u.is_active
                                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {togglingId === u.id ? '...' : u.is_active ? 'Ban' : 'Unban'}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedEnterprise(expandedEnterprise === u.id ? null : u.id)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors inline-flex items-center gap-1"
                        >
                          <Building2 size={10} /> Enterprise
                          {expandedEnterprise === u.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Enterprise settings panel */}
                  {expandedEnterprise === u.id && (
                    <tr key={`${u.id}-enterprise`} className="bg-amber-500/3 border-b border-amber-500/10">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5"><Building2 size={12} /> Enterprise Settings</p>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Plan Type</label>
                              <select
                                value={getEnterpriseForm(u).plan_type}
                                onChange={e => setEnterpriseForms(f => ({ ...f, [u.id]: { ...getEnterpriseForm(u), plan_type: e.target.value } }))}
                                className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                              >
                                <option value="individual">Individual</option>
                                <option value="enterprise">Enterprise</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Brand Name</label>
                              <input type="text" value={getEnterpriseForm(u).brand_name}
                                onChange={e => setEnterpriseForms(f => ({ ...f, [u.id]: { ...getEnterpriseForm(u), brand_name: e.target.value } }))}
                                placeholder="e.g. TechCorp Bot"
                                className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Max Clients</label>
                              <input type="number" min={0} value={getEnterpriseForm(u).max_clients}
                                onChange={e => setEnterpriseForms(f => ({ ...f, [u.id]: { ...getEnterpriseForm(u), max_clients: parseInt(e.target.value) || 0 } }))}
                                className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Logo</label>
                              <input ref={el => { logoInputRefs.current[u.id] = el }} type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(u.id, f) }} />
                              <div className="flex items-center gap-2">
                                {getEnterpriseForm(u).brand_logo_url && (
                                  <img src={getEnterpriseForm(u).brand_logo_url} alt="logo" className="w-8 h-8 rounded object-contain border border-border bg-card" />
                                )}
                                <input type="url" value={getEnterpriseForm(u).brand_logo_url}
                                  onChange={e => setEnterpriseForms(f => ({ ...f, [u.id]: { ...getEnterpriseForm(u), brand_logo_url: e.target.value } }))}
                                  placeholder="https://... or upload image"
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
                                <button type="button" onClick={() => logoInputRefs.current[u.id]?.click()}
                                  disabled={uploadingLogo === u.id}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                                  {uploadingLogo === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                </button>
                                {getEnterpriseForm(u).brand_logo_url && (
                                  <button type="button" onClick={() => setEnterpriseForms(f => ({ ...f, [u.id]: { ...getEnterpriseForm(u), brand_logo_url: '' } }))}
                                    className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Brand Color</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={getEnterpriseForm(u).brand_primary_color}
                                  onChange={e => setEnterpriseForms(f => ({ ...f, [u.id]: { ...getEnterpriseForm(u), brand_primary_color: e.target.value } }))}
                                  className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent" />
                                <input type="text" value={getEnterpriseForm(u).brand_primary_color}
                                  onChange={e => setEnterpriseForms(f => ({ ...f, [u.id]: { ...getEnterpriseForm(u), brand_primary_color: e.target.value } }))}
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleSaveEnterprise(u.id)} disabled={savingEnterprise === u.id}
                            className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                            {savingEnterprise === u.id ? <><Loader2 size={11} className="animate-spin" /> Saving…</> : 'Save Enterprise Settings'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      {search ? `No users match "${search}"` : 'No users found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {users.length} users
      </p>
    </div>
  )
}

function SubBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Active',    cls: 'bg-emerald-500/10 text-emerald-400' },
    inactive:  { label: 'Inactive',  cls: 'bg-muted text-muted-foreground' },
    paused:    { label: 'Paused',    cls: 'bg-yellow-500/10 text-yellow-400' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-500/10 text-red-400' },
  }
  const s = map[status ?? 'inactive'] ?? map.inactive
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}
