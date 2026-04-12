// supabase/functions/whatsapp-webhook/engine/node-executors.ts
import type {
  FlowNode, FlowSession, NodeResult, OutboundMessage,
  MessageConfig, InputConfig, EndConfig,
  JumpConfig, SubflowConfig, HandoffConfig, ApiConfig, DelayConfig,
} from './types.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    messages: [],
    context_updates: {},
    next_node_id: null,
    skip_edge_evaluation: false,
    consumes_input: false,
    ...overrides,
  }
}

// ── start ─────────────────────────────────────────────────────────────────────

export function executeStartNode(_node: FlowNode, _session: FlowSession, _inbound: string): NodeResult {
  return emptyResult()
}

// ── message ───────────────────────────────────────────────────────────────────

export function executeMessageNode(node: FlowNode, _session: FlowSession, _inbound: string): NodeResult {
  const config = node.config as MessageConfig
  const messages: OutboundMessage[] = []

  // Attachments sent before text (media first, then caption)
  if (config.attachments && config.attachments.length > 0) {
    for (const att of config.attachments) {
      messages.push({ type: att.type as OutboundMessage['type'], url: att.url, caption: att.caption })
    }
  }

  messages.push({ type: 'text', text: config.text ?? '' })
  return emptyResult({ messages })
}

// ── end ───────────────────────────────────────────────────────────────────────

export function executeEndNode(node: FlowNode, session: FlowSession): NodeResult {
  const config = node.config as EndConfig

  if (session.call_stack.length > 0) {
    const frame = session.call_stack.pop()!
    session.flow_id = frame.flow_id
    // context_snapshot intentionally not restored: subflow side-effects (context writes) are preserved in the parent.
    // If isolation is needed in future, restore: session.context = { ...frame.context_snapshot, ...session.context }
    const messages: OutboundMessage[] = config.farewell_message
      ? [{ type: 'text', text: config.farewell_message }]
      : []
    return emptyResult({ messages, next_node_id: frame.return_node_id, skip_edge_evaluation: true })
  }

  return emptyResult({
    messages: config.farewell_message ? [{ type: 'text', text: config.farewell_message }] : [],
    skip_edge_evaluation: true,
  })
}

// ── input ─────────────────────────────────────────────────────────────────────

export function executeInputNode(node: FlowNode, session: FlowSession, inbound: string): NodeResult {
  const config = node.config as InputConfig
  const context_updates: Record<string, unknown> = {}

  // Validate if configured
  if (config.validation) {
    let valid = false
    if (config.validation.type === 'regex') {
      try { valid = new RegExp(config.validation.value).test(inbound) } catch { valid = false }
    } else if (config.validation.type === 'length') {
      valid = inbound.length >= Number(config.validation.value)
    } else {
      valid = inbound.length > 0
    }
    if (!valid) {
      return emptyResult({
        messages: [{ type: 'text', text: config.validation.error_message }],
        next_node_id: session.current_node_id,
        skip_edge_evaluation: true,
        consumes_input: true,
      })
    }
  }

  context_updates[config.store_as] = inbound

  return emptyResult({
    context_updates,
    consumes_input: true,
  })
}

// ── condition ─────────────────────────────────────────────────────────────────

export function executeConditionNode(_node: FlowNode, _session: FlowSession, _inbound: string): NodeResult {
  return emptyResult({ consumes_input: true })
}

// ── delay ─────────────────────────────────────────────────────────────────────

export function executeDelayNode(node: FlowNode, _session: FlowSession, _inbound: string): NodeResult {
  const config = node.config as DelayConfig
  void config.delay_secs
  return emptyResult()
}

// ── jump ──────────────────────────────────────────────────────────────────────

export function executeJumpNode(node: FlowNode, session: FlowSession, _inbound: string): NodeResult {
  const config = node.config as JumpConfig

  if (config.target_flow_id && config.target_flow_id !== session.flow_id) {
    session.flow_id = config.target_flow_id
    session.call_stack = []
  }

  return emptyResult({
    next_node_id: config.target_node_id,
    skip_edge_evaluation: true,
  })
}

// ── subflow ───────────────────────────────────────────────────────────────────

export function executeSubflowNode(
  node: FlowNode,
  session: FlowSession,
  _inbound: string,
  subflowEntryNodeId: string,
): NodeResult {
  const config = node.config as SubflowConfig

  if (session.call_stack.length >= 10) {
    return emptyResult({
      messages: [{ type: 'text', text: "Sorry, something went wrong. Please type 'hi' to restart." }],
      next_node_id: null,
      skip_edge_evaluation: true,
    })
  }

  if (session.call_stack.some(f => f.flow_id === config.subflow_id)) {
    return emptyResult({
      messages: [{ type: 'text', text: "Sorry, something went wrong. Please type 'hi' to restart." }],
      next_node_id: null,
      skip_edge_evaluation: true,
    })
  }

  session.call_stack.push({
    flow_id: session.flow_id,
    return_node_id: node.id,  // turn-executor resolves the actual successor via the outgoing edge of this node
    context_snapshot: { ...session.context },
  })

  session.flow_id = config.subflow_id

  return emptyResult({
    next_node_id: subflowEntryNodeId,
    skip_edge_evaluation: true,
  })
}

// ── handoff ───────────────────────────────────────────────────────────────────

export function executeHandoffNode(node: FlowNode, _session: FlowSession, _inbound: string): NodeResult {
  const config = node.config as HandoffConfig

  return emptyResult({
    messages: [{ type: 'text', text: config.message || 'Connecting you to our team...' }],
    skip_edge_evaluation: true,
    context_updates: {
      '__handoff_department': config.department,
      '__handoff_resume_node_id': config.resume_node_id ?? null,
    },
  })
}

// ── api ───────────────────────────────────────────────────────────────────────

export async function executeApiNode(
  node: FlowNode,
  session: FlowSession,
  _inbound: string,
  fetchFn: typeof fetch,
): Promise<NodeResult> {
  const config = node.config as ApiConfig

  const body = (config.body_template || '').replace(
    /\{\{context\.([^}]+)\}\}/g,
    (_: string, key: string) => String(session.context[key] ?? ''),
  )

  const attempts = (config.retry_count ?? 2) + 1
  let lastError: string = ''

  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), (config.timeout_secs ?? 10) * 1000)
      const response = await fetchFn(config.url, {
        method: config.method,
        headers: { 'Content-Type': 'application/json', ...config.headers },
        body: config.method !== 'GET' ? body : undefined,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!response.ok) {
        lastError = `HTTP ${response.status}`
        continue
      }

      const data = await response.json()
      return emptyResult({
        context_updates: { [config.response_variable]: data },
      })
    } catch (err) {
      lastError = String(err)
    }
  }

  return emptyResult({
    context_updates: { [`${config.response_variable}_error`]: lastError },
  })
}
