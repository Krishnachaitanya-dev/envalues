// supabase/functions/whatsapp-webhook/engine/turn-executor.ts
import type { FlowNode, FlowEdge, FlowSession, OutboundMessage, InputConfig } from './types.ts'
import { evaluateEdges } from './edge-evaluator.ts'
import {
  executeStartNode, executeMessageNode, executeEndNode,
  executeInputNode, executeConditionNode, executeDelayNode,
  executeJumpNode, executeSubflowNode, executeHandoffNode,
  executeApiNode,
} from './node-executors.ts'

export interface TurnDeps {
  getNode: (id: string) => Promise<FlowNode | null>
  getOutgoingEdges: (nodeId: string) => Promise<FlowEdge[]>
  saveSession: (session: FlowSession) => Promise<void>
  enqueueMessages: (messages: OutboundMessage[], phone: string) => Promise<void>
  sendHandoffAlert: (ownerPhone: string, customerPhone: string, department: string) => Promise<void>
  closeSession: (session: FlowSession) => Promise<void>
  killSession: (session: FlowSession, reason?: string) => Promise<void>
  fetchFn: typeof fetch
  getSubflowEntryNode: (subflowId: string) => Promise<string | null>
  evalExpression?: (expr: string, ctx: { input: string; context: Record<string, unknown> }) => boolean
  ownerReceptionPhone?: string
}

const TURN_TIMEOUT_MS = 3000
const INPUT_PROMPTED_CONTEXT_KEY = '__input_prompted_at'
const INPUT_PENDING_CONTEXT_KEY = '__input_pending_at'
const LAST_CHOICE_NODE_CONTEXT_KEY = '__last_choice_node_id'

type OutboundMediaType = Extract<OutboundMessage['type'], 'image' | 'video' | 'document'>

function compactTextParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}

function normalizeOutboundMediaType(type: unknown): OutboundMediaType {
  return type === 'image' || type === 'video' || type === 'document' ? type : 'document'
}

function inputPromptMessages(node: FlowNode): OutboundMessage[] {
  const config = node.config as unknown as InputConfig
  const prompt = typeof config.prompt === 'string' ? config.prompt.trim() : ''
  const footer = typeof config.footer === 'string' ? config.footer.trim() : ''
  const attachments = Array.isArray(config.attachments) && config.attachments.length > 0
    ? config.attachments
    : config.media_url
      ? [{ type: config.media_type ?? 'document', url: config.media_url }]
      : []
  const validAttachments = attachments.filter((att) => att.url)

  if (validAttachments.length === 0) {
    const text = compactTextParts([prompt, footer])
    return text ? [{ type: 'text', text }] : []
  }

  let promptApplied = false
  return validAttachments.map((att) => {
    const shouldApplyPrompt = !promptApplied
    promptApplied = true
    const mediaType = normalizeOutboundMediaType(att.type)
    return {
      type: mediaType,
      url: att.url,
      caption: shouldApplyPrompt ? compactTextParts([prompt, att.caption, footer]) || undefined : att.caption,
    }
  })
}

async function pauseAtInputNode(session: FlowSession, node: FlowNode, deps: TurnDeps): Promise<void> {
  session.current_node_id = node.id
  const alreadyPrompted = session.context[INPUT_PROMPTED_CONTEXT_KEY] === node.id

  if (!alreadyPrompted) {
    session.context = { ...session.context, [INPUT_PROMPTED_CONTEXT_KEY]: node.id }
  }

  await deps.saveSession(session)

  if (!alreadyPrompted) {
    const messages = inputPromptMessages(node)
    if (messages.length > 0) await deps.enqueueMessages(messages, session.phone)
  }
}

