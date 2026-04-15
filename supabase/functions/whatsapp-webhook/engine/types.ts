export type NodeType =
  | 'start' | 'message' | 'input' | 'condition'
  | 'api' | 'delay' | 'jump' | 'subflow' | 'handoff' | 'end'

export type ConditionType =
  | 'always' | 'equals' | 'contains' | 'starts_with'
  | 'regex' | 'variable_equals' | 'variable_contains'

export type SessionStatus = 'active' | 'completed' | 'handoff' | 'expired' | 'error'

export interface FlowNode {
  id: string
  flow_id: string
  owner_id: string
  node_type: NodeType
  label: string | null
  config: Record<string, unknown>
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
  condition_expression: string | null
  is_fallback: boolean
  priority: number
}

export interface FlowTrigger {
  id: string
  owner_id: string
  flow_id: string
  target_node_id: string | null
  trigger_type: 'keyword' | 'api' | 'default' | 'restart'
  trigger_value: string | null
  priority: number
  is_active: boolean
}

export interface CallStackFrame {
  flow_id: string
  return_node_id: string
  context_snapshot: Record<string, unknown>
}

export interface FlowSession {
  id: string
  owner_id: string
  flow_id: string
  current_node_id: string
  phone: string
  status: SessionStatus
  context: Record<string, unknown>
  call_stack: CallStackFrame[]
  step_count: number
  max_steps: number
  last_node_executed_at: string | null
  last_message_at: string
}

export interface OutboundMediaHeader {
  type: 'image' | 'video' | 'document'
  url: string
  filename?: string
}

export interface OutboundMessage {
  type: 'text' | 'image' | 'video' | 'document' | 'interactive'
  text?: string
  preview_url?: boolean
  url?: string
  caption?: string
  body?: string
  buttons?: Array<{ id: string; title: string }>
  header?: OutboundMediaHeader
}

export interface NodeResult {
  messages: OutboundMessage[]
  context_updates: Record<string, unknown>
  next_node_id: string | null
  skip_edge_evaluation: boolean
  consumes_input: boolean
}

// ── Node config contracts ──────────────────────────────────────────────────────

export interface MessageConfig {
  text?: string
  attachments?: Array<{ type: string; url: string; caption?: string; storage_path?: string; source?: string }>
  links?: Array<{ id?: string; url: string; label?: string }>
  media_url?: string
  media_type?: 'image' | 'video' | 'document'
  buttons?: Array<{ id: string; title: string }>
}

export interface InputConfig {
  prompt: string
  store_as: string
  timeout_secs: number
  validation?: { type: string; value: string; error_message: string }
}

export interface EndConfig {
  farewell_message?: string
}

export interface JumpConfig {
  target_flow_id?: string | null
  target_node_id: string
}

export interface SubflowConfig {
  subflow_id: string
  return_mode: 'auto' | 'manual'
}

export interface HandoffConfig {
  department: string
  message: string
  allow_resume: boolean
  resume_node_id?: string | null
  queue_strategy: string
  handoff_timeout_hours: number
}

export interface ApiConfig {
  method: 'GET' | 'POST' | 'PUT'
  url: string
  headers: Record<string, string>
  body_template: string
  response_variable: string
  timeout_secs: number
  retry_count: number
}

export interface DelayConfig {
  delay_secs: number
}
