import { supabase } from '@/integrations/supabase/client'

export const FLOW_MEDIA_BUCKET = 'chatbot-media'
export const MAX_ATTACHMENTS_PER_MESSAGE = 3
export const MAX_ATTACHMENT_CAPTION_LENGTH = 300
export const MAX_QUICK_REPLY_BUTTONS_PER_MESSAGE = 3
export const MAX_QUICK_REPLY_BUTTON_TITLE_LENGTH = 20

export type FlowAttachmentType = 'image' | 'video' | 'document'
export type FlowAttachmentSource = 'upload' | 'url'

export interface FlowMediaAttachment {
  id: string
  type: FlowAttachmentType
  url: string
  caption?: string
  storage_path?: string
  source?: FlowAttachmentSource
}

export interface FlowMessageLink {
  id: string
  url: string
  label?: string
}

export interface FlowQuickReplyButton {
  id: string
  title: string
}

export interface NormalizedMessageMediaConfig {
  attachments: FlowMediaAttachment[]
  links: FlowMessageLink[]
}

type MediaRule = {
  type: FlowAttachmentType
  extensions: string[]
  maxBytes: number
  magic?: number[] | string
}

const MEDIA_RULES: Record<string, MediaRule> = {
  'image/jpeg': { type: 'image', extensions: ['jpg', 'jpeg'], maxBytes: 10 * 1024 * 1024, magic: [0xff, 0xd8, 0xff] },
  'image/png': { type: 'image', extensions: ['png'], maxBytes: 10 * 1024 * 1024, magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/webp': { type: 'image', extensions: ['webp'], maxBytes: 10 * 1024 * 1024, magic: 'WEBP' },
  'image/gif': { type: 'image', extensions: ['gif'], maxBytes: 10 * 1024 * 1024, magic: 'GIF' },
  'video/mp4': { type: 'video', extensions: ['mp4'], maxBytes: 50 * 1024 * 1024 },
  'video/3gpp': { type: 'video', extensions: ['3gp', '3gpp'], maxBytes: 50 * 1024 * 1024 },
  'application/pdf': { type: 'document', extensions: ['pdf'], maxBytes: 20 * 1024 * 1024, magic: '%PDF' },
}

export function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getFileExtension(filename: string) {
  return filename.split('.').pop()?.trim().toLowerCase() ?? ''
}

export function getAttachmentTypeForMime(mime: string): FlowAttachmentType | null {
  return MEDIA_RULES[mime]?.type ?? null
}

export async function validateFlowMediaFile(file: File) {
  const rule = MEDIA_RULES[file.type]
  if (!rule) {
    throw new Error('Unsupported file type. Upload JPG, PNG, WEBP, GIF, MP4, 3GP, or PDF files.')
  }

  const ext = getFileExtension(file.name)
  if (!rule.extensions.includes(ext)) {
    throw new Error(`File extension .${ext || 'unknown'} does not match ${file.type}.`)
  }

  if (file.size > rule.maxBytes) {
    throw new Error(`File is too large. Maximum allowed size is ${formatBytes(rule.maxBytes)}.`)
  }

  if (rule.magic) {
    const ok = await hasExpectedSignature(file, rule.magic)
    if (!ok) throw new Error('File contents do not match the selected file type.')
  }

  return { type: rule.type, extension: rule.extensions[0], maxBytes: rule.maxBytes }
}

export function validateAttachmentCaption(caption: string) {
  if (caption.length > MAX_ATTACHMENT_CAPTION_LENGTH) {
    throw new Error(`Caption must be ${MAX_ATTACHMENT_CAPTION_LENGTH} characters or less.`)
  }
}

export function buildFlowMediaPath(params: {
  ownerId: string
  flowId: string
  nodeId: string
  extension: string
  randomId?: string
}) {
  const { ownerId, flowId, nodeId, extension } = params
  const randomId = params.randomId ?? createClientId()
  if (!ownerId || !flowId || !nodeId) throw new Error('Upload requires a saved owner, flow, and node.')
  return `${ownerId}/flows/${flowId}/nodes/${nodeId}/${randomId}.${extension}`
}

export async function uploadFlowNodeMedia(params: {
  ownerId: string | null
  flowId: string | null
  nodeId: string | null
  file: File
  currentAttachmentCount?: number
}) {
  const { ownerId, flowId, nodeId, file } = params
  if (!ownerId || !flowId || !nodeId) {
    throw new Error('Save the node before uploading media.')
  }
  if ((params.currentAttachmentCount ?? 0) >= MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new Error(`A message can have up to ${MAX_ATTACHMENTS_PER_MESSAGE} attachments.`)
  }

  const validated = await validateFlowMediaFile(file)
  const storagePath = buildFlowMediaPath({
    ownerId,
    flowId,
    nodeId,
    extension: validated.extension,
  })

  const { error } = await supabase.storage
    .from(FLOW_MEDIA_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(FLOW_MEDIA_BUCKET).getPublicUrl(storagePath)
  return {
    id: createClientId(),
    type: validated.type,
    url: data.publicUrl,
    storage_path: storagePath,
    source: 'upload' as const,
  }
}

export function normalizeMessageMediaConfig(config: Record<string, unknown>): NormalizedMessageMediaConfig {
  const attachments = Array.isArray(config.attachments)
    ? config.attachments
      .map(normalizeAttachment)
      .filter((item): item is FlowMediaAttachment => Boolean(item))
    : []

  if (attachments.length === 0 && typeof config.media_url === 'string' && config.media_url.trim()) {
    const legacyType = normalizeAttachmentType(config.media_type)
    attachments.push({
      id: createClientId(),
      type: legacyType,
      url: config.media_url.trim(),
      source: 'url',
    })
  }

  const links = Array.isArray(config.links)
    ? config.links
      .map(normalizeLink)
      .filter((item): item is FlowMessageLink => Boolean(item))
    : []

  return { attachments, links }
}

export function buildMessageConfigForSave(
  config: Record<string, unknown>,
  attachments: FlowMediaAttachment[],
  links: FlowMessageLink[],
) {
  const next = { ...config }
  delete next.media_url
  delete next.media_type

  const normalizedAttachments = attachments
    .map(normalizeAttachment)
    .filter((item): item is FlowMediaAttachment => Boolean(item))
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)

  const normalizedLinks = links
    .map(normalizeLink)
    .filter((item): item is FlowMessageLink => Boolean(item))

  const normalizedButtons = Array.isArray(next.buttons)
    ? next.buttons
      .map(normalizeQuickReplyButton)
      .filter((item): item is FlowQuickReplyButton => Boolean(item))
      .slice(0, MAX_QUICK_REPLY_BUTTONS_PER_MESSAGE)
    : []

  if (normalizedAttachments.length > 0) next.attachments = normalizedAttachments
  else delete next.attachments

  if (normalizedLinks.length > 0) next.links = normalizedLinks
  else delete next.links

  if (normalizedButtons.length > 0) next.buttons = normalizedButtons
  else delete next.buttons

  return next
}

export async function deleteFlowNodeMedia(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))
  if (uniquePaths.length === 0) return

  try {
    const { error } = await supabase.storage.from(FLOW_MEDIA_BUCKET).remove(uniquePaths)
    if (error) console.warn('Flow media cleanup failed:', error.message)
  } catch (error) {
    console.warn('Flow media cleanup failed:', error)
  }
}

