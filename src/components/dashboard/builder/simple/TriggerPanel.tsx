import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus, X, Zap, Trash2 } from 'lucide-react'
import type { SimpleTrigger, SimpleStep } from '@/types/simpleFlow'

interface Props {
  triggers: SimpleTrigger[]
  steps: SimpleStep[]
  onChange: (triggers: SimpleTrigger[]) => void
}

export default function TriggerPanel({ triggers, steps, onChange }: Props) {
  const stepLabel = (s: SimpleStep, i: number) =>
    s.text.trim().slice(0, 30) || (s.type === 'question' ? `Question ${i + 1}` : s.type === 'end' ? `End ${i + 1}` : `Message ${i + 1}`)

  const updateTrigger = (id: string, patch: Partial<SimpleTrigger>) =>
    onChange(triggers.map(t => t.id === id ? { ...t, ...patch } : t))

  const removeTrigger = (id: string) => onChange(triggers.filter(t => t.id !== id))

  const addTrigger = () => {
    const t: SimpleTrigger = {
      id: crypto.randomUUID(),
      keywords: [],
      targetStepId: steps[0]?.id ?? null,
    }
    onChange([...triggers, t])
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Triggers</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Keywords that start this flow. Each trigger can start at a different step.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {triggers.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No triggers yet. Add one to let WhatsApp start this flow.
          </p>
        )}

        {triggers.map(trigger => (
          <TriggerCard
            key={trigger.id}
            trigger={trigger}
            steps={steps}
            stepLabel={stepLabel}
            onUpdate={patch => updateTrigger(trigger.id, patch)}
            onRemove={() => removeTrigger(trigger.id)}
          />
        ))}
      </div>

      <div className="p-3 border-t border-border shrink-0">
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={addTrigger}>
          <Plus className="h-3.5 w-3.5" /> Add trigger
        </Button>
      </div>
    </div>
  )
}

function TriggerCard({ trigger, steps, stepLabel, onUpdate, onRemove }: {
  trigger: SimpleTrigger
  steps: SimpleStep[]
  stepLabel: (s: SimpleStep, i: number) => string
  onUpdate: (patch: Partial<SimpleTrigger>) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState('')

  const addKeyword = () => {
    const kw = draft.trim().toLowerCase()
    if (!kw || trigger.keywords.includes(kw)) { setDraft(''); return }
    onUpdate({ keywords: [...trigger.keywords, kw] })
    setDraft('')
  }

  const removeKeyword = (kw: string) =>
    onUpdate({ keywords: trigger.keywords.filter(k => k !== kw) })

  return (
    <div className="rounded-md border border-border bg-surface-raised p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-medium">Keyword trigger</span>
        </div>
        <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Keywords</Label>
        <div className="flex flex-wrap gap-1 p-1.5 rounded border border-input bg-background mt-1 min-h-[32px] items-center">
          {trigger.keywords.map(kw => (
            <span key={kw} className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword() } }}
            placeholder={trigger.keywords.length ? '' : 'Type, press Enter'}
            className="flex-1 min-w-[100px] bg-transparent outline-none text-[11px] placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Starts at step</Label>
        <select
          value={trigger.targetStepId ?? ''}
          onChange={e => onUpdate({ targetStepId: e.target.value || null })}
          className="mt-1 w-full text-[11px] h-7 rounded border border-input bg-background px-2 text-foreground"
        >
          <option value="">— pick a step —</option>
          {steps.map((s, i) => (
            <option key={s.id} value={s.id}>{stepLabel(s, i)}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
