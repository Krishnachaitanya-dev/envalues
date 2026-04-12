import { useState } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { FlowTrigger, TriggerType } from '@/integrations/supabase/flow-types'

const TRIGGER_TYPES: { value: TriggerType; label: string; desc: string }[] = [
  { value: 'keyword', label: 'Keyword', desc: 'Triggered when a message matches a keyword' },
  { value: 'default', label: 'Default', desc: 'Triggered when no other flow matches' },
  { value: 'restart', label: 'Restart', desc: 'Triggered by a start-over keyword' },
  { value: 'api', label: 'API', desc: 'Triggered programmatically via API' },
]

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'

interface TriggerPanelProps {
  triggers: FlowTrigger[]
  flowId: string | null
  onAddTrigger: (trigger: Omit<FlowTrigger, 'id' | 'owner_id' | 'created_at'>) => Promise<void>
  onRemoveTrigger: (id: string) => Promise<void>
}

export default function TriggerPanel({ triggers, flowId, onAddTrigger, onRemoveTrigger }: TriggerPanelProps) {
  const [open, setOpen] = useState(false)
  const [triggerType, setTriggerType] = useState<TriggerType>('keyword')
  const [triggerValue, setTriggerValue] = useState('')
  const [priority, setPriority] = useState(0)
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!flowId) return
    if (triggerType !== 'default' && !triggerValue.trim()) return

    setSaving(true)
    try {
      await onAddTrigger({
        flow_id: flowId,
        target_node_id: null,
        trigger_type: triggerType,
        trigger_value: triggerType === 'default' ? null : triggerValue.trim(),
        priority,
        is_active: true,
        metadata: {},
      })
      setTriggerValue('')
      setPriority(0)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          title="Manage triggers"
        >
          <Zap size={13} className="text-yellow-400" />
          Triggers {triggers.length > 0 && <span className="text-primary">({triggers.length})</span>}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Flow Triggers</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {triggers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No triggers yet. Add one below.</p>
          )}
          {triggers.map((trigger) => (
            <div key={trigger.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
              <Zap size={11} className="text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground capitalize">{trigger.trigger_type}</p>
                {trigger.trigger_value && (
                  <p className="text-[10px] text-muted-foreground truncate">"{trigger.trigger_value}"</p>
                )}
              </div>
              <span className={`text-[9px] font-bold uppercase ${trigger.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                {trigger.is_active ? 'active' : 'off'}
              </span>
              <button
                onClick={() => void onRemoveTrigger(trigger.id)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-xs font-bold text-foreground">Add trigger</p>

          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={triggerType} onChange={(event) => setTriggerType(event.target.value as TriggerType)}>
              {TRIGGER_TYPES.map((trigger) => (
                <option key={trigger.value} value={trigger.value}>
                  {trigger.label} - {trigger.desc}
                </option>
              ))}
            </select>
          </div>

          {triggerType !== 'default' && (
            <div>
              <label className={labelCls}>Keyword or value</label>
              <input
                className={inputCls}
                value={triggerValue}
                onChange={(event) => setTriggerValue(event.target.value)}
                placeholder={triggerType === 'keyword' ? 'order, hi, help' : triggerType === 'restart' ? 'menu, start' : 'API trigger value'}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Priority (lower checked first)</label>
            <input type="number" className={inputCls} value={priority} min={0} onChange={(event) => setPriority(Number(event.target.value))} />
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Plus size={13} />
            {saving ? 'Adding...' : 'Add trigger'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
