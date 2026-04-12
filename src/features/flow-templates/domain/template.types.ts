import type { ConditionType, NodeType, TriggerType } from '@/integrations/supabase/flow-types'

export type TemplateStatus = 'active' | 'draft' | 'deprecated'
export type TemplateContentCategory = 'utility' | 'marketing' | 'support'

export interface TemplateContentPolicy {
  requiresHumanReviewForSensitiveTopics: boolean
  outboundApprovalRequiredCategories: TemplateContentCategory[]
  prohibitedClaims: string[]
}

export interface TemplateTrigger {
  id: string
  type: Extract<TriggerType, 'keyword' | 'restart' | 'default' | 'api'>
  value: string | null
  matchMode: 'normalized_exact'
  priority: number
}

export interface TemplateNode {
  id: string
  type: NodeType
  label: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  messageMeta?: {
    category: TemplateContentCategory
    outboundApprovalRequired: boolean
    editable: boolean
    variablesCreated?: string[]
  }
}

export interface TemplateEdge {
  id: string
  source: string
  target: string
  condition: {
    type: ConditionType
    value: string | null
    variable: string | null
    label: string | null
    isFallback: boolean
    priority: number
    allowedCycle?: 'restart_to_start' | 'return_to_menu'
  }
}

export interface FlowTemplate {
  id: string
  version: number
  name: string
  description: string
  industries: string[]
  tags: string[]
  emoji: string
  status: TemplateStatus
  featured: boolean
  contentPolicy: TemplateContentPolicy
  triggers: TemplateTrigger[]
  nodes: TemplateNode[]
  edges: TemplateEdge[]
}

export interface FlowTemplateCatalogRow {
  id: string
  version: number
  name: string
  description: string | null
  industries: string[]
  tags: string[]
  status: TemplateStatus
  template: FlowTemplate
}

export interface InstantiateTemplateResult {
  flow: Record<string, unknown>
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  triggers: Record<string, unknown>[]
  replayed?: boolean
}

export type TemplateErrorCode =
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_INVALID'
  | 'TRIGGER_CONFLICT'
  | 'PERMISSION_DENIED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DB_WRITE_FAILED'
  | 'UNKNOWN'

export class FlowTemplateError extends Error {
  code: TemplateErrorCode

  constructor(code: TemplateErrorCode, message: string) {
    super(message)
    this.name = 'FlowTemplateError'
    this.code = code
  }
}
