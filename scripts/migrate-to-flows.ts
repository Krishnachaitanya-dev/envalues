// scripts/migrate-to-flows.ts
// Usage: npx tsx scripts/migrate-to-flows.ts [--dry-run]
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or .env file)

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const DRY_RUN = process.argv.includes('--dry-run')

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Chatbot {
  id: string
  owner_id: string
  chatbot_name: string
  greeting_message: string
  farewell_message: string
  is_active: boolean
}

export interface QAPair {
  id: string
  chatbot_id: string
  question_text: string
  answer_text: string
  is_main_question: boolean
  parent_question_id: string | null
  display_order: number
  media_url: string | null
  media_type: string | null
}

export interface FlowRow {
  id: string
  owner_id: string
  name: string
  status: 'draft' | 'published' | 'archived'
  version: number
  entry_node_id: string | null
}

export interface FlowNodeRow {
  id: string
  flow_id: string
  owner_id: string
  node_type: string
  label: string
  config: Record<string, unknown>
  position_x: number
  position_y: number
  legacy_qa_pair_id: string | null
}

export interface FlowEdgeRow {
  id: string
  flow_id: string
  owner_id: string
  source_node_id: string
  target_node_id: string
  condition_type: string
  condition_value: string | null
  is_fallback: boolean
  priority: number
}