export async function deleteFlowMediaPrefix(ownerId: string | null, flowId: string | null) {
  if (!ownerId || !flowId) return
  const prefix = `${ownerId}/flows/${flowId}`
  try {
    const paths = await listStoragePaths(prefix)
    await deleteFlowNodeMedia(paths)
  } catch (error) {
    console.warn('Flow media prefix cleanup failed:', error)
  }
}

export function getUploadedStoragePaths(config: Record<string, unknown>) {
  return normalizeMessageMediaConfig(config).attachments
    .filter((attachment) => attachment.source !== 'url' && attachment.storage_path)
    .map((attachment) => attachment.storage_path!)
}

function normalizeAttachment(value: unknown): FlowMediaAttachment | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.url !== 'string' || !item.url.trim()) return null
  const type = normalizeAttachmentType(item.type)
  const caption = typeof item.caption === 'string' ? item.caption.slice(0, MAX_ATTACHMENT_CAPTION_LENGTH) : undefined
  const storagePath = typeof item.storage_path === 'string' && item.storage_path.trim() ? item.storage_path.trim() : undefined
  const source = item.source === 'upload' || item.source === 'url' ? item.source : storagePath ? 'upload' : 'url'

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : createClientId(),
    type,
    url: item.url.trim(),
    ...(caption ? { caption } : {}),
    ...(storagePath ? { storage_path: storagePath } : {}),
    source,
  }
}

function normalizeLink(value: unknown): FlowMessageLink | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.url !== 'string' || !item.url.trim()) return null
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : createClientId(),
    url: item.url.trim(),
    ...(typeof item.label === 'string' && item.label.trim() ? { label: item.label.trim() } : {}),
  }
}

function normalizeQuickReplyButton(value: unknown): FlowQuickReplyButton | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const title = typeof item.title === 'string'
    ? item.title.trim().slice(0, MAX_QUICK_REPLY_BUTTON_TITLE_LENGTH)
    : ''
  if (!title) return null

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : createClientId(),
    title,
  }
}

function normalizeAttachmentType(value: unknown): FlowAttachmentType {
  if (value === 'image' || value === 'video' || value === 'document') return value
  return 'document'
}

async function hasExpectedSignature(file: File, signature: number[] | string) {
  const bytes = new Uint8Array(await readBlobPrefix(file, 16))
  if (typeof signature === 'string') {
    const text = new TextDecoder().decode(bytes)
    return text.includes(signature)
  }
  return signature.every((byte, index) => bytes[index] === byte)
}

function readBlobPrefix(file: File, size: number): Promise<ArrayBuffer> {
  const blob = file.slice(0, size)
  if ('arrayBuffer' in blob && typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file signature.'))
    reader.readAsArrayBuffer(blob)
  })
}

async function listStoragePaths(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(FLOW_MEDIA_BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error
  const paths: string[] = []

  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`
    if ((item as any).metadata === null || (item as any).id === null) {
      paths.push(...await listStoragePaths(path))
    } else {
      paths.push(path)
    }
  }

  return paths
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024)
  return `${Math.round(mb)} MB`
}
