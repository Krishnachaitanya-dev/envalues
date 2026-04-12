import { useState } from 'react'
import { Search, Download, RefreshCw, Users, Tag, X, Save, Loader2, MessageSquare, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '@/contexts/DashboardContext'
import { useContactsData, AVAILABLE_TAGS, Contact } from '@/hooks/useContactsData'
import { useToast } from '@/hooks/use-toast'

function maskPhone(phone: string) {
  if (phone.length <= 5) return phone
  return phone.slice(0, -5) + ' ●●●●●'
}

const TAG_COLORS: Record<string, string> = {
  'VIP':        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Follow-up':  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Interested': 'bg-green-500/15 text-green-400 border-green-500/30',
  'Blocked':    'bg-red-500/15 text-red-400 border-red-500/30',
}

// ── Contact detail panel ─────────────────────────────────────────────────────
function ContactPanel({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { saveNotes, toggleTag, saving } = useContactsData(null)
  const [notes, setNotes] = useState(contact.notes ?? '')
  const [saved, setSaved] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleSaveNotes = async () => {
    const ok = await saveNotes(contact.id, notes)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      toast({ title: 'Failed to save notes', variant: 'destructive' })
    }
  }

  const handleToggleTag = async (tag: string) => {
    await toggleTag(contact.id, tag)
  }

  return (
    <div className="w-80 shrink-0 border-l border-border flex flex-col bg-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Users size={14} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{maskPhone(contact.phone)}</p>
            <p className="text-[10px] text-muted-foreground">Last active {contact.last_active_ago}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Stats */}
        <div className="px-5 py-4 border-b border-border grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">{contact.total_messages}</p>
            <p className="text-[10px] text-muted-foreground">Messages</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-foreground">{format(new Date(contact.first_seen_at), 'dd MMM yy')}</p>
            <p className="text-[10px] text-muted-foreground">First seen</p>
          </div>
        </div>

        {/* Tags */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Tag size={10} /> Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map(tag => {
              const active = contact.tags.includes(tag)
              return (
                <button key={tag} onClick={() => handleToggleTag(tag)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    active
                      ? TAG_COLORS[tag]
                      : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/30'
                  }`}>
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Internal Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add private notes about this customer…"
            rows={4}
            className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
          />
          <button onClick={handleSaveNotes} disabled={saving}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : saved ? '✓ Saved' : <><Save size={12} /> Save Notes</>}
          </button>
          <p className="text-[9px] text-muted-foreground/50 mt-1.5 text-center">Notes are private — never sent to the customer</p>
        </div>

        {/* Jump to inbox */}
        <div className="px-5 py-4">
          <button
            onClick={() => navigate('/dashboard/inbox')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl hover:border-primary/30 hover:bg-muted/50 transition-all">
            <div className="flex items-center gap-2">
              <MessageSquare size={13} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">View in Inbox</span>
            </div>
            <ChevronRight size={13} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const { chatbot } = useDashboard()
  const { contacts, totalContacts, loading, search, setSearch, selectedTag, setSelectedTag, exportCSV, refresh } = useContactsData(chatbot?.id ?? null)
  const [selected, setSelected] = useState<Contact | null>(null)

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 rounded-2xl border border-border overflow-hidden bg-card">

      {/* ── Main table area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <span className="font-display font-bold text-sm text-foreground">Contacts</span>
            <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalContacts}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="p-2 rounded-lg hover:bg-muted/50 transition-colors" title="Refresh">
              <RefreshCw size={13} className="text-muted-foreground" />
            </button>
            <button onClick={exportCSV}
              className="inline-flex items-center gap-1.5 bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-muted/80 transition-colors">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input type="text" placeholder="Search by phone…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-muted/30 border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
          <div className="flex items-center gap-1.5">
            {['all', ...AVAILABLE_TAGS].map(tag => (
              <button key={tag} onClick={() => setSelectedTag(tag)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  selectedTag === tag
                    ? tag === 'all' ? 'bg-primary/10 text-primary border-primary/30' : TAG_COLORS[tag]
                    : 'bg-transparent text-muted-foreground border-transparent hover:border-border'
                }`}>
                {tag === 'all' ? 'All' : tag}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-8">
              <Users size={28} className="text-muted-foreground/30" />
              <p className="text-sm font-semibold text-foreground">No contacts yet</p>
              <p className="text-xs text-muted-foreground">Customers who message your bot will appear here automatically</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">First Seen</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Last Active</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Messages</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tags</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className={`border-b border-border/50 cursor-pointer transition-colors ${
                      selected?.id === c.id ? 'bg-primary/5' : 'hover:bg-muted/20'
                    }`}>
                    <td className="px-5 py-3 font-medium text-foreground">{maskPhone(c.phone)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(c.first_seen_at), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.last_active_ago}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.total_messages}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0
                          ? <span className="text-muted-foreground/40">—</span>
                          : c.tags.map(t => (
                              <span key={t} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${TAG_COLORS[t] ?? 'bg-muted text-muted-foreground border-border'}`}>{t}</span>
                            ))
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={13} className="text-muted-foreground/40" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Right: Contact detail panel ──────────────────────────────────── */}
      {selected && (
        <ContactPanel
          key={selected.id}
          contact={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