export interface FlowTriggerRow {
  id: string
  owner_id: string
  flow_id: string
  target_node_id: string | null
  trigger_type: string
  trigger_value: string | null
  priority: number
  is_active: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ── Pure functions (testable without DB) ──────────────────────────────────────

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

export function buildFlowFromChatbot(chatbot: Chatbot): FlowRow {
  return {
    id: randomUUID(),
    owner_id: chatbot.owner_id,
    name: chatbot.chatbot_name,
    status: chatbot.is_active ? 'published' : 'draft',
    version: 1,
    entry_node_id: null,  // set after nodes are created
  }
}

export function buildStartAndGreetingNodes(
  chatbot: Chatbot,
  flowId: string
): { startNode: FlowNodeRow; greetingNode: FlowNodeRow; endNode: FlowNodeRow } {
  const startNode: FlowNodeRow = {
    id: randomUUID(),
    flow_id: flowId,
    owner_id: chatbot.owner_id,
    node_type: 'start',
    label: 'Start',
    config: {},
    position_x: 80,
    position_y: 300,
    legacy_qa_pair_id: null,
  }

  const greetingNode: FlowNodeRow = {
    id: randomUUID(),
    flow_id: flowId,
    owner_id: chatbot.owner_id,
    node_type: 'message',
    label: 'Greeting',
    config: { text: chatbot.greeting_message },
    position_x: 320,
    position_y: 300,
    legacy_qa_pair_id: null,
  }

  const endNode: FlowNodeRow = {
    id: randomUUID(),
    flow_id: flowId,
    owner_id: chatbot.owner_id,
    node_type: 'end',
    label: 'End',
    config: { farewell_message: chatbot.farewell_message },
    position_x: 80,
    position_y: 500,
    legacy_qa_pair_id: null,
  }

  return { startNode, greetingNode, endNode }
}

export function buildMessageNodesFromQAPairs(
  qaPairs: QAPair[],
  flowId: string,
  ownerId: string
): FlowNodeRow[] {
  return qaPairs.map((qa, i) => {
    const config: Record<string, unknown> = { text: qa.answer_text }
    if (qa.media_url && qa.media_type) {
      config.attachments = [{
        type: qa.media_type,
        url: qa.media_url,
      }]
    }
    return {
      id: randomUUID(),
      flow_id: flowId,
      owner_id: ownerId,
      node_type: 'message',
      label: qa.question_text,
      config,
      position_x: 320 + (qa.parent_question_id ? 240 : 0),
      position_y: 80 + i * 120,
      legacy_qa_pair_id: qa.id,
    }
  })
}

// nodeMap: keys are '__start__', '__greeting__', and qa_pair.id; values are node UUIDs
export function buildEdgesFromQAPairs(
  qaPairs: QAPair[],
  nodeMap: Record<string, string>,
  flowId: string,
  ownerId: string
): FlowEdgeRow[] {
  const edges: FlowEdgeRow[] = []
  const startId = nodeMap['__start__']
  const greetingId = nodeMap['__greeting__']

  // start → greeting (always)
  edges.push({
    id: randomUUID(),
    flow_id: flowId,
    owner_id: ownerId,
    source_node_id: startId,
    target_node_id: greetingId,
    condition_type: 'always',
    condition_value: null,
    is_fallback: false,
    priority: 0,
  })

  // greeting → fallback → greeting (loop on unknown input)
  edges.push({
    id: randomUUID(),
    flow_id: flowId,
    owner_id: ownerId,
    source_node_id: greetingId,
    target_node_id: greetingId,
    condition_type: 'always',
    condition_value: null,
    is_fallback: true,
    priority: 0,
  })

  const rootQAPairs = qaPairs.filter(qa => qa.parent_question_id === null)
  const childQAPairs = qaPairs.filter(qa => qa.parent_question_id !== null)

  // greeting → root message nodes (by question_text = button tap)
  for (const qa of rootQAPairs) {
    edges.push({
      id: randomUUID(),
      flow_id: flowId,
      owner_id: ownerId,
      source_node_id: greetingId,
      target_node_id: nodeMap[qa.id],
      condition_type: 'equals',
      condition_value: qa.question_text,
      is_fallback: false,
      priority: qa.display_order,
    })
  }

  // parent message → child message nodes
  for (const qa of childQAPairs) {
    const parentNodeId = nodeMap[qa.parent_question_id!]
    if (!parentNodeId) continue
    edges.push({
      id: randomUUID(),
      flow_id: flowId,
      owner_id: ownerId,
      source_node_id: parentNodeId,
      target_node_id: nodeMap[qa.id],
      condition_type: 'equals',
      condition_value: qa.question_text,
      is_fallback: false,
      priority: qa.display_order,
    })
  }

  // Leaf nodes (no children) → fallback back to greeting
  const childTargetIds = new Set(childQAPairs.map(qa => nodeMap[qa.parent_question_id!]))
  const leafQAPairs = qaPairs.filter(qa => !childTargetIds.has(nodeMap[qa.id]))
  for (const qa of leafQAPairs) {
    const nodeId = nodeMap[qa.id]
    if (!nodeId) continue
    edges.push({
      id: randomUUID(),
      flow_id: flowId,
      owner_id: ownerId,
      source_node_id: nodeId,
      target_node_id: greetingId,
      condition_type: 'always',
      condition_value: null,
      is_fallback: true,
      priority: 0,
    })
  }

  // Parent nodes that have children also need a fallback back to greeting
  for (const parentId of childTargetIds) {
    if (!parentId) continue
    edges.push({
      id: randomUUID(),
      flow_id: flowId,
      owner_id: ownerId,
      source_node_id: parentId,
      target_node_id: greetingId,
      condition_type: 'always',
      condition_value: null,
      is_fallback: true,
      priority: 0,
    })
  }

  return edges
}

export function buildTriggersFromChatbot(
  chatbot: Chatbot,
  flowId: string,
  ownerId: string,
  greetingNodeId: string
): FlowTriggerRow[] {
  const restartValues = ['hi', 'hello', 'start', 'menu']
  const restarts: FlowTriggerRow[] = restartValues.map((value, i) => ({
    id: randomUUID(),
    owner_id: ownerId,
    flow_id: flowId,
    target_node_id: null,
    trigger_type: 'restart',
    trigger_value: value,
    priority: i,
    is_active: true,
  }))

  const defaultTrigger: FlowTriggerRow = {
    id: randomUUID(),
    owner_id: ownerId,
    flow_id: flowId,
    target_node_id: greetingNodeId,
    trigger_type: 'default',
    trigger_value: null,
    priority: 0,
    is_active: true,
  }

  return [...restarts, defaultTrigger]
}

export function validateMigrationResult(
  entryNodeId: string | null,
  nodes: { id: string; node_type: string }[],
  edges: { source_node_id: string; target_node_id: string; is_fallback: boolean }[],
  originalQAPairCount: number
): ValidationResult {
  const errors: string[] = []

  if (!entryNodeId) {
    errors.push('entry_node_id is not set')
    return { valid: false, errors }
  }

  // Terminal node types — these don't need outgoing edges or fallback edges
  const terminalTypes = new Set(['end', 'handoff', 'start'])

  const outgoingByNode = new Map<string, typeof edges>()
  for (const edge of edges) {
    if (!outgoingByNode.has(edge.source_node_id)) {
      outgoingByNode.set(edge.source_node_id, [])
    }
    outgoingByNode.get(edge.source_node_id)!.push(edge)
  }

  for (const node of nodes) {
    if (terminalTypes.has(node.node_type)) continue

    const outgoing = outgoingByNode.get(node.id) ?? []

    if (outgoing.length === 0) {
      errors.push(`Node ${node.id} (${node.node_type}) has no outgoing edge`)
      continue
    }

    // Non-terminal nodes that have any conditional (non-fallback) edges must also have a fallback
    const nonFallbacks = outgoing.filter(e => !e.is_fallback)
    const fallbacks = outgoing.filter(e => e.is_fallback)
    if (nonFallbacks.length > 0 && fallbacks.length === 0) {
      errors.push(`Node ${node.id} (${node.node_type}) has multiple edges but is missing fallback edge`)
    } else if (fallbacks.length > 1) {
      errors.push(`Node ${node.id} (${node.node_type}) has multiple fallback edges (max 1 allowed)`)
    }
  }

  // Node count: should have start + greeting + 1 per qa_pair (at minimum)
  const expectedMinNodes = originalQAPairCount + 2  // start, greeting
  if (nodes.length < expectedMinNodes) {
    errors.push(`Expected at least ${expectedMinNodes} nodes, got ${nodes.length}`)
  }

  return { valid: errors.length === 0, errors }
}

// ── DB execution (not tested — uses real Supabase client) ─────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const db = createClient(supabaseUrl, supabaseKey)

