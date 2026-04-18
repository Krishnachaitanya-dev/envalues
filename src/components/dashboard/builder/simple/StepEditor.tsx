import { useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Plus, X, Image as ImageIcon, Film, FileText, Youtube, Link2, Upload, Loader2,
} from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import type { SimpleStep, SimpleButton, SimpleMedia } from '@/types/simpleFlow'
import {
  MAX_SIMPLE_ATTACHMENTS,
  MAX_SIMPLE_BUTTON_TITLE,
  MAX_SIMPLE_LIST_OPTIONS,
  getQuestionResponseMode,
  isYouTubeUrl,
} from '@/types/simpleFlow'
import { uploadFlowNodeMedia, MAX_ATTACHMENT_CAPTION_LENGTH } from '@/features/flow-media/uploadFlowNodeMedia'

interface Props {
  step: SimpleStep
  steps?: SimpleStep[]
  ownerId: string | null
  flowId: string | null
  onChange: (updated: SimpleStep) => void
  onDelete?: (id: string) => void
}

export default function StepEditor({ step, steps = [step], ownerId, flowId, onChange, onDelete }: Props) {
  const update = (patch: Partial<SimpleStep>) => onChange({ ...step, ...patch })
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const attachments = step.attachments ?? []
  const choices = step.buttons ?? []
  const responseMode = step.type === 'question'
    ? getQuestionResponseMode(choices.filter(choice => choice.title.trim()).length)
    : null
  const canAddAttachment = attachments.length < MAX_SIMPLE_ATTACHMENTS
  const targetSteps = steps.filter(s => s.id !== step.id)

  const addChoice = () => {
    if (choices.length >= MAX_SIMPLE_LIST_OPTIONS) return
    const btn: SimpleButton = { id: crypto.randomUUID(), title: '', nextStepId: null }
    update({ type: 'question', mode: 'button_choices', buttons: [...choices, btn], nextStepId: undefined })
  }

  const updateBtn = (i: number, patch: Partial<SimpleButton>) =>
    update({ buttons: choices.map((b, j) => j === i ? { ...b, ...patch } : b), mode: 'button_choices' })

  const removeBtn = (i: number) => {
    const next = choices.filter((_, j) => j !== i)
    update({ buttons: next.length > 0 ? next : undefined, mode: next.length > 0 ? 'button_choices' : 'open_text' })
  }

  const addAttachment = (media: SimpleMedia) => {
    if (attachments.length >= MAX_SIMPLE_ATTACHMENTS) return
    update({ attachments: [...attachments, media] })
  }

  const updateAttachment = (id: string, patch: Partial<SimpleMedia>) => {
    update({ attachments: attachments.map(a => a.id === id ? { ...a, ...patch } : a) })
  }

  const removeAttachment = (id: string) => {
    update({ attachments: attachments.filter(a => a.id !== id) })
  }

  const handleFilePick = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const result = await uploadFlowNodeMedia({
        ownerId, flowId, nodeId: step.id, file,
        currentAttachmentCount: attachments.length,
      })
      addAttachment({
        id: result.id,
        type: result.type,
        url: result.url,
        source: 'upload',
        storage_path: result.storage_path,
      })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleAddUrl = () => {
    const url = urlDraft.trim()
    if (!url) return
    setUploadError(null)
    const youtube = isYouTubeUrl(url)
    addAttachment({
      id: crypto.randomUUID(),
      type: youtube ? 'youtube' : 'image',
      url,
      source: 'url',
    })
    setUrlDraft('')
  }

  return (
    <div className="flex flex-col gap-5 p-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {step.type === 'message' ? 'Message step'
            : step.type === 'end' ? 'End step'
              : responseMode === 'list' ? 'Question - list menu'
                : responseMode === 'buttons' ? 'Question - buttons'
                  : 'Question - open text'}
        </p>
        {onDelete && (
          <button
            onClick={() => { onDelete(step.id); toast.success('Step deleted') }}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Delete step
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">
          {step.type === 'question' ? 'Question text' : step.type === 'end' ? 'Final message' : 'Message text'}
        </Label>
        <Textarea
          value={step.text}
          onChange={e => update({ text: e.target.value })}
          placeholder={step.type === 'question'
            ? 'What would you like to ask?'
            : step.type === 'end'
              ? 'Thank you. Our team will contact you shortly.'
              : 'Type your message...'}
          className="text-sm resize-none min-h-[80px]"
          rows={3}
        />
      </div>

      {(step.type === 'message' || step.type === 'question') ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Attachments <span className="text-muted-foreground">(max {MAX_SIMPLE_ATTACHMENTS})</span></Label>
            <span className="text-[10px] text-muted-foreground">{attachments.length}/{MAX_SIMPLE_ATTACHMENTS}</span>
          </div>

          {attachments.map(a => (
            <AttachmentRow
              key={a.id}
              media={a}
              onCaptionChange={caption => updateAttachment(a.id, { caption })}
              onRemove={() => removeAttachment(a.id)}
            />
          ))}

          {canAddAttachment && (
            <div className="space-y-2 p-2 rounded-md border border-dashed border-border bg-background/50">
              <div className="flex flex-wrap gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/3gpp,application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { void handleFilePick(f); e.target.value = '' } }}
                />
                <Button
                  type="button" size="sm" variant="outline"
                  className="gap-1.5 text-xs h-7"
                  disabled={uploading || !ownerId || !flowId}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploading ? 'Uploading...' : 'Upload file'}
                </Button>
                <span className="text-[10px] text-muted-foreground self-center">JPG / PNG / MP4 / PDF</span>
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={urlDraft}
                  onChange={e => setUrlDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl() } }}
                  placeholder="Paste URL (image, video, YouTube, PDF)..."
                  className="text-xs h-7 flex-1"
                />
                <Button type="button" size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleAddUrl} disabled={!urlDraft.trim()}>
                  <Link2 className="h-3 w-3" /> Add
                </Button>
              </div>
              {(!ownerId || !flowId) && (
                <p className="text-[10px] text-muted-foreground">Save the flow once before uploading files.</p>
              )}
              {uploadError && <p className="text-[10px] text-destructive">{uploadError}</p>}
            </div>
          )}
        </div>
      ) : null}

      {step.type === 'question' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Choices <span className="text-muted-foreground">(optional)</span></Label>
            <span className="text-[10px] text-muted-foreground">
              {responseMode === 'list' ? 'Sends as list menu' : responseMode === 'buttons' ? 'Sends as buttons' : 'No choices = typed reply'}
            </span>
          </div>
          {choices.map((btn, i) => (
            <div key={btn.id} className="space-y-1.5">
              <div className="flex gap-2 items-start">
                <Input
                  value={btn.title}
                  onChange={e => updateBtn(i, { title: e.target.value.slice(0, MAX_SIMPLE_BUTTON_TITLE) })}
                  placeholder={`Option ${i + 1} label (${MAX_SIMPLE_BUTTON_TITLE} chars max)`}
                  className="text-xs h-8 flex-1"
                />
                <button onClick={() => removeBtn(i)} className="mt-1 p-1 text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 pl-1">
                <Label className="text-[10px] text-muted-foreground w-16 shrink-0">After pick</Label>
                <select
                  value={btn.nextStepId ?? ''}
                  onChange={e => updateBtn(i, { nextStepId: e.target.value || null })}
                  className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[11px] text-foreground"
                >
                  <option value="">End conversation</option>
                  {targetSteps.map(target => (
                    <option key={target.id} value={target.id}>
                      {(target.text.trim() || (target.type === 'question' ? 'Untitled question' : target.type === 'end' ? 'End' : 'Untitled message')).slice(0, 70)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {choices.length < MAX_SIMPLE_LIST_OPTIONS && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={addChoice}>
              <Plus className="h-3.5 w-3.5" /> Add option
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground">
            Add no choices for open text. Add 1-3 choices for WhatsApp buttons. Add 4+ choices for a WhatsApp list menu.
          </p>
        </div>
      )}

      {step.type !== 'question' && step.type !== 'end' && (
        <p className="text-[10px] text-muted-foreground">
          Drag from this step's handle on the canvas to connect it to the next step.
        </p>
      )}
      {step.type === 'end' && (
        <p className="text-[10px] text-muted-foreground">
          This step sends the final message and closes the conversation.
        </p>
      )}
    </div>
  )
}

function AttachmentRow({ media, onCaptionChange, onRemove }: {
  media: SimpleMedia
  onCaptionChange: (caption: string) => void
  onRemove: () => void
}) {
  const Icon = media.type === 'image' ? ImageIcon
    : media.type === 'video' ? Film
      : media.type === 'youtube' ? Youtube
        : FileText
  return (
    <div className="flex gap-2 p-2 rounded-md border border-border bg-background/40">
      <div className="shrink-0 h-16 w-16 rounded-md bg-muted flex items-center justify-center overflow-hidden">
        {media.type === 'image' && <img src={media.url} alt="" className="h-full w-full object-cover" />}
        {media.type === 'video' && <video src={media.url} className="h-full w-full object-cover" />}
        {media.type === 'youtube' && <Icon className="h-5 w-5 text-red-500" />}
        {media.type === 'document' && <Icon className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span className="capitalize">{media.type}</span>
          <span>/</span>
          <span className="truncate">{media.url.replace(/^https?:\/\//, '').slice(0, 40)}</span>
        </div>
        <Input
          value={media.caption ?? ''}
          onChange={e => onCaptionChange(e.target.value.slice(0, MAX_ATTACHMENT_CAPTION_LENGTH))}
          placeholder="Caption (optional)"
          className="text-xs h-7"
        />
      </div>
      <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
