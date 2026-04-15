import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, FileText, Image, Loader2, Paperclip, RotateCw, Trash2, Video, X } from 'lucide-react'
import {
  deleteFlowNodeMedia,
  buildMessageConfigForSave,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_QUICK_REPLY_BUTTONS_PER_MESSAGE,
  MAX_QUICK_REPLY_BUTTON_TITLE_LENGTH,
  uploadFlowNodeMedia,
  validateAttachmentCaption,
  normalizeMessageMediaConfig,
  type FlowAttachmentType,
  type FlowMediaAttachment,
  type FlowMessageLink,
} from '@/features/flow-media/uploadFlowNodeMedia'
import type { Flow, FlowNode, NodeType } from '@/integrations/supabase/flow-types'

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'
const cardCls = 'rounded-2xl border border-border bg-card p-3 space-y-3'

const ACCEPT_MAP: Record<FlowAttachmentType, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/3gpp',
  document: 'application/pdf',
}

interface QuickReplyButton {
  id: string
  title: string
}

interface NodeConfigPanelProps {
  node: FlowNode | null
  ownerId: string | null
  flowId: string | null
  flows: Flow[]
  allNodes: FlowNode[]
  onClose: () => void
  onUpdateConfig: (nodeId: string, params: Partial<Pick<FlowNode, 'label' | 'config'>>) => Promise<void>
  onDeleteNode: (nodeId: string) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}

function fieldLabel(nodeType: NodeType) {
  return nodeType.charAt(0).toUpperCase() + nodeType.slice(1)
}

