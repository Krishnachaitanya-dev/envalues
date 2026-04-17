export type FlowStatus = 'draft' | 'published' | 'archived'

export type NodeType =
  | 'start' | 'message' | 'input' | 'condition'
  | 'api' | 'delay' | 'jump' | 'subflow' | 'handoff' | 'end'

export type ConditionType =
  | 'always' | 'equals' | 'contains' | 'starts_with'
  | 'regex' | 'variable_equals' | 'variable_contains'

export type TriggerType = 'keyword' | 'api' | 'default' | 'restart'

export interface Flow {
  id: string
  owner_id: string
  name: string
  description: string | null
  status: FlowStatus
  version: number
  entry_node_id: string | null
  created_from_template_id?: string | null
  created_from_template_version?: number | null
  template_applied_at?: string | null
  template_request_id?: string | null
  created_at: string
  updated_at: string
}

export interface FlowNode {
  id: string
  flow_id: string
  owner_id: string
  node_type: NodeType
  label: string | null
  config: Record<string, unknown>
  position_x: number
  position_y: number
  created_at: string
  updated_at: string
}

export interface FlowEdge {
  id: string
  flow_id: string
  owner_id: string
  source_node_id: string
  target_node_id: string
  condition_type: ConditionType
  condition_value: string | null
  condition_variable: string | null
  condition_expression?: string | null
  is_fallback: boolean
  priority: number
  label: string | null
  created_at: string
}

export interface FlowTrigger {
  id: string
  owner_id: string
  flow_id: string
  target_node_id: string | null
  trigger_type: TriggerType
  trigger_value: string | null
  normalized_trigger_value?: string | null
  priority: number
  is_active: boolean
  metadata?: Record<string, unknown>
  created_at: string
}

// Config shapes per node type (stored as FlowNode.config)
export interface StartConfig   { greeting_message?: string }
export interface MessageConfig {
  text?: string
  attachments?: Array<{
    id?: string
    type: 'image' | 'video' | 'document'
    url: string
    caption?: string
    storage_path?: string
    source?: 'upload' | 'url'
  }>
  links?: Array<{ id?: string; url: string; label?: string }>
  media_url?: string
  media_type?: 'image' | 'video' | 'document'
  buttons?: Array<{ id: string; title: string }>
}
export interface InputConfig   { prompt: string; variable: string; timeout_seconds?: number }
export interface ConditionConfig { /* empty — logic lives in edges */ }
export interface ApiConfig     { url: string; method: 'GET'|'POST'|'PUT'|'DELETE'; headers?: Record<string,string>; body?: string; response_variable?: string }
export interface DelayConfig   { seconds: number }
export interface JumpConfig    { target_node_id: string; target_flow_id?: string }
export interface SubflowConfig { target_flow_id: string }
export interface HandoffConfig { message?: string; notify?: boolean }
export interface EndConfig     { farewell_message?: string }