  console.log(`\n🚀 Starting migration ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'}`)
  console.log('─'.repeat(60))

  const { data: chatbots, error: chatbotsErr } = await db.from('chatbots').select('*')
  if (chatbotsErr) { console.error('Failed to fetch chatbots:', chatbotsErr); process.exit(1) }
  if (!chatbots?.length) { console.log('No chatbots found — nothing to migrate.'); return }

  let totalFlows = 0, totalNodes = 0, totalEdges = 0, totalTriggers = 0
  const validationErrors: string[] = []

  for (const chatbot of chatbots) {
    console.log(`\n📦 Migrating chatbot: "${chatbot.chatbot_name}" (${chatbot.id})`)

    const { data: qaPairs } = await db.from('qa_pairs')
      .select('*').eq('chatbot_id', chatbot.id).order('display_order')

    const pairs: QAPair[] = qaPairs ?? []

    // Build all objects
    const flow = buildFlowFromChatbot(chatbot)
    const { startNode, greetingNode, endNode } = buildStartAndGreetingNodes(chatbot, flow.id)
    const qaNodes = buildMessageNodesFromQAPairs(pairs, flow.id, chatbot.owner_id)

    const allNodes = [startNode, greetingNode, endNode, ...qaNodes]

    // Build nodeMap for edge construction
    const nodeMap: Record<string, string> = {
      '__start__': startNode.id,
      '__greeting__': greetingNode.id,
    }
    for (const node of qaNodes) {
      if (node.legacy_qa_pair_id) nodeMap[node.legacy_qa_pair_id] = node.id
    }

    const edges = buildEdgesFromQAPairs(pairs, nodeMap, flow.id, chatbot.owner_id)
    const triggers = buildTriggersFromChatbot(chatbot, flow.id, chatbot.owner_id, greetingNode.id)

    // Set entry_node_id
    flow.entry_node_id = startNode.id

    // Validate
    const validation = validateMigrationResult(
      flow.entry_node_id,
      allNodes.map(n => ({ id: n.id, node_type: n.node_type })),
      edges,
      pairs.length
    )

    if (!validation.valid) {
      console.error(`  ❌ Validation failed:`)
      for (const err of validation.errors) console.error(`     - ${err}`)
      validationErrors.push(...validation.errors.map(e => `[${chatbot.chatbot_name}] ${e}`))
      continue
    }

    console.log(`  ✅ ${allNodes.length} nodes, ${edges.length} edges, ${triggers.length} triggers`)

    if (DRY_RUN) {
      console.log('  (dry-run: skipping writes)')
      totalFlows++; totalNodes += allNodes.length; totalEdges += edges.length; totalTriggers += triggers.length
      continue
    }

    // Write to DB (in order: flow → nodes → edges + triggers → set entry_node_id)
    const { error: flowErr } = await db.from('flows').insert({ ...flow, entry_node_id: null })
    if (flowErr) { console.error(`  DB error inserting flow:`, flowErr); continue }

    const { error: nodesErr } = await db.from('flow_nodes').insert(allNodes)
    if (nodesErr) { console.error(`  DB error inserting nodes:`, nodesErr); continue }

    const { error: edgesErr } = await db.from('flow_edges').insert(edges)
    if (edgesErr) { console.error(`  DB error inserting edges:`, edgesErr); continue }

    const { error: triggersErr } = await db.from('flow_triggers').insert(triggers)
    if (triggersErr) { console.error(`  DB error inserting triggers:`, triggersErr); continue }

    // Now set entry_node_id (deferred FK constraint)
    const { error: entryErr } = await db.from('flows').update({ entry_node_id: startNode.id }).eq('id', flow.id)
    if (entryErr) { console.error(`  DB error setting entry_node_id:`, entryErr); continue }

    totalFlows++; totalNodes += allNodes.length; totalEdges += edges.length; totalTriggers += triggers.length
    console.log(`  💾 Written to DB.`)
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`\n📊 Summary:`)
  console.log(`   Flows:    ${totalFlows}`)
  console.log(`   Nodes:    ${totalNodes}`)
  console.log(`   Edges:    ${totalEdges}`)
  console.log(`   Triggers: ${totalTriggers}`)

  if (validationErrors.length > 0) {
    console.error('\n❌ Validation errors (chatbots skipped):')
    for (const err of validationErrors) console.error(`   - ${err}`)
    process.exit(1)
  }

  console.log('\n✅ Migration complete.\n')
}

// Only run main() when executed directly (not imported by tests)
if (process.argv[1].endsWith('migrate-to-flows.ts') ||
    process.argv[1].endsWith('migrate-to-flows.js')) {
  main().catch(err => { console.error(err); process.exit(1) })
}