export async function executeTurn(session: FlowSession, inbound: string, deps: TurnDeps): Promise<void> {
  const visited = new Set<string>()
  const turnStart = Date.now()
  let remainingInbound = inbound

  let currentNode = await deps.getNode(session.current_node_id)
  if (!currentNode) {
    await deps.killSession(session, 'missing_node')
    return
  }

  const lastChoiceNodeId = session.context[LAST_CHOICE_NODE_CONTEXT_KEY] as string | undefined
  if (remainingInbound && lastChoiceNodeId && lastChoiceNodeId !== currentNode.id) {
    const lastChoiceEdges = (await deps.getOutgoingEdges(lastChoiceNodeId))
      .filter(edge => !edge.is_fallback && edge.condition_type !== 'always')
    const correctedNextId = evaluateEdges(lastChoiceEdges, session, remainingInbound, deps.evalExpression)
    if (correctedNextId) {
      const lastChoiceNode = await deps.getNode(lastChoiceNodeId)
      if (lastChoiceNode) {
        session.current_node_id = lastChoiceNodeId
        session.context = { ...session.context, [INPUT_PENDING_CONTEXT_KEY]: lastChoiceNodeId }
        currentNode = lastChoiceNode
      }
    }
  }

  while (session.step_count < session.max_steps) {

    // Safety: per-turn timeout
    if (Date.now() - turnStart > TURN_TIMEOUT_MS) {
      await deps.killSession(session, 'timeout')
      return
    }

    // Safety: cycle detection
    if (visited.has(currentNode.id)) {
      await deps.killSession(session, 'cycle')
      return
    }
    visited.add(currentNode.id)

    // Input node: pause if no inbound — wait for next turn
    if (currentNode.node_type === 'input' && !remainingInbound) {
      await pauseAtInputNode(session, currentNode, deps)
      return
    }

    // If we paused here waiting for a button reply, skip re-executing this node
    // and go straight to edge evaluation with the new inbound text
    const inputPendingAt = session.context[INPUT_PENDING_CONTEXT_KEY] as string | undefined
    const skipExecution = inputPendingAt === currentNode.id
    if (skipExecution) {
      const ctx = { ...session.context }
      delete ctx[INPUT_PENDING_CONTEXT_KEY]
      session.context = ctx
    }

    // Execute current node
    let result
    if (!skipExecution) {
    switch (currentNode.node_type) {
      case 'start':
        result = executeStartNode(currentNode, session, remainingInbound)
        break
      case 'message':
        result = executeMessageNode(currentNode, session, remainingInbound)
        break
      case 'end':
        result = executeEndNode(currentNode, session)
        break
      case 'input':
        result = executeInputNode(currentNode, session, remainingInbound)
        break
      case 'condition':
        result = executeConditionNode(currentNode, session, remainingInbound)
        break
      case 'delay':
        result = executeDelayNode(currentNode, session, remainingInbound)
        break
      case 'jump':
        result = executeJumpNode(currentNode, session, remainingInbound)
        break
      case 'subflow': {
        const entryNodeId = await deps.getSubflowEntryNode((currentNode.config as { subflow_id: string }).subflow_id)
        result = executeSubflowNode(currentNode, session, remainingInbound, entryNodeId ?? '')
        break
      }
      case 'handoff':
        result = executeHandoffNode(currentNode, session, remainingInbound)
        break
      case 'api':
        result = await executeApiNode(currentNode, session, remainingInbound, deps.fetchFn)
        break
      default:
        result = { messages: [], context_updates: {}, next_node_id: null, skip_edge_evaluation: false, consumes_input: false }
    }
    } else {
      // Resuming after pause — skip re-execution, proceed to edge evaluation
      result = { messages: [], context_updates: {}, next_node_id: null, skip_edge_evaluation: false, consumes_input: false }
    }

    // Persist state first (state-first guarantee)
    session.context = { ...session.context, ...result.context_updates }
    if (currentNode.node_type === 'input' && result.consumes_input) {
      const ctx = { ...session.context }
      delete ctx[INPUT_PROMPTED_CONTEXT_KEY]
      session.context = ctx
    }
    session.step_count++
    session.last_node_executed_at = new Date().toISOString()
    await deps.saveSession(session)

    // Enqueue messages for delivery
    if (result.messages.length > 0) {
      await deps.enqueueMessages(result.messages, session.phone)
    }

    // Pause at message nodes with conditional outgoing edges so the user can
    // tap a button before edge evaluation proceeds.
    if (currentNode.node_type === 'message' && !skipExecution) {
      const allEdges = await deps.getOutgoingEdges(currentNode.id)
      const hasConditionalEdges = allEdges
        .filter(e => !e.is_fallback)
        .some(e => e.condition_type !== 'always')
      if (hasConditionalEdges) {
        session.context = {
          ...session.context,
          [INPUT_PENDING_CONTEXT_KEY]: currentNode.id,
          [LAST_CHOICE_NODE_CONTEXT_KEY]: currentNode.id,
        }
        session.current_node_id = currentNode.id
        await deps.saveSession(session)
        return
      }
    }

    // Handle handoff — set status and alert reception
    if (currentNode.node_type === 'handoff') {
      session.status = 'handoff'
      if (deps.ownerReceptionPhone) {
        await deps.sendHandoffAlert(
          deps.ownerReceptionPhone,
          session.phone,
          String(result.context_updates['__handoff_department'] ?? ''),
        )
      }
      await deps.saveSession(session)
      return
    }

    // Handle end node with empty call stack (terminal)
    if (currentNode.node_type === 'end' && !result.next_node_id) {
      await deps.closeSession(session)
      return
    }

    // Handle end node that popped call stack (return to parent)
    if (currentNode.node_type === 'end' && result.next_node_id) {
      const returnNode = await deps.getNode(result.next_node_id)
      if (!returnNode) { await deps.killSession(session, 'missing_return_node'); return }
      if (returnNode.node_type === 'subflow') {
        const returnEdges = await deps.getOutgoingEdges(returnNode.id)
        const successorId = evaluateEdges(returnEdges, session, '', deps.evalExpression)
        if (!successorId) {
          await deps.saveSession(session)
          return
        }
        const successorNode = await deps.getNode(successorId)
        if (!successorNode) { await deps.killSession(session, 'missing_return_node'); return }
        currentNode = successorNode
      } else {
        currentNode = returnNode
      }
      if (result.consumes_input) remainingInbound = ''
      continue
    }

    // Resolve next node via edge evaluation or direct routing
    let nextNodeId: string | null
    if (result.skip_edge_evaluation) {
      nextNodeId = result.next_node_id
    } else {
      const edges = await deps.getOutgoingEdges(currentNode.id)
      nextNodeId = evaluateEdges(edges, session, remainingInbound, deps.evalExpression)
    }

    if (result.consumes_input) remainingInbound = ''

    // Dead end: no matching edge
    if (!nextNodeId) {
      await deps.saveSession(session)
      await deps.enqueueMessages([{ type: 'text', text: "I didn't understand that. Type 'hi' to start over." }], session.phone)
      return
    }

    const nextNode = await deps.getNode(nextNodeId)
    if (!nextNode) { await deps.killSession(session, 'missing_node'); return }

    // Pause before input nodes — next turn will execute with new inbound
    if (nextNode.node_type === 'input') {
      await pauseAtInputNode(session, nextNode, deps)
      return
    }

    currentNode = nextNode
  }

  // Step limit exceeded
  if (session.step_count >= session.max_steps) {
    await deps.killSession(session, 'max_steps')
  }
}