export default function NodeConfigPanel({
  node,
  ownerId,
  flowId,
  flows,
  allNodes,
  onClose,
  onUpdateConfig,
  onDeleteNode,
  onDirtyChange,
}: NodeConfigPanelProps) {
  const [label, setLabel] = useState('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [attachments, setAttachments] = useState<FlowMediaAttachment[]>([])
  const [links, setLinks] = useState<FlowMessageLink[]>([])
  const [attachmentType, setAttachmentType] = useState<FlowAttachmentType>('image')
  const [mediaUrl, setMediaUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [failedFile, setFailedFile] = useState<File | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [unsavedUploadPaths, setUnsavedUploadPaths] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialSnapshot = useRef('')

  useEffect(() => {
    if (!node) {
      onDirtyChange?.(false)
      return
    }
    setLabel(node.label ?? '')
    setConfig(node.config ?? {})
    const media = normalizeMessageMediaConfig(node.config ?? {})
    setAttachments(media.attachments)
    setLinks(media.links)
    setUploadError('')
    setFailedFile(null)
    setRetryCount(0)
    setUnsavedUploadPaths([])
    initialSnapshot.current = snapshotNodeState(node.label ?? '', node.config ?? {}, media.attachments, media.links)
    onDirtyChange?.(false)
  }, [node?.id])

  const currentSnapshot = snapshotNodeState(label, config, attachments, links)
  const dirty = Boolean(node) && currentSnapshot !== initialSnapshot.current

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const setField = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleClose = async () => {
    if (dirty && !confirm('Discard unsaved node changes?')) return
    await cleanupUnsavedUploads()
    onDirtyChange?.(false)
    onClose()
  }

  const handleSave = async () => {
    if (!node) return
    setSaving(true)
    try {
      const savedLabel = label.trim() || ''
      const nextConfig = node.node_type === 'message'
        ? buildMessageConfigForSave(config, attachments, links)
        : config

      await onUpdateConfig(node.id, {
        label: savedLabel || null,
        config: nextConfig,
      })
      const previousPaths = uploadedPathsFromConfig(node.config ?? {})
      const nextPaths = uploadedPathsFromConfig(nextConfig)
      const removedPaths = previousPaths.filter((path) => !nextPaths.includes(path))
      await deleteFlowNodeMedia(removedPaths)
      setLabel(savedLabel)
      setConfig(nextConfig)
      setUnsavedUploadPaths([])
      initialSnapshot.current = snapshotNodeState(savedLabel, nextConfig, attachments, links)
      onDirtyChange?.(false)
    } finally {
      setSaving(false)
    }
  }

  const cleanupUnsavedUploads = async () => {
    await deleteFlowNodeMedia(unsavedUploadPaths)
    setUnsavedUploadPaths([])
  }

  const handleFileUpload = async (file: File, attempt = 1) => {
    if (!node) return
    setUploading(true)
    setUploadError('')
    setFailedFile(null)
    setRetryCount(attempt - 1)
    try {
      const attachment = await uploadFlowNodeMedia({
        ownerId,
        flowId,
        nodeId: node.id,
        file,
        currentAttachmentCount: attachments.length,
      })
      setAttachments((prev) => [...prev, attachment])
      if (attachment.storage_path) setUnsavedUploadPaths((prev) => [...prev, attachment.storage_path!])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error: any) {
      setFailedFile(file)
      setRetryCount(attempt)
      setUploadError(error?.message ?? 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleRetry = async () => {
    if (!failedFile || retryCount >= 3) return
    await delay(Math.min(300 * retryCount, 900))
    await handleFileUpload(failedFile, retryCount + 1)
  }

  const addUrlAttachment = () => {
    const url = mediaUrl.trim()
    if (!url) return
    if (attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      setUploadError(`A message can have up to ${MAX_ATTACHMENTS_PER_MESSAGE} attachments.`)
      return
    }
    setAttachments((prev) => [...prev, {
      id: createLocalId(),
      type: attachmentType,
      url,
      source: 'url',
    }])
    setMediaUrl('')
    setUploadError('')
  }

  const updateAttachmentCaption = (id: string, caption: string) => {
    try {
      validateAttachmentCaption(caption)
      setUploadError('')
      setAttachments((prev) => prev.map((attachment) => attachment.id === id ? { ...attachment, caption } : attachment))
    } catch (error: any) {
      setUploadError(error?.message ?? 'Caption is too long.')
    }
  }

  const removeAttachment = async (attachment: FlowMediaAttachment) => {
    if (!confirm('Remove this attachment?')) return
    setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
    if (attachment.storage_path && canDeletePath(attachment.storage_path, node?.config ?? {}, unsavedUploadPaths)) {
      await deleteFlowNodeMedia([attachment.storage_path])
      setUnsavedUploadPaths((prev) => prev.filter((path) => path !== attachment.storage_path))
    }
  }

  const addLink = () => {
    const url = linkUrl.trim()
    if (!url) return
    setLinks((prev) => [...prev, { id: createLocalId(), url, ...(linkLabel.trim() ? { label: linkLabel.trim() } : {}) }])
    setLinkUrl('')
    setLinkLabel('')
  }

  const setQuickReplyButtons = (buttons: QuickReplyButton[]) => {
    setConfig((prev) => {
      const next = { ...prev }
      if (buttons.length > 0) next.buttons = buttons
      else delete next.buttons
      return next
    })
  }

  const addQuickReplyButton = () => {
    const buttons = normalizeQuickReplyButtons(config.buttons)
    if (buttons.length >= MAX_QUICK_REPLY_BUTTONS_PER_MESSAGE) return
    setQuickReplyButtons([...buttons, { id: createLocalId(), title: '' }])
  }

  const updateQuickReplyButton = (id: string, title: string) => {
    const buttons = normalizeQuickReplyButtons(config.buttons)
    setQuickReplyButtons(buttons.map((button) => (
      button.id === id ? { ...button, title: title.slice(0, MAX_QUICK_REPLY_BUTTON_TITLE_LENGTH) } : button
    )))
  }

  const removeQuickReplyButton = (id: string) => {
    setQuickReplyButtons(normalizeQuickReplyButtons(config.buttons).filter((button) => button.id !== id))
  }

  if (!node) {
    return null
  }

  const nodeType = node.node_type
  const uploadReady = Boolean(ownerId && flowId && node.id)
  const quickReplyButtons = normalizeQuickReplyButtons(config.buttons)
  const hasTooManyQuickReplyButtons = rawQuickReplyButtonCount(config.buttons) > MAX_QUICK_REPLY_BUTTONS_PER_MESSAGE

  return (
    <aside className="fixed inset-x-0 sm:left-auto sm:right-0 top-[52px] bottom-0 z-40 mobile-sheet border-l border-border bg-surface-raised shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{fieldLabel(nodeType)} node</p>
          <h2 className="text-base font-bold text-foreground">Configure node</h2>
        </div>
        <button onClick={() => void handleClose()} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        <div className={cardCls}>
          <label className={labelCls}>Label</label>
          <input className={inputCls} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={`${fieldLabel(nodeType)} label`} />
        </div>

        {nodeType === 'start' && (
          <div>
            <label className={labelCls}>Greeting message</label>
            <textarea className={inputCls} rows={4} value={String(config.greeting_message ?? '')} onChange={(event) => setField('greeting_message', event.target.value)} placeholder="Optional welcome text" />
          </div>
        )}

        {nodeType === 'message' && (
          <div className={cardCls}>
            <div>
              <p className="text-sm font-bold text-foreground">Message content</p>
              <p className="text-xs text-muted-foreground">Text, media, links, and replies are saved inside this one message node.</p>
            </div>

            <div>
              <label className={labelCls}>Text</label>
              <textarea className={inputCls} rows={6} value={String(config.text ?? '')} onChange={(event) => setField('text', event.target.value)} placeholder="Text to send" />
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-foreground">Media inside this message</p>
                  <p className="text-[10px] text-muted-foreground">Public by URL. Avoid confidential documents.</p>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{attachments.length}/{MAX_ATTACHMENTS_PER_MESSAGE}</span>
              </div>

              {!uploadReady && (
                <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Save/select a persisted flow node before uploading media.
                </div>
              )}

              <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-1.5">
                {(['image', 'video', 'document'] as FlowAttachmentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAttachmentType(type)}
                    className={[
                      'rounded-xl border px-2 py-2 text-xs font-bold capitalize flex items-center justify-center gap-1.5',
                      attachmentType === type ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {type === 'image' && <Image size={13} />}
                    {type === 'video' && <Video size={13} />}
                    {type === 'document' && <FileText size={13} />}
                    {type === 'document' ? 'PDF' : type}
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPT_MAP[attachmentType]}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFileUpload(file)
                }}
              />

              <button
                type="button"
                disabled={!uploadReady || uploading || attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE}
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-border px-4 py-5 flex flex-col items-center gap-2 text-center hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
              >
                {uploading ? <Loader2 size={20} className="animate-spin text-primary" /> : <Paperclip size={20} className="text-muted-foreground" />}
                <span className="text-xs font-bold text-foreground">{uploading ? 'Uploading...' : `Upload ${attachmentType === 'document' ? 'PDF' : attachmentType}`}</span>
                <span className="text-[10px] text-muted-foreground">Images 10 MB, videos 50 MB, PDF 20 MB</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr_auto] gap-2">
                <select className={inputCls} value={attachmentType} onChange={(event) => setAttachmentType(event.target.value as FlowAttachmentType)}>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="document">PDF</option>
                </select>
                <input className={inputCls} value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Paste public media URL" />
                  <button type="button" aria-label="Add media URL" onClick={addUrlAttachment} className="touch-target px-3 rounded-lg bg-muted text-xs font-bold text-foreground hover:bg-muted/80">Add</button>
              </div>

              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    onCaptionChange={(caption) => updateAttachmentCaption(attachment.id, caption)}
                    onRemove={() => void removeAttachment(attachment)}
                  />
                ))}
              </div>

              {uploadError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between gap-3">
                  <span>{uploadError}</span>
                  {failedFile && retryCount < 3 && (
                    <button type="button" onClick={() => void handleRetry()} className="inline-flex items-center gap-1 font-bold text-foreground">
                      <RotateCw size={12} />
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
              <div>
                <p className="text-xs font-bold text-foreground">Links inside this message</p>
                <p className="text-[10px] text-muted-foreground">YouTube, maps, and websites stay attached to this message node.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input className={inputCls} value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Optional label, e.g. Watch video" />
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input className={inputCls} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://youtube.com/..." />
                  <button type="button" aria-label="Add external link" onClick={addLink} className="touch-target px-3 rounded-lg bg-muted text-xs font-bold text-foreground hover:bg-muted/80">Add</button>
                </div>
              </div>
              {links.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <ExternalLink size={13} className="text-primary shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{item.label ? `${item.label}: ` : ''}{item.url}</span>
                  <button type="button" onClick={() => setLinks((prev) => prev.filter((linkItem) => linkItem.id !== item.id))} className="text-muted-foreground hover:text-destructive">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-foreground">Quick replies inside this message</p>
                  <p className="text-[10px] text-muted-foreground">Max 3 buttons for WhatsApp.</p>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{quickReplyButtons.length}/{MAX_QUICK_REPLY_BUTTONS_PER_MESSAGE}</span>
              </div>

              {quickReplyButtons.length > 0 && (
                <div className="space-y-2">
                  {quickReplyButtons.map((button, index) => (
                    <div key={button.id} className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        className={inputCls}
                        value={button.title}
                        maxLength={MAX_QUICK_REPLY_BUTTON_TITLE_LENGTH}
                        onChange={(event) => updateQuickReplyButton(button.id, event.target.value)}
                        placeholder={`Button ${index + 1} title`}
                      />
                      <button
                        type="button"
                        aria-label={`Remove quick reply button ${index + 1}`}
                        onClick={() => removeQuickReplyButton(button.id)}
                        className="w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addQuickReplyButton}
                disabled={quickReplyButtons.length >= MAX_QUICK_REPLY_BUTTONS_PER_MESSAGE}
                className="px-3 py-2 rounded-lg bg-muted text-xs font-bold text-foreground hover:bg-muted/80 disabled:opacity-50"
              >
                Add button
              </button>

              {hasTooManyQuickReplyButtons && (
                <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  WhatsApp supports up to 3 quick reply buttons. Extra buttons will not be sent.
                </div>
              )}
            </div>

            <UnifiedMessagePreview
              text={String(config.text ?? '')}
              attachments={attachments}
              links={links}
              buttons={quickReplyButtons}
            />
          </div>
        )}

        {nodeType === 'input' && (
          <>
            <div>
              <label className={labelCls}>Prompt</label>
              <textarea className={inputCls} rows={4} value={String(config.prompt ?? '')} onChange={(event) => setField('prompt', event.target.value)} placeholder="Ask the customer a question" />
            </div>
            <div>
              <label className={labelCls}>Variable name</label>
              <input className={inputCls} value={String(config.store_as ?? '')} onChange={(event) => setField('store_as', event.target.value)} placeholder="customer_answer" />
            </div>
            <div>
              <label className={labelCls}>Timeout seconds</label>
              <input type="number" className={inputCls} min={0} value={Number(config.timeout_secs ?? 300)} onChange={(event) => setField('timeout_secs', Number(event.target.value))} />
            </div>
          </>
        )}

        {nodeType === 'condition' && (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Condition logic lives on outgoing edges. Select an edge from this node to configure matching rules.
              </p>
          </div>
        )}

        {nodeType === 'api' && (
          <>
            <div>
              <label className={labelCls}>URL</label>
              <input className={inputCls} value={String(config.url ?? '')} onChange={(event) => setField('url', event.target.value)} placeholder="https://api.example.com" />
            </div>
            <div>
              <label className={labelCls}>Method</label>
              <select className={inputCls} value={String(config.method ?? 'GET')} onChange={(event) => setField('method', event.target.value)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Body</label>
              <textarea className={inputCls} rows={4} value={String(config.body_template ?? '')} onChange={(event) => setField('body_template', event.target.value)} placeholder="JSON request body template" />
            </div>
            <div>
              <label className={labelCls}>Response variable</label>
              <input className={inputCls} value={String(config.response_variable ?? '')} onChange={(event) => setField('response_variable', event.target.value)} placeholder="api_response" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Timeout seconds</label>
                <input type="number" min={1} className={inputCls} value={Number(config.timeout_secs ?? 10)} onChange={(event) => setField('timeout_secs', Number(event.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Retry count</label>
                <input type="number" min={0} className={inputCls} value={Number(config.retry_count ?? 2)} onChange={(event) => setField('retry_count', Number(event.target.value))} />
              </div>
            </div>
          </>
        )}

        {nodeType === 'delay' && (
          <div>
            <label className={labelCls}>Seconds</label>
            <input type="number" min={0} className={inputCls} value={Number(config.delay_secs ?? 5)} onChange={(event) => setField('delay_secs', Number(event.target.value))} />
          </div>
        )}

        {nodeType === 'jump' && (
          <div>
            <label className={labelCls}>Target node</label>
            <select className={inputCls} value={String(config.target_node_id ?? '')} onChange={(event) => setField('target_node_id', event.target.value)}>
              <option value="">Choose a node</option>
              {allNodes.filter((item) => item.id !== node.id).map((item) => (
                <option key={item.id} value={item.id}>{item.label || fieldLabel(item.node_type)}</option>
              ))}
            </select>
          </div>
        )}

        {nodeType === 'subflow' && (
          <div>
            <label className={labelCls}>Target flow</label>
            <select className={inputCls} value={String(config.subflow_id ?? '')} onChange={(event) => setField('subflow_id', event.target.value)}>
              <option value="">Choose a flow</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>{flow.name}</option>
              ))}
            </select>
            <label className={`${labelCls} mt-3`}>Return mode</label>
            <select className={inputCls} value={String(config.return_mode ?? 'auto')} onChange={(event) => setField('return_mode', event.target.value)}>
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        )}

        {nodeType === 'handoff' && (
          <>
            <div>
              <label className={labelCls}>Department</label>
              <input className={inputCls} value={String(config.department ?? 'support')} onChange={(event) => setField('department', event.target.value)} placeholder="support" />
            </div>
            <div>
              <label className={labelCls}>Handoff message</label>
              <textarea className={inputCls} rows={4} value={String(config.message ?? '')} onChange={(event) => setField('message', event.target.value)} placeholder="A human will join shortly." />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={Boolean(config.allow_resume ?? false)} onChange={(event) => setField('allow_resume', event.target.checked)} />
              Allow resume after handoff
            </label>
            <div>
              <label className={labelCls}>Queue strategy</label>
              <input className={inputCls} value={String(config.queue_strategy ?? 'round_robin')} onChange={(event) => setField('queue_strategy', event.target.value)} placeholder="round_robin" />
            </div>
            <div>
              <label className={labelCls}>Timeout hours</label>
              <input type="number" min={1} className={inputCls} value={Number(config.handoff_timeout_hours ?? 24)} onChange={(event) => setField('handoff_timeout_hours', Number(event.target.value))} />
            </div>
          </>
        )}

        {nodeType === 'end' && (
          <div>
            <label className={labelCls}>Farewell message</label>
            <textarea className={inputCls} rows={4} value={String(config.farewell_message ?? '')} onChange={(event) => setField('farewell_message', event.target.value)} placeholder="Optional goodbye text" />
          </div>
        )}
      </div>

      <div className="px-3 sm:px-4 py-3 border-t border-border bg-card/80 backdrop-blur flex flex-col gap-2 safe-area-page">
        {dirty && <p className="text-[10px] text-amber-600 font-semibold">Unsaved changes</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save node'}
        </button>
        <button
          onClick={() => { if (uploading) return; if (confirm('Delete this node?')) void onDeleteNode(node.id) }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
        >
          <Trash2 size={13} />
          Delete node
        </button>
      </div>
    </aside>
  )
}

function AttachmentCard({
  attachment,
  onCaptionChange,
  onRemove,
}: {
  attachment: FlowMediaAttachment
  onCaptionChange: (caption: string) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        {attachment.type === 'image' && <Image size={14} className="text-primary" />}
        {attachment.type === 'video' && <Video size={14} className="text-primary" />}
        {attachment.type === 'document' && <FileText size={14} className="text-primary" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground capitalize">{attachment.type === 'document' ? 'PDF' : attachment.type}</p>
          <p className="text-[10px] text-muted-foreground truncate">{attachment.url}</p>
        </div>
        <button type="button" onClick={onRemove} className="w-7 h-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center">
          <X size={12} />
        </button>
      </div>
      {attachment.type === 'image' && (
        <img src={attachment.url} alt="Attachment preview" className="w-full max-h-36 rounded-xl border border-border object-cover bg-background" onError={(event) => { event.currentTarget.style.display = 'none' }} />
      )}
      <input
        className={inputCls}
        value={attachment.caption ?? ''}
        onChange={(event) => onCaptionChange(event.target.value)}
        placeholder="Optional caption"
      />
    </div>
  )
}

function UnifiedMessagePreview({
  text,
  attachments,
  links,
  buttons,
}: {
  text: string
  attachments: FlowMediaAttachment[]
  links: FlowMessageLink[]
  buttons: QuickReplyButton[]
}) {
  const hasContent = text.trim() || attachments.length > 0 || links.length > 0 || buttons.length > 0

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div>
        <p className="text-xs font-bold text-foreground">Unified message preview</p>
        <p className="text-[10px] text-muted-foreground">Everything below belongs to this one message node.</p>
      </div>

      <div className="rounded-2xl rounded-tl-md border border-border bg-card p-3 space-y-2 shadow-sm">
        {!hasContent && (
          <p className="text-xs text-muted-foreground">Add text, media, links, or replies to build this message.</p>
        )}

        {attachments.length > 0 && (
          <div className="space-y-1.5">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-2 py-1.5">
                {attachment.type === 'image' && <Image size={13} className="text-primary" />}
                {attachment.type === 'video' && <Video size={13} className="text-primary" />}
                {attachment.type === 'document' && <FileText size={13} className="text-primary" />}
                <span className="text-[11px] font-medium text-foreground capitalize">
                  {attachment.type === 'document' ? 'PDF' : attachment.type}
                </span>
                {attachment.caption && <span className="text-[11px] text-muted-foreground truncate">- {attachment.caption}</span>}
              </div>
            ))}
          </div>
        )}

        {text.trim() && (
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
        )}

        {links.length > 0 && (
          <div className="space-y-1">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-1.5 text-[11px] text-primary">
                <ExternalLink size={11} className="shrink-0" />
                <span className="truncate">{link.label ? `${link.label}: ` : ''}{link.url}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {buttons.length > 0 && (
        <div className="space-y-1">
          {buttons.map((button) => (
            <div key={button.id} className="rounded-xl border border-primary/25 bg-card px-3 py-2 text-center text-xs font-bold text-primary">
              {button.title || 'Untitled button'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function snapshotNodeState(
  label: string,
  config: Record<string, unknown>,
  attachments: FlowMediaAttachment[],
  links: FlowMessageLink[],
) {
  return JSON.stringify({
    label,
    config,
    attachments,
    links,
  })
}

function uploadedPathsFromConfig(config: Record<string, unknown>) {
  return normalizeMessageMediaConfig(config).attachments
    .filter((attachment) => attachment.storage_path && attachment.source !== 'url')
    .map((attachment) => attachment.storage_path!)
}

function canDeletePath(path: string, config: Record<string, unknown>, unsavedUploadPaths: string[]) {
  return unsavedUploadPaths.includes(path) || uploadedPathsFromConfig(config).includes(path)
}

function normalizeQuickReplyButtons(value: unknown): QuickReplyButton[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const button = item as Record<string, unknown>
      const id = typeof button.id === 'string' && button.id.trim()
        ? button.id.trim()
        : `button-${index + 1}`
      const title = typeof button.title === 'string'
        ? button.title.slice(0, MAX_QUICK_REPLY_BUTTON_TITLE_LENGTH)
        : ''

      return { id, title }
    })
    .filter((button): button is QuickReplyButton => Boolean(button))
}

function rawQuickReplyButtonCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function createLocalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
