import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ConditionType, FlowEdge } from '@/integrations/supabase/flow-types'
import { toast } from '@/components/ui/sonner'
import { formatError } from '@/lib/formatError'

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
  onDirtyChange?: (dirty: boolean) => void
}

export default function EdgeConfigPanel({ edge, onClose, onUpdate, onDelete, onDirtyChange }: EdgeConfigPanelProps) {
  const [condType, setCondType] = useState<ConditionType>('always')
  const [condValue, setCondValue] = useState('')
  const [condVar, setCondVar] = useState('')
  const [condExpression, setCondExpression] = useState('')
  const [isFallback, setIsFallback] = useState(false)
  const [priority, setPriority] = useState(0)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialSnapshot, setInitialSnapshot] = useState('')

  useEffect(() => {
    if (!edge) {
      onDirtyChange?.(false)
      return
    }
    setCondType(edge.condition_type)
    setCondValue(edge.condition_value ?? '')
    setCondVar(edge.condition_variable ?? '')
    setCondExpression(edge.condition_expression ?? '')
    setIsFallback(edge.is_fallback)
    setPriority(edge.priority)
    setLabel(edge.label ?? '')
    setInitialSnapshot(snapshotEdge(edge))
    onDirtyChange?.(false)
  }, [edge?.id])

  const currentSnapshot = JSON.stringify({
    condition_type: condType,
    condition_value: condValue,
    condition_variable: condVar,
    condition_expression: condExpression,
    is_fallback: isFallback,
    priority,
    label,
  })
  const dirty = Boolean(edge) && currentSnapshot !== initialSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const handleClose = () => {
    if (dirty && !confirm('Discard unsaved edge changes?')) return
    onDirtyChange?.(false)
    onClose()
  }

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
      setInitialSnapshot(currentSnapshot)
      onDirtyChange?.(false)
    } finally {
      setSaving(false)
    }
  }

  if (!edge) {
    return null
  }

  const needsValue = condType !== 'always'
  const needsVar = condType === 'variable_equals' || condType === 'variable_contains'

  return (
    <aside className="fixed inset-x-0 sm:left-auto sm:right-0 top-[52px] bottom-0 z-40 mobile-sheet border-l border-border bg-surface-raised shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Routing</p>
          <h2 className="text-base font-bold text-foreground">Edge condition</h2>
        </div>
        <button onClick={handleClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        <div className="rounded-2xl border border-border bg-card p-3">
          <label className={labelCls}>Label</label>
          <input className={inputCls} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Optional edge label" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-3">
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

      <div className="px-3 sm:px-4 py-3 border-t border-border bg-card/80 backdrop-blur flex flex-col gap-2 safe-area-page">
        {dirty && <p className="text-[10px] text-amber-600 font-semibold">Unsaved changes</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save condition'}
        </button>
        <button
          onClick={() => {
            if (deleting) return
            if (!confirm('Delete this edge?')) return
            setDeleting(true)
            void toast.promise(onDelete(edge.id), {
              loading: 'Deleting edge...',
              success: 'Edge deleted',
              error: (err) => `Delete failed: ${formatError(err)}`,
            }).finally(() => setDeleting(false))
          }}
          disabled={deleting}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete edge'}
        </button>
      </div>
    </aside>
  )
}

function snapshotEdge(edge: FlowEdge) {
  return JSON.stringify({
    condition_type: edge.condition_type,
    condition_value: edge.condition_value ?? '',
    condition_variable: edge.condition_variable ?? '',
    condition_expression: edge.condition_expression ?? '',
    is_fallback: edge.is_fallback,
    priority: edge.priority,
    label: edge.label ?? '',
  })
}
