export type SimpleStepType = 'message' | 'question'
export type SimpleQuestionMode = 'open_text' | 'button_choices'

export interface SimpleMedia {
  type: 'image' | 'video' | 'document'
  url: string
  caption?: string
}

export interface SimpleButton {
  id: string
  title: string
  nextStepId: string | null
}

export interface SimpleStep {
  id: string
  type: SimpleStepType
  mode?: SimpleQuestionMode
  text: string
  media?: SimpleMedia
  buttons?: SimpleButton[]
  nextStepId?: string | null
  _isNew?: boolean
}

export interface SimpleFlow {
  id: string
  name: string
  status: 'draft' | 'published' | 'archived'
  steps: SimpleStep[]
  keywords: string[]
}
