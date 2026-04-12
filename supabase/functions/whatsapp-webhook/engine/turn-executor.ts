// supabase/functions/whatsapp-webhook/engine/turn-executor.ts
import type { FlowNode, FlowEdge, FlowSession, OutboundMessage } from './types.ts'
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

export async function executeTurn(session: FlowSession, inbound: string, deps: TurnDeps): Promise<void> {
  const visited = new Set<string>()
  const turnStart = Date.now()
  let remainingInbound = inbound

  let currentNode = await deps.getNode(session.current_node_id)
  if (!currentNode) {
    await deps.killSession(session, 'missing_node')
    return
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
      session.current_node_id = currentNode.id
      await deps.saveSession(session)
      return
    }

    // Execute current node
    let result
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

    // Persist state first (state-first guarantee)
    session.context = { ...session.context, ...result.context_updates }
    session.step_count++
    session.last_node_executed_at = new Date().toISOString()
    await deps.saveSession(session)

    // Enqueue messages for delivery
    if (result.messages.length > 0) {
      await deps.enqueueMessages(result.messages, session.phone)
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
      currentNode = returnNode
      if (result.consumes_input) remainingInbound = ''
      continue
    }

    // Resolve next node via edge evaluation or direct routing
    let nextNodeId: string | null
    if (result.skip_edge_evaluation) {
      nextNodeId = result.next_node_id
    } else {
      const edges = await deps.getOutgoingEdges(currentNode.id)
      nextNodeId = evaluateEdges(edges, session, result.consumes_input ? '' : remainingInbound, deps.evalExpression)
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
      session.current_node_id = nextNode.id
      await deps.saveSession(session)
      return
    }

    currentNode = nextNode
  }

  // Step limit exceeded
  if (session.step_count >= session.max_steps) {
    await deps.killSession(session, 'max_steps')
  }
}
