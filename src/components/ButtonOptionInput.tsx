interface ButtonOption {
  id: number;
  button_text: string;
  answer: string;
}

interface ButtonOptionInputProps {
  option: ButtonOption;
  onChange: (id: number, field: string, value: string) => void;
  onRemove: (id: number) => void;
  canRemove: boolean;
}

function ButtonOptionInput({ option, onChange, onRemove, canRemove }: ButtonOptionInputProps) {
  const len = option.button_text.length
  const over = len > 20

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg bg-surface-raised border border-input text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'

  return (
    <div className="bg-muted/50 rounded-lg p-3 mb-2 border border-border hover:border-primary/15 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label</label>
              <span className={`text-[10px] font-mono tabular-nums ${over ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                {len}/20
              </span>
            </div>
            <input
              type="text"
              value={option.button_text}
              onChange={(e) => onChange(option.id, 'button_text', e.target.value)}
              className={inputCls + (over ? ' border-destructive' : '')}
              placeholder="Button text"
              maxLength={30}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Response</label>
            <textarea
              value={option.answer}
              onChange={(e) => onChange(option.id, 'answer', e.target.value)}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="Message when tapped"
            />
          </div>
        </div>
        {canRemove && (
          <button type="button" onClick={() => onRemove(option.id)}
            className="mt-5 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default ButtonOptionInput
