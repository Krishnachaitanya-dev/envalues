import type { SimpleButton, SimpleFlow, SimpleMedia, SimpleStep, SimpleTrigger } from '@/types/simpleFlow'

const COPY_KIND = 'envalues.simple-flow'
const COPY_VERSION = 1
export const FLOW_COPY_QUERY_PARAM = 'flow_copy'
export const FLOW_COPY_STORAGE_KEY = 'envalues.simple-flow-copy'

export interface SimpleFlowCopyData {
  name: string
  steps: SimpleStep[]
  triggers: SimpleTrigger[]
}

export interface SimpleFlowCopyPayload {
  kind: typeof COPY_KIND
  version: typeof COPY_VERSION
  exportedAt: string
  flow: SimpleFlowCopyData
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function asCopyData(value: unknown): SimpleFlowCopyData {
  const source = isRecord(value) && isRecord(value.flow) ? value.flow : value
  if (!isRecord(source)) throw new Error('Invalid flow copy.')

  const name = typeof source.name === 'string' && source.name.trim()
    ? source.name.trim()
    : 'Imported Conversation'
  const steps = Array.isArray(source.steps) ? source.steps as SimpleStep[] : []
  const triggers = Array.isArray(source.triggers) ? source.triggers as SimpleTrigger[] : []

  if (steps.length === 0) throw new Error('Flow copy has no steps.')

  return { name, steps, triggers }
}

export function createSimpleFlowCopyText(flow: SimpleFlow): string {
  const payload: SimpleFlowCopyPayload = {
    kind: COPY_KIND,
    version: COPY_VERSION,
    exportedAt: new Date().toISOString(),
    flow: {
      name: flow.name,
      steps: flow.steps,
      triggers: flow.triggers,
    },
  }
  return JSON.stringify(payload, null, 2)
}

export function encodeSimpleFlowCopyText(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeSimpleFlowCopyText(token: string): string {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function createSimpleFlowShareUrl(flow: SimpleFlow, baseHref: string): string {
  const url = new URL(baseHref)
  url.pathname = '/dashboard/builder'
  url.search = ''
  url.hash = ''
  url.searchParams.set(FLOW_COPY_QUERY_PARAM, encodeSimpleFlowCopyText(createSimpleFlowCopyText(flow)))
  return url.toString()
}

export function parseSimpleFlowCopyToken(token: string): SimpleFlowCopyData {
  return parseSimpleFlowCopyText(decodeSimpleFlowCopyText(token))
}

export function parseSimpleFlowCopyText(text: string): SimpleFlowCopyData {
  const trimmed = text.trim()
  try {
    const url = new URL(trimmed)
    const token = url.searchParams.get(FLOW_COPY_QUERY_PARAM)
    if (token) return parseSimpleFlowCopyToken(token)
  } catch {
    // Not a URL; parse as raw copy JSON.
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('Paste a valid flow copy JSON or share link.')
  }
  return asCopyData(parsed)
}

function cloneMedia(media: SimpleMedia): SimpleMedia {
  return {
    ...media,
    id: crypto.randomUUID(),
  }
}

function cloneButton(button: SimpleButton, stepIdMap: Map<string, string>): SimpleButton {
  return {
    id: crypto.randomUUID(),
    title: String(button.title ?? '').trim(),
    nextStepId: button.nextStepId ? (stepIdMap.get(button.nextStepId) ?? null) : null,
  }
}

export function cloneSimpleFlowCopy(copy: SimpleFlowCopyData, flowId: string, flowName?: string): SimpleFlow {
  const stepIdMap = new Map<string, string>()
  for (const step of copy.steps) {
    if (typeof step.id === 'string' && step.id) {
      stepIdMap.set(step.id, crypto.randomUUID())
    }
  }

  const steps = copy.steps.map<SimpleStep>((step, index) => {
    const newId = stepIdMap.get(step.id) ?? crypto.randomUUID()
    const buttons = Array.isArray(step.buttons)
      ? step.buttons.map(button => cloneButton(button, stepIdMap)).filter(button => button.title)
      : undefined
    const attachments = Array.isArray(step.attachments)
      ? step.attachments.map(cloneMedia)
      : undefined
    const nextStepId = step.nextStepId ? (stepIdMap.get(step.nextStepId) ?? null) : step.nextStepId ?? null

    return {
      id: newId,
      type: step.type === 'message' || step.type === 'question' || step.type === 'end' ? step.type : 'message',
      mode: step.type === 'question'
        ? (buttons && buttons.length > 0 ? 'button_choices' : 'open_text')
        : undefined,
      text: typeof step.text === 'string' ? step.text : '',
      attachments,
      buttons: buttons && buttons.length > 0 ? buttons : undefined,
      nextStepId: step.type !== 'end' ? nextStepId : undefined,
      position: step.position
        ? { x: Number(step.position.x) || 200, y: Number(step.position.y) || ((index + 1) * 150) }
        : { x: 200, y: (index + 1) * 150 },
    }
  })

  const triggers = copy.triggers.map<SimpleTrigger>(trigger => ({
    id: crypto.randomUUID(),
    keywords: Array.isArray(trigger.keywords)
      ? trigger.keywords.map(keyword => String(keyword).trim()).filter(Boolean)
      : [],
    targetStepId: trigger.targetStepId ? (stepIdMap.get(trigger.targetStepId) ?? steps[0]?.id ?? null) : steps[0]?.id ?? null,
  })).filter(trigger => trigger.keywords.length > 0)

  return {
    id: flowId,
    name: flowName?.trim() || `${copy.name} Copy`,
    status: 'draft',
    steps,
    triggers,
  }
}

export function appendSimpleFlowCopy(target: SimpleFlow, copy: SimpleFlowCopyData): SimpleFlow {
  const cloned = cloneSimpleFlowCopy(copy, target.id, target.name)
  const existingMaxX = target.steps.reduce((max, step) => Math.max(max, step.position?.x ?? 0), 0)
  const importedMinX = cloned.steps.reduce((min, step) => Math.min(min, step.position?.x ?? 200), Number.POSITIVE_INFINITY)
  const shiftX = target.steps.length > 0 ? existingMaxX + 280 - importedMinX : 0

  return {
    ...target,
    steps: [
      ...target.steps,
      ...cloned.steps.map(step => ({
        ...step,
        position: {
          x: (step.position?.x ?? 200) + shiftX,
          y: step.position?.y ?? 200,
        },
      })),
    ],
    triggers: [
      ...target.triggers,
      ...cloned.triggers,
    ],
  }
}
