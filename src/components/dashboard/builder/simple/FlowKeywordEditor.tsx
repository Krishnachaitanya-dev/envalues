import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'

interface Props {
  keywords: string[]
  onChange: (keywords: string[]) => void
}

export default function FlowKeywordEditor({ keywords, onChange }: Props) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const kw = draft.trim().toLowerCase()
    if (!kw || keywords.includes(kw)) { setDraft(''); return }
    onChange([...keywords, kw])
    setDraft('')
  }

  const remove = (kw: string) => onChange(keywords.filter(k => k !== kw))

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        Keywords — WhatsApp starts this conversation when a user sends these words
      </Label>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background min-h-[36px] items-center">
        {keywords.map(kw => (
          <span key={kw} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
            {kw}
            <button onClick={() => remove(kw)} className="hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
          placeholder={keywords.length ? '' : 'Type keyword, press Enter…'}
          className="flex-1 min-w-[140px] bg-transparent outline-none text-xs placeholder:text-muted-foreground"
        />
      </div>
      {keywords.length === 0 && (
        <p className="text-[11px] text-yellow-400/80">Add at least one keyword before publishing.</p>
      )}
    </div>
  )
}
