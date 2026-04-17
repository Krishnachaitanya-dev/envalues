import { Plus, GripVertical, MessageSquare, HelpCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SimpleStep } from '@/types/simpleFlow'

interface Props {
  steps: SimpleStep[]
  selectedStepId: string | null
  onSelectStep: (id: string) => void
  onAddMessageStep: () => void
  onAddQuestionStep: () => void
  onDeleteStep: (id: string) => void
}

export default function StepList({ steps, selectedStepId, onSelectStep, onAddMessageStep, onAddQuestionStep, onDeleteStep }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Steps</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {steps.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2">No steps yet.</p>
        )}
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 group transition-colors ${step.id === selectedStepId ? 'bg-primary/10 text-primary' : ''}`}
            onClick={() => onSelectStep(step.id)}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0 w-4 text-right">{i + 1}</span>
            {step.type === 'question'
              ? <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0" />
              : <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span className="text-xs truncate flex-1">
              {step.text.trim() || (step.type === 'question' ? 'Question' : 'Message')}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive shrink-0"
              onClick={e => { e.stopPropagation(); onDeleteStep(step.id) }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border space-y-1.5">
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={onAddMessageStep}>
          <Plus className="h-3.5 w-3.5" />
          Add message
        </Button>
        <Button size="sm" variant="ghost" className="w-full gap-1.5 text-xs text-muted-foreground" onClick={onAddQuestionStep}>
          <Plus className="h-3.5 w-3.5" />
          Add question
        </Button>
      </div>
    </div>
  )
}
