import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ConditionType, FlowEdge } from '@/integrations/supabase/flow-types'

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: 'always', label: 'Always (default)' },
  { value: 'equals', label: 'Input equals' },
  { value: 'contains', label: 'Input contains' },
  { value: 'starts_with', label: 'Input starts with' },
  { value: 'regex', label: 'Input matches regex' },
  { value: 'variable_equals', label: 'Variable equals' },
  { value: 'variable_contains', label: 'Variable contains' },
]

interface EdgeConfigPanelProps {
  edge: FlowEdge | null
  onClose: () => void
  onUpdate: (edgeId: string, params: Partial<FlowEdge>) => Promise<void>
  onDelete: (edgeId: string) => Promise<void>
}

export default function EdgeConfigPanel({ edge, onClose, onUpdate, onDelete }: EdgeConfigPanelProps) {
  const [condType, setCondType] = useState<ConditionType>('always')
  const [condValue, setCondValue] = useState('')
  const [condVar, setCondVar] = useState('')
  const [condExpression, setCondExpression] = useState('')
  const [isFallback, setIsFallback] = useState(false)
  const [priority, setPriority] = useState(0)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!edge) return
    setCondType(edge.condition_type)
    setCondValue(edge.condition_value ?? '')
    setCondVar(edge.condition_variable ?? '')
    setCondExpression(edge.condition_expression ?? '')
    setIsFallback(edge.is_fallback)
    setPriority(edge.priority)
    setLabel(edge.label ?? '')
  }, [edge?.id])

  const handleSave = async () => {
    if (!edge) return
    setSaving(true)
    try {
      await onUpdate(edge.id, {
        condition_type: condType,
        condition_value: condType === 'always' ? null : condValue || null,
        condition_variable: condType === 'variable_equals' || condType === 'variable_contains' ? condVar || null : null,
        condition_expression: condExpression || null,
        is_fallback: isFallback,
        priority,
        label: label || null,
      })
    } finally {
      setSaving(false)
    }
  }

  if (!edge) {
    return (
      <aside className="w-72 shrink-0 border-l border-border bg-surface-raised flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center px-6">Click an edge to configure its condition.</p>
      </aside>
    )
  }

  const needsValue = condType !== 'always'
  const needsVar = condType === 'variable_equals' || condType === 'variable_contains'

  return (
    <aside className="w-72 shrink-0 border-l border-border bg-surface-raised flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Routing</p>
          <h2 className="text-sm font-bold text-foreground">Edge condition</h2>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className={labelCls}>Label</label>
          <input className={inputCls} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Optional edge label" />
        </div>

        <div>
          <label className={labelCls}>Condition type</label>
          <select className={inputCls} value={condType} onChange={(event) => setCondType(event.target.value as ConditionType)}>
            {CONDITION_TYPES.map((condition) => (
              <option key={condition.value} value={condition.value}>{condition.label}</option>
            ))}
          </select>
        </div>

        {needsValue && (
          <div>
            <label className={labelCls}>Value to match</label>
            <input className={inputCls} value={condValue} onChange={(event) => setCondValue(event.target.value)} placeholder="yes / order / .*help.*" />
          </div>
        )}

        {needsVar && (
          <div>
            <label className={labelCls}>Variable name</label>
            <input className={inputCls} value={condVar} onChange={(event) => setCondVar(event.target.value)} placeholder="customer_answer" />
          </div>
        )}

        <div>
          <label className={labelCls}>Advanced expression</label>
          <input className={inputCls} value={condExpression} onChange={(event) => setCondExpression(event.target.value)} placeholder="Optional expression" />
        </div>

        <div>
          <label className={labelCls}>Priority (lower checked first)</label>
          <input type="number" className={inputCls} value={priority} min={0} onChange={(event) => setPriority(Number(event.target.value))} />
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={isFallback} onChange={(event) => setIsFallback(event.target.checked)} />
          Fallback edge
        </label>
      </div>

      <div className="px-3 py-2.5 border-t border-border flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save condition'}
        </button>
        <button
          onClick={() => { if (confirm('Delete this edge?')) void onDelete(edge.id) }}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
        >
          Delete edge
        </button>
      </div>
    </aside>
  )
}
