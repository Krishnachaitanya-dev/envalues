import { useState, useEffect } from 'react'
import { Calendar, Clock, Plus, RefreshCw, X, Loader2, Send } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

type Reminder = {
  id: string
  phone: string
  message: string
  scheduled_at: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  error: string | null
  sent_at: string | null
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  sent:      'text-green-400 bg-green-500/10 border-green-500/20',
  failed:    'text-red-400 bg-red-500/10 border-red-500/20',
  cancelled: 'text-muted-foreground bg-muted/50 border-border',
}

export default function AdminEvolutionScheduler() {
  const { toast } = useToast()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  const loadReminders = async () => {
    setLoading(true)
    const { data } = await (supabase.from('evolution_reminders') as any)
      .select('*')
      .order('scheduled_at', { ascending: true })
    setReminders((data ?? []) as Reminder[])
    setLoading(false)
  }

  const createReminder = async () => {
    if (!phone.trim() || !message.trim() || !scheduledAt) return
    setSaving(true)
    try {
      const { error } = await (supabase.from('evolution_reminders') as any).insert({
        phone: phone.trim(),
        message: message.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: 'pending',
      })
      if (error) throw error
      toast({ title: 'Reminder scheduled!' })
      setPhone('')
      setMessage('')
      setScheduledAt('')
      loadReminders()
    } catch (err: any) {
      toast({ title: 'Failed to schedule', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const cancelReminder = async (id: string) => {
    await (supabase.from('evolution_reminders') as any)
      .update({ status: 'cancelled' })
      .eq('id', id)
    setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
  }

  useEffect(() => { loadReminders() }, [])

  const pending = reminders.filter(r => r.status === 'pending')
  const past = reminders.filter(r => r.status !== 'pending')

  // Min datetime = now (can't schedule in past)
  const minDatetime = new Date(Date.now() + 60000).toISOString().slice(0, 16)

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Create form ────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Calendar size={16} className="text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Schedule New Reminder</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Phone Number (with country code)</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="919876543210"
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Date & Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={minDatetime}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Hi! This is a reminder that your appointment is tomorrow at 3pm. Reply STOP to unsubscribe."
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{message.length} characters</p>
          </div>
        </div>

        <button
          onClick={createReminder}
          disabled={!phone.trim() || !message.trim() || !scheduledAt || saving}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? 'Scheduling…' : 'Schedule Reminder'}
        </button>
      </div>

      {/* ── Pending reminders ──────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-yellow-400" />
            <h2 className="font-semibold text-foreground text-sm">
              Pending <span className="text-muted-foreground font-normal">({pending.length})</span>
            </h2>
          </div>
          <button onClick={loadReminders} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <RefreshCw size={13} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 size={15} className="animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No pending reminders</p>
        ) : (
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-semibold text-foreground">{r.phone}</span>
                    <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full font-bold">
                      PENDING
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2">{r.message}</p>
                  <div className="flex items-center gap-1">
                    <Calendar size={10} className="text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/70">
                      {format(new Date(r.scheduled_at), 'MMM d, yyyy · h:mm a')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => cancelReminder(r.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                  title="Cancel"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Past reminders ─────────────────────────────────────── */}
      {past.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send size={14} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">
              History <span className="text-muted-foreground font-normal">({past.length})</span>
            </h2>
          </div>
          <div className="space-y-2">
            {past.map(r => (
              <div key={r.id} className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-foreground">{r.phone}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border capitalize ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{r.message}</p>
                  <div className="flex items-center gap-1">
                    <Clock size={10} className="text-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground/50">
                      {format(new Date(r.scheduled_at), 'MMM d, yyyy · h:mm a')}
                    </span>
                  </div>
                  {r.error && <p className="text-[10px] text-red-400 mt-1">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
