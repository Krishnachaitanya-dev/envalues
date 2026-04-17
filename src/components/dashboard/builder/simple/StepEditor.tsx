import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus, X, AlertTriangle } from 'lucide-react'
import type { SimpleStep, SimpleButton } from '@/types/simpleFlow'

interface Props {
  step: SimpleStep
  allSteps: SimpleStep[]
  onChange: (updated: SimpleStep) => void
}

export default function StepEditor({ step, allSteps, onChange }: Props) {
  const others = allSteps.filter(s => s.id !== step.id)
  const update = (patch: Partial<SimpleStep>) => onChange({ ...step, ...patch })

  const addButton = () => {
    if ((step.buttons?.length ?? 0) >= 3) return
    const btn: SimpleButton = { id: crypto.randomUUID(), title: '', nextStepId: null }
    update({ buttons: [...(step.buttons ?? []), btn] })
  }

  const updateBtn = (i: number, patch: Partial<SimpleButton>) =>
    update({ buttons: (step.buttons ?? []).map((b, j) => j === i ? { ...b, ...patch } : b) })

  const removeBtn = (i: number) =>
    update({ buttons: (step.buttons ?? []).filter((_, j) => j !== i) })

  const stepLabel = (s: SimpleStep) =>
    s.text.trim().slice(0, 35) || (s.type === 'question' ? 'Question' : 'Message')

  return (
    <div className="flex flex-col gap-5 p-5 overflow-y-auto h-full">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {step.type === 'message' ? 'Message step'
          : step.mode === 'button_choices' ? 'Question — button choices'
          : 'Question — open text'}
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs">{step.type === 'question' ? 'Question text' : 'Message text'}</Label>
        <Textarea
          value={step.text}
          onChange={e => update({ text: e.target.value })}
          placeholder={step.type === 'question' ? 'What would you like to ask?' : 'Type your message…'}
          className="text-sm resize-none min-h-[80px]"
          rows={3}
        />
      </div>

      {step.mode === 'button_choices' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Reply buttons <span className="text-muted-foreground">(max 3, WhatsApp)</span></Label>
            {(step.buttons?.length ?? 0) > 3 && (
              <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                <AlertTriangle className="h-3 w-3" /> Max 3
              </span>
            )}
          </div>
          {(step.buttons ?? []).map((btn, i) => (
            <div key={btn.id} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input
                  value={btn.title}
                  onChange={e => updateBtn(i, { title: e.target.value.slice(0, 20) })}
                  placeholder={`Button ${i + 1} label (20 chars max)`}
                  className="text-xs h-8"
                />
                <select
                  value={btn.nextStepId ?? ''}
                  onChange={e => updateBtn(i, { nextStepId: e.target.value || null })}
                  className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="">→ End conversation</option>
                  {others.map(s => <option key={s.id} value={s.id}>→ {stepLabel(s)}</option>)}
                </select>
              </div>
              <button onClick={() => removeBtn(i)} className="mt-1 p-1 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {(step.buttons?.length ?? 0) < 3 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={addButton}>
              <Plus className="h-3.5 w-3.5" /> Add button
            </Button>
          )}
        </div>
      )}

      {step.mode !== 'button_choices' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Next step</Label>
          <select
            value={step.nextStepId ?? ''}
            onChange={e => update({ nextStepId: e.target.value || null })}
            className="w-full text-sm h-9 rounded-md border border-input bg-background px-3 text-foreground"
          >
            <option value="">End conversation</option>
            {others.map(s => <option key={s.id} value={s.id}>{stepLabel(s)}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
