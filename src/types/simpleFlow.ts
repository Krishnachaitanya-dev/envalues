export type SimpleStepType = 'message' | 'question' | 'end'
export type SimpleQuestionMode = 'open_text' | 'button_choices'
export type SimpleMediaType = 'image' | 'video' | 'document' | 'youtube'
export type SimpleMediaSource = 'upload' | 'url'

export interface SimpleMedia {
  id: string
  type: SimpleMediaType
  url: string
  caption?: string
  storage_path?: string
  source: SimpleMediaSource
}

export interface SimpleButton {
  id: string
  title: string
  nextStepId: string | null
}

export interface SimplePosition {
  x: number
  y: number
}

export interface SimpleStep {
  id: string
  type: SimpleStepType
  mode?: SimpleQuestionMode
  text: string
  attachments?: SimpleMedia[]
  buttons?: SimpleButton[]
  nextStepId?: string | null
  position?: SimplePosition
  _isNew?: boolean
}

export interface SimpleTrigger {
  id: string
  keywords: string[]
  targetStepId: string | null
}

export interface SimpleFlow {
  id: string
  name: string
  status: 'draft' | 'published' | 'archived'
  steps: SimpleStep[]
  triggers: SimpleTrigger[]
}

export const MAX_SIMPLE_ATTACHMENTS = 3
export const MAX_SIMPLE_BUTTONS = 3
export const MAX_SIMPLE_LIST_OPTIONS = 10
export const MAX_SIMPLE_BUTTON_TITLE = 20

export type SimpleQuestionResponseMode = 'open_text' | 'buttons' | 'list'

export function getQuestionResponseMode(optionCount: number): SimpleQuestionResponseMode {
  if (optionCount <= 0) return 'open_text'
  return optionCount <= MAX_SIMPLE_BUTTONS ? 'buttons' : 'list'
}

export function isYouTubeUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be'
  } catch {
    return false
  }
}

export function youTubeEmbedUrl(url: string): string | null {
  if (!isYouTubeUrl(url)) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/')[2]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    return null
  } catch {
    return null
  }
}
