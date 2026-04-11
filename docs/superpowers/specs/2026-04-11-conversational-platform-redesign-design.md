# AlaChat: Conversational Automation Platform — Full System Design

**Date:** 2026-04-11
**Status:** Approved — ready for implementation planning
**Architect:** Principal review with full sign-off on all sections

---

## 1. System Overview

AlaChat is being redesigned from a single-chatbot menu builder into a **multi-tenant conversational automation platform**. The architectural analogy is WATI internals — but designed from scratch with the benefit of knowing where those systems break.

The fundamental shift:

| Before | After |
|--------|-------|
| One chatbot per owner (tree structure) | Multiple named flows per owner (graph structure) |
| Keywords hardcoded in webhook logic | Trigger engine with configurable routing |
| `qa_pairs` as the data model | `flow_nodes` + `flow_edges` as a directed graph |
| Linear parent/child traversal | Graph execution with call stack for subflows |
| Single-purpose booking tab | Reception number on owner record, no special tab |
| Custom tree canvas (BuilderPage) | React Flow graph canvas with typed node components |

**What this system actually is:**
> A deterministic, graph-based workflow engine with a messaging interface, multi-tenant data isolation, trigger-based entry routing, stack-based subflow control, and a graph canvas UI.

---

## 2. High-Level Architecture

```
Inbound Message (WhatsApp / Evolution / Meta)
         │
         ▼
   [Webhook Handler]
         │
         ├─ Idempotency check (message_id dedup)
         │
         ├─ Tenant lookup (owner by phone number / instance)
         │
         ▼
   [Trigger Engine]
         │
         ├─ Restart trigger? → kill session, create new
         │
         ├─ Active session? → skip trigger, go to engine
         │
         ├─ Resolve trigger (4-pass pipeline)
         │
         ▼
   [Flow Execution Engine]
         │
         ├─ Lock session (SELECT FOR UPDATE)
         │
         ├─ Turn loop: execute node → evaluate edges → move
         │
         ├─ Safety: cycle detection, step limit, per-turn timeout
         │
         ▼
   [Message Delivery]
         │
         ├─ Persist state first
         │
         ├─ Enqueue outbound messages
         │
         ▼
   [WhatsApp / Evolution API]
```

**Tech stack (unchanged from current):**
- Frontend: React 18 + TypeScript + Vite + shadcn-ui
- Backend: Supabase edge functions (Deno)
- Database: Postgres (Supabase) with RLS
- Storage: Supabase Storage (`chatbot-media` bucket)
- Canvas: React Flow (replaces custom tree canvas)

---

## 3. Database Schema

### 3.1 New Tables

#### `flows`
```sql
CREATE TABLE flows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
  version         integer NOT NULL DEFAULT 1,
  entry_node_id   uuid REFERENCES flow_nodes(id) DEFERRABLE INITIALLY DEFERRED,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_flows_owner ON flows(owner_id);
CREATE INDEX idx_flows_status ON flows(owner_id, status);
CREATE INDEX idx_flows_owner_status ON flows(owner_id, status) WHERE status = 'published';
```

**Status lifecycle:** `draft → published → archived`
- Only `published` flows are executed by the engine
- Active sessions always run on the version they started on (snapshot semantics — Phase 3)
- Phase 1: single version per flow, publishing replaces live immediately

#### `flow_nodes`
```sql
CREATE TABLE flow_nodes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  node_type       text NOT NULL
                    CHECK (node_type IN (
                      'start', 'message', 'input', 'condition',
                      'api', 'delay', 'jump', 'subflow', 'handoff', 'end'
                    )),
  label           text,
  config          jsonb NOT NULL DEFAULT '{}',
  position_x      float NOT NULL DEFAULT 0,
  position_y      float NOT NULL DEFAULT 0,
  legacy_qa_pair_id uuid,  -- migration debugging only, drop after Phase 2
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_flow_nodes_flow ON flow_nodes(flow_id);
CREATE INDEX idx_flow_nodes_owner_flow ON flow_nodes(owner_id, flow_id);  -- composite for tenant-scoped graph fetch
CREATE INDEX idx_flow_nodes_type ON flow_nodes(flow_id, node_type);
```

**Note:** `flows.entry_node_id` is the single source of truth for the entry point. No `is_entry` column on nodes.

#### `flow_edges`
```sql
CREATE TABLE flow_edges (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id              uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  owner_id             uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,  -- tenant isolation
  source_node_id       uuid NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id       uuid NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  condition_type       text NOT NULL DEFAULT 'always'
                         CHECK (condition_type IN (
                           'always', 'equals', 'contains',
                           'starts_with', 'regex',
                           'variable_equals', 'variable_contains'
                         )),
  condition_value      text,
  condition_variable   text,
  condition_expression text,  -- complex: "context.plan == 'pro' AND context.age > 18"
  is_fallback          boolean NOT NULL DEFAULT false,
  priority             integer NOT NULL DEFAULT 0,
  label                text,
  created_at           timestamptz DEFAULT now()
);

-- Enforce determinism: no two edges from same source at same priority
CREATE UNIQUE INDEX idx_flow_edges_priority
  ON flow_edges(source_node_id, priority)
  WHERE NOT is_fallback;

-- Enforce single fallback per source node
CREATE UNIQUE INDEX idx_flow_edges_fallback
  ON flow_edges(source_node_id)
  WHERE is_fallback = true;

CREATE INDEX idx_flow_edges_source ON flow_edges(source_node_id);   -- critical: edge lookup per turn
CREATE INDEX idx_flow_edges_owner_flow ON flow_edges(owner_id, flow_id);  -- composite for tenant graph fetch
CREATE INDEX idx_flow_edges_flow ON flow_edges(flow_id);
```

**Routing rule:** Edges own all routing logic. Nodes never decide their successor (except `jump` and `subflow`, which bypass edge evaluation by contract).

**Expression safety:** `condition_expression` is evaluated using JEXL (safe expression language — no `eval`). Expression context: `{ input: string, context: Record<string, any> }`.

#### `flow_triggers`
```sql
CREATE TABLE flow_triggers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  flow_id         uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  target_node_id  uuid REFERENCES flow_nodes(id),  -- null = use flow.entry_node_id
  trigger_type    text NOT NULL
                    CHECK (trigger_type IN ('keyword', 'api', 'default', 'restart')),
  trigger_value   text,
  priority        integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- Enforce single default trigger per owner
CREATE UNIQUE INDEX idx_flow_triggers_default
  ON flow_triggers(owner_id)
  WHERE trigger_type = 'default' AND is_active = true;

CREATE INDEX idx_flow_triggers_owner ON flow_triggers(owner_id, is_active);
CREATE INDEX idx_flow_triggers_lookup ON flow_triggers(owner_id, trigger_type, is_active);  -- 4-pass pipeline
```

#### `flow_sessions`
```sql
CREATE TABLE flow_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  flow_id                 uuid NOT NULL REFERENCES flows(id),
  current_node_id         uuid NOT NULL REFERENCES flow_nodes(id),
  phone                   text NOT NULL,
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'handoff', 'expired', 'error')),
  context                 jsonb NOT NULL DEFAULT '{}',
  call_stack              jsonb NOT NULL DEFAULT '[]',
  step_count              integer NOT NULL DEFAULT 0,
  max_steps               integer NOT NULL DEFAULT 100,
  last_node_executed_at   timestamptz,
  last_message_at         timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(owner_id, phone)  -- one active session per phone per tenant
);

CREATE INDEX idx_flow_sessions_status ON flow_sessions(owner_id, status);
CREATE INDEX idx_flow_sessions_phone ON flow_sessions(owner_id, phone);
```

**Session state machine:**
```
                    ┌─────────────────────────────┐
                    │                             │
              inbound msg                    restart trigger
                    │                             │
                    ▼                             │
               [ACTIVE] ◄──────────────────agent releases
                    │
         ┌──────────┼──────────┬─────────────┐
         ▼          ▼          ▼             ▼
    [COMPLETED] [HANDOFF]  [EXPIRED]     [ERROR]
         │          │          │
    restart →   24h cron   next msg →
    trigger     → EXPIRED  trigger
```

**Call stack entry format:**
```json
{
  "flow_id": "uuid",
  "return_node_id": "uuid",
  "context_snapshot": {}
}
```
Max call stack depth: 10. Same-flow re-entry check prevents infinite subflow recursion.

#### `owners` (ALTER)
```sql
ALTER TABLE owners ADD COLUMN IF NOT EXISTS reception_phone text;
```
One reception WhatsApp number per tenant. Set in Settings page. Used by the `handoff` node to send alerts.

---

### 3.2 Tables to DROP (Phase 1)

All safe to drop — no production data:

```sql
DROP TABLE IF EXISTS booking_blocked_slots;
DROP TABLE IF EXISTS booking_appointments;
DROP TABLE IF EXISTS booking_patients;
DROP TABLE IF EXISTS booking_conversation_state;
DROP TABLE IF EXISTS booking_configs;
DROP TABLE IF EXISTS evolution_messages;   -- no owner_id: violates multi-tenant model
DROP TABLE IF EXISTS evolution_reminders;  -- no owner_id: violates multi-tenant model
ALTER TABLE chatbots DROP COLUMN IF EXISTS chatbot_type;
```

### 3.3 Tables to DEPRECATE → MIGRATE → DROP

| Table | Replaced by | Drop after |
|-------|-------------|------------|
| `chatbots` | `flows` | Phase 2 engine live |
| `qa_pairs` | `flow_nodes` + `flow_edges` | Phase 2 migration validated |
| `customer_sessions` | `flow_sessions` | Phase 2 engine live |

**Migration mapping — `qa_pairs` → graph:**
```
chatbot → flow
  chatbot.chatbot_name → flow.name
  chatbot.is_active → flow.status ('published' / 'draft')

Per chatbot, create:
  1. start node (node_type='start')
     → set as flow.entry_node_id
  2. greeting message node (node_type='message')
     config.text = chatbot.greeting_message
  3. edge: start → greeting (condition_type='always')

Per root qa_pair (parent_question_id IS NULL):
  4. message node (node_type='message')
     config.text = qa_pair.answer_text
     config.attachments = [{type: qa_pair.media_type, url: qa_pair.media_url}] if present
     legacy_qa_pair_id = qa_pair.id
  5. edge: greeting → message node
     condition_type = 'equals'
     condition_value = qa_pair.question_text
     priority = qa_pair.display_order

Per child qa_pair (parent_question_id IS NOT NULL):
  6. message node (same as above)
  7. edge: parent_message_node → child_message_node
     condition_type = 'equals'
     condition_value = qa_pair.question_text
     priority = qa_pair.display_order

For every non-terminal message node (no children):
  8. edge back to greeting node (is_fallback=true, condition_type='always')

For greeting node:
  9. fallback edge → greeting node itself (loop on unrecognized input)

Per chatbot, create restart trigger:
  10. trigger_type='restart', trigger_value='hi', flow_id=flow.id
  11. trigger_type='restart', trigger_value='hello', flow_id=flow.id
  12. trigger_type='default', flow_id=flow.id, target_node_id=greeting_node.id

Validate post-migration (migration validator — required before drop):
  - node count: flow_nodes count >= qa_pairs count for this chatbot
  - edge count: flow_edges count >= (qa_pairs count - 1) for this chatbot
  - no orphan nodes: every node except start has at least 1 incoming edge
  - no isolated nodes: every non-terminal node has at least 1 outgoing edge
  - fallback coverage: every non-terminal node has exactly 1 is_fallback=true edge
  - entry set: flow.entry_node_id is not null
  - traversal test: simulate "hi" → greeting → first menu item → confirm response returned
  Migration ships with --dry-run flag. Run dry-run first, review output, then run live.
```

---

## 4. Node Type Config Contracts

All configs live in `flow_nodes.config` (JSONB). These are the complete contracts per node type.

```typescript
// start — entry point, no config needed
type StartConfig = {}

// message — sends text + optional attachments
type MessageConfig = {
  text: string
  attachments?: Array<{
    type: 'image' | 'video' | 'document' | 'link'
    url: string
    caption?: string
  }>
}

// input — pauses execution, waits for user reply, stores response
type InputConfig = {
  prompt: string
  store_as: string           // context key, namespaced: e.g. "user.name"
  timeout_secs: number
  validation?: {
    type: 'regex' | 'length' | 'custom'
    value: string
    error_message: string    // sent to user on validation failure
  }
}

// condition — no config, routing lives entirely on outgoing edges
type ConditionConfig = {}

// api — makes HTTP call, stores result in context
type ApiConfig = {
  method: 'GET' | 'POST' | 'PUT'
  url: string
  headers: Record<string, string>
  body_template: string      // template with {{context.key}} interpolation
  response_variable: string  // context key to store response
  timeout_secs: number       // default: 10
  retry_count: number        // default: 2
}

// delay — pauses flow for N seconds
type DelayConfig = {
  delay_secs: number
}

// jump — redirects session to another node (same or different flow), no return
type JumpConfig = {
  target_flow_id?: string    // null = same flow
  target_node_id: string
}

// subflow — calls another flow with return semantics
type SubflowConfig = {
  subflow_id: string
  return_mode: 'auto' | 'manual'
  // auto: returns when subflow hits end node
  // manual: returns only on explicit return signal
}
// Subflow early exit rule (FLEXIBLE): if a jump node fires inside a subflow,
// the call stack is discarded and the session follows the jump unconditionally.
// Strict subflow enforcement creates stuck sessions — real users don't follow flows perfectly.

// handoff — escalates to human agent
type HandoffConfig = {
  department: string
  message: string            // sent to user
  allow_resume: boolean      // true: bot resumes after agent releases
  resume_node_id?: string    // null = resume from current node
  queue_strategy: 'round_robin' | 'priority'
  handoff_timeout_hours: number  // default: 24. After N hours with no agent activity → session expires
}

// end — closes session
type EndConfig = {
  farewell_message: string
}
```

---

## 5. Flow Execution Engine

### 5.1 Node Execution Contract

```typescript
interface NodeResult {
  messages: OutboundMessage[]
  context_updates: Record<string, any>  // namespaced keys only
  next_node_id: string | null           // null = edge evaluator decides
  skip_edge_evaluation: boolean         // true for jump + subflow only
  consumes_input: boolean               // true for input + condition nodes
}

type NodeExecutor = (
  node: FlowNode,
  session: FlowSession,
  inbound: string
) => Promise<NodeResult>
```

**The rule:** Nodes produce messages and context updates. Edges decide routing. Only `jump` and `subflow` set `next_node_id` directly by contract.

**Inbound lifecycle — single-turn scope:**
`inbound` is available only on the first node in a turn that has `consumes_input: true`. After that node executes, `inbound` is set to `''` for all subsequent nodes in the same turn. Inbound is never stored in session context automatically — only stored if an `input` node explicitly writes it via `store_as`. This prevents condition nodes from behaving differently based on their position in the execution chain.

### 5.2 Turn Execution Loop

```typescript
async function receive_message(owner_id: string, phone: string, raw_text: string, message_id: string) {

  // 1. Idempotency: skip if already processed
  if (await is_duplicate_message(message_id)) return

  // 2. Normalize input
  const text = normalize(raw_text)  // lowercase, strip punctuation, collapse spaces

  // 3. Handoff guard: bot is silent during agent sessions
  const session = await db.query('SELECT ... FROM flow_sessions WHERE owner_id=$1 AND phone=$2 FOR UPDATE', [owner_id, phone])
  if (session?.status === 'handoff') {
    await route_to_inbox(session, text)
    return
  }

  // 4. Restart trigger check (runs even if session exists)
  const restart = await find_restart_trigger(owner_id, text)
  if (restart) {
    if (session) await expire_session(session.id)
    const new_session = await create_session(owner_id, phone, restart)
    return await execute_turn(new_session, text)
  }

  // 5. Active session → continue
  if (session?.status === 'active') {
    return await execute_turn(session, text)
  }

  // 6. No session → trigger resolution
  const trigger = await resolve_trigger(owner_id, text)
  if (!trigger) {
    await send_message(phone, "Reply 'hi' to get started.")
    return
  }
  const new_session = await create_session(owner_id, phone, trigger)
  await execute_turn(new_session, text)
}

async function execute_turn(session: FlowSession, inbound: string) {
  const visited = new Set<string>()
  const turn_start = Date.now()
  let current_node = await get_node(session.current_node_id)

  while (session.step_count < session.max_steps) {

    // Safety: per-turn timeout (3 seconds wall clock)
    if (Date.now() - turn_start > 3000) {
      await kill_session(session, 'timeout')
      break
    }

    // Safety: cycle detection
    if (visited.has(current_node.id)) {
      await kill_session(session, 'cycle')
      break
    }
    visited.add(current_node.id)

    // Input node: execute only if inbound is present
    if (current_node.node_type === 'input' && !inbound) {
      await save_session(session)
      break
    }

    // Execute node (pure function)
    const result = await execute_node(current_node, session, inbound)

    // Persist state before sending (state-first guarantee)
    session.context = merge_context(session.context, result.context_updates)
    session.step_count++
    session.last_node_executed_at = new Date()
    session.current_node_id = result.next_node_id ?? session.current_node_id
    await save_session(session)

    // Enqueue messages for async delivery
    await enqueue_messages(result.messages, session.phone)

    // Resolve next node
    let next_node_id: string | null
    if (result.skip_edge_evaluation) {
      next_node_id = result.next_node_id
    } else {
      const edges = await get_outgoing_edges(current_node.id)
      next_node_id = evaluate_edges(edges, session, result.consumes_input ? '' : inbound)
    }

    // Dead end
    if (!next_node_id) {
      await enqueue_messages([{ text: "I didn't understand. Let's start over." }], session.phone)
      await reset_session_to_entry(session)
      break
    }

    current_node = await get_node(next_node_id)
    // inbound consumed once by the first input/condition node
    if (result.consumes_input) inbound = ''

    // Pause signals
    if (current_node.node_type === 'input') {
      // Next turn will execute this node with new inbound
      session.current_node_id = current_node.id
      await save_session(session)
      break
    }
    if (current_node.node_type === 'end') {
      await execute_node(current_node, session, '')
      await close_session(session)
      break
    }
    if (current_node.node_type === 'handoff') {
      await execute_node(current_node, session, '')
      await set_handoff(session)
      break
    }
  }

  // Safety: step limit
  if (session.step_count >= session.max_steps) {
    await kill_session(session, 'max_steps')
    await notify_tenant(session.owner_id, 'step_limit_exceeded', session)
  }
}
```

### 5.3 Edge Evaluator

```typescript
function evaluate_edges(edges: FlowEdge[], session: FlowSession, inbound: string): string | null {
  const non_fallback = edges
    .filter(e => !e.is_fallback)
    .sort((a, b) => a.priority - b.priority)
  const fallback = edges.find(e => e.is_fallback)

  for (const edge of non_fallback) {
    if (matches_edge(edge, session, inbound)) {
      return edge.target_node_id
    }
  }

  return fallback?.target_node_id ?? null
}

function matches_edge(edge: FlowEdge, session: FlowSession, inbound: string): boolean {
  const ctx = { input: inbound, context: session.context }

  if (edge.condition_expression) {
    return jexl.evalSync(edge.condition_expression, ctx)  // safe: no eval()
  }

  switch (edge.condition_type) {
    case 'always':           return true
    case 'equals':           return inbound === edge.condition_value
    case 'contains':         return inbound.includes(edge.condition_value!)
    case 'starts_with':      return inbound.startsWith(edge.condition_value!)
    case 'regex':            return new RegExp(edge.condition_value!).test(inbound)
    case 'variable_equals':  return session.context[edge.condition_variable!] === edge.condition_value
    case 'variable_contains':return String(session.context[edge.condition_variable!]).includes(edge.condition_value!)
    default:                 return false
  }
}
```

### 5.4 Subflow Execution

```typescript
// Entering a subflow
async function execute_subflow_node(node: FlowNode, session: FlowSession): Promise<NodeResult> {
  const config = node.config as SubflowConfig

  // Depth guard
  if (session.call_stack.length >= 10) throw new Error('max_subflow_depth exceeded')

  // Prevent same-flow recursion
  if (session.call_stack.some(e => e.flow_id === config.subflow_id && e.flow_id === session.flow_id)) {
    throw new Error('recursive_subflow_detected')
  }

  const subflow = await get_flow(config.subflow_id)
  const return_node_id = get_node_after(node)  // the node after this subflow call

  // Push return address with context snapshot
  session.call_stack.push({
    flow_id: session.flow_id,
    return_node_id,
    context_snapshot: { ...session.context }
  })

  return {
    messages: [],
    context_updates: {},
    next_node_id: subflow.entry_node_id,
    skip_edge_evaluation: true,
    consumes_input: false
  }
}

// Reaching end node inside a subflow
async function execute_end_node(node: FlowNode, session: FlowSession): Promise<NodeResult> {
  const config = node.config as EndConfig

  if (session.call_stack.length > 0) {
    // Pop and return to caller
    const frame = session.call_stack.pop()!
    session.flow_id = frame.flow_id
    return {
      messages: config.farewell_message ? [{ text: config.farewell_message }] : [],
      context_updates: {},
      next_node_id: frame.return_node_id,
      skip_edge_evaluation: true,
      consumes_input: false
    }
  }

  // Empty stack: close session
  return {
    messages: [{ text: config.farewell_message }],
    context_updates: {},
    next_node_id: null,
    skip_edge_evaluation: true,
    consumes_input: false
  }
}
```

---

## 6. Trigger Engine

### 6.1 Text Normalization

All inbound text normalized before any matching:
```typescript
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')     // collapse spaces
}
```

### 6.2 Trigger Resolution Pipeline

```typescript
async function resolve_trigger(owner_id: string, text: string): Promise<FlowTrigger | null> {
  const triggers = await db.query(
    'SELECT * FROM flow_triggers WHERE owner_id=$1 AND is_active=true ORDER BY priority ASC',
    [owner_id]
  )

  // Pass 1: restart triggers — exact match, sorted by priority
  const restarts = triggers.filter(t => t.trigger_type === 'restart').sort(by_priority)
  for (const t of restarts) {
    if (normalize(t.trigger_value!) === text) return t
  }

  // Pass 2: keyword exact match, sorted by priority
  const keywords = triggers.filter(t => t.trigger_type === 'keyword').sort(by_priority)
  for (const t of keywords) {
    if (normalize(t.trigger_value!) === text) return t
  }

  // Pass 3: keyword contains match — longest value first (prevents "ice" beating "ice cream")
  const by_length = [...keywords].sort((a, b) => b.trigger_value!.length - a.trigger_value!.length)
  for (const t of by_length) {
    if (text.includes(normalize(t.trigger_value!))) return t
  }

  // Pass 4: default fallback (enforced unique per owner)
  return triggers.find(t => t.trigger_type === 'default') ?? null
}

// Restart triggers checked EVEN IF session is active (kill old, start fresh)
async function find_restart_trigger(owner_id: string, text: string): Promise<FlowTrigger | null> {
  const triggers = await db.query(
    `SELECT * FROM flow_triggers
     WHERE owner_id=$1 AND trigger_type='restart' AND is_active=true
     ORDER BY priority ASC`,
    [owner_id]
  )
  for (const t of triggers) {
    if (normalize(t.trigger_value!) === text) return t
  }
  return null
}

// API triggers — completely separate entry point, bypasses text logic
async function resolve_trigger_api(owner_id: string, payload: Record<string, any>): Promise<FlowSession> {
  const trigger = await db.query(
    `SELECT * FROM flow_triggers WHERE owner_id=$1 AND trigger_type='api' AND trigger_value=$2`,
    [owner_id, payload.trigger_key]
  )
  if (!trigger) throw new Error('api_trigger_not_found')
  return create_session(owner_id, payload.phone, trigger, payload)
}
```

**Trigger cooldown:** Before creating a new session from a restart trigger, check `last_triggered_at` on `flow_sessions`. If a session was created for this phone within 5 seconds, skip.

**Trigger confidence logging:** Every successful trigger resolution logs to `audit_logs`:
```json
{
  "matched_trigger_id": "uuid",
  "match_type": "exact | contains | default",
  "trigger_value": "ice cream",
  "normalized_input": "i want ice cream"
}
```
This makes "wrong flow triggered" debugging trivial — query `audit_logs` by phone and timestamp.

### 6.3 Multi-Flow Routing Example (E-Commerce)

```
Tenant triggers:
  restart  "hi"        → Main Menu flow (entry)
  restart  "hello"     → Main Menu flow (entry)
  restart  "start"     → Main Menu flow (entry)
  keyword  "ice cream" → Ice Cream Catalog flow (priority: 10)
  keyword  "chocolate" → Chocolate Catalog flow (priority: 10)
  keyword  "order"     → Orders flow (priority: 20)
  keyword  "ice"       → Ice Cream Catalog flow (priority: 30)  ← lower priority than "ice cream"
  default  (none)      → Main Menu flow (entry)
```

User messages "I want ice cream" → normalization → "i want ice cream" → Pass 3 contains → "ice cream" matches first (longer) → Ice Cream Catalog flow.

---

## 7. Flow Builder UI

### 7.1 Canvas: React Flow

Replace the current custom tree canvas with React Flow. Rationale: the new model has arbitrary cross-flow edges, cycle edges, subflow jumps — custom edge routing for a true graph is 3–4 weeks of geometry work React Flow already solved.

**React Flow configuration:**
- Node types: custom component per `node_type` (10 types)
- Edge types: custom `SmartEdge` with animated active-path indicator
- Dark theme: CSS variables mapped from existing Tailwind tokens
- Auto-layout: ELK.js or Dagre for initial layout on import
- Minimap: enabled, shows flow structure at a glance

### 7.2 Multi-Flow Navigation

Sidebar gets a **Flows** section (replaces single "Builder" item):
```
Flows
  ├── Main Menu  [live]
  ├── Ice Cream  [live]
  ├── Chocolate  [draft]
  └── + New Flow
```

Each flow opens in the canvas. Cross-flow jump edges are shown as dashed lines with a "→ Flow Name" label.

### 7.3 Node Palette (right-click or drag from panel)

```
Messages        → message, input
Logic           → condition, api
Control         → jump, subflow, delay
Terminal        → handoff, end
Entry           → start  (one per flow, auto-created)
```

### 7.4 Publish Validation (UI)

Before publishing, the UI runs client-side validation:
1. `entry_node_id` is set
2. Every non-terminal node has at least 1 outgoing edge
3. Every non-terminal node with multiple edges has exactly 1 fallback edge
4. No unreachable nodes (not connected from entry via any path)
5. No multiple fallback edges per node

Publish is blocked with specific errors if validation fails.

---

## 8. Attachment System

Attachments are first-class in `message` node config. No separate table needed.

**Config:**
```json
{
  "text": "Here's your order summary:",
  "attachments": [
    {
      "attachment_id": "optional-uuid-for-reuse-and-analytics",
      "type": "image",
      "url": "https://storage.../path.jpg",
      "caption": "Order #1234"
    }
  ]
}
```

**Upload flow:**
1. User selects file in node editor
2. Frontend validates: type (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/3gpp`, `application/pdf`) and size (max 50MB)
3. Upload to Supabase Storage: `chatbot-media/{owner_id}/{flow_id}/{timestamp}.{ext}`
4. Public URL stored in node config

**Tenant isolation:** All files scoped under `owner_id/` prefix. Storage RLS policy denies cross-tenant reads.

**Sending:** `message` node executor checks `config.attachments`. Sends media message first, then text (or combined if platform supports captions). Supported on both Meta Cloud API and Evolution/Baileys.

---

## 9. Multi-Tenant Architecture

**Every table** in the new schema has `owner_id uuid NOT NULL REFERENCES owners(id)`.

**RLS policies (pattern):**
```sql
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
-- USING controls reads; WITH CHECK controls writes. Both required.
CREATE POLICY "flows_tenant_isolation" ON flows
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Repeat identically for: flow_nodes, flow_edges, flow_triggers, flow_sessions
-- Service role (edge functions) bypasses RLS by design — engine still enforces owner_id in every query
```

**Engine enforcement:** Every DB query in the execution engine includes `AND owner_id = $tenant_id`. The engine never loads data across tenants even if RLS is bypassed (defense in depth).

**Admin bypass:** Existing `is_admin()` function grants read-only admin access per the existing admin migration pattern.

---

## 10. Reception Number

`owners.reception_phone` — one per tenant. Set in Settings page (existing `SettingsPage.tsx`). Used by:
- `handoff` node: send booking/escalation notification to this number
- Admin InboxPage: displayed as the tenant's reception line

No multi-number abstraction. Single number per tenant is the correct scope for Phase 1–3.

---

## 11. Human Handoff System

### Flow
```
Handoff node executes →
  1. session.status = 'handoff'
  2. Send user: config.message ("Connecting you to our team...")
  3. Send alert to owners.reception_phone: "New handoff from {phone}"
  4. InboxPage shows session in queue
  5. Agent picks up → replies directly (bot silent: guarded by handoff check in receive_message)
  6. Agent releases → session.status = 'active' + session.current_node_id = config.resume_node_id
  7. Bot resumes
```

### Timeout
Cron job (every hour): sessions with `status = 'handoff'` and `last_message_at < now() - 24h` → `status = 'expired'`.

### Queue strategy
Phase 1: no real queue. InboxPage shows all handoff sessions sorted by `last_message_at`. Assignment is manual. `round_robin` and `priority` strategies are stored in config and respected in Phase 5.

---

## 12. Example Flows

### 12.1 E-Commerce: Keyword Entry + Cross-Flow

```
Triggers:
  restart "hi"      → Main Menu (entry)
  keyword "order"   → Orders flow (entry)

Main Menu flow:
  start →
  message "Welcome to FreshMart! Choose a category:" →
  [edges: "ice cream" → Ice Cream flow via Jump node]
  [edges: "chocolate" → Chocolate flow via Jump node]
  [fallback → message "Please choose a category"]

Ice Cream flow:
  start →
  message "🍦 Our ice cream flavours:" →
  input "Which flavour?" (store_as: "user.flavour") →
  [edge: condition_expression="context['user.flavour'] != ''" → confirm_node]
  confirm message "You chose {{user.flavour}}. Confirm? (yes/no)" →
  [edge: equals "yes" → order_node]
  [edge: equals "no" → start]  ← jump back to start
  [fallback → confirm message again]
```

### 12.2 Reusable Subflow: Collect Contact Details

```
Subflow "collect_contact":
  input "Your name?" (store_as: "user.name") →
  input "Your phone?" (store_as: "user.phone") →
  end

Used in:
  Ice Cream flow: subflow node → collect_contact → returns to "confirm order"
  Service flow: subflow node → collect_contact → returns to "book appointment"
```

---

## 13. Risks & Edge Cases

| Risk | Mitigation |
|------|------------|
| Circular flow graphs | Cycle detection (visited Set per turn) + max_steps (100) |
| Infinite subflow recursion | Max call_stack depth (10) + same-flow re-entry check |
| Concurrent message processing | `SELECT FOR UPDATE` on session row |
| Webhook retries (duplicate messages) | `message_id` idempotency tracking |
| Expression injection via `condition_expression` | JEXL safe parser — no `eval()` |
| Dead-end sessions | Fallback edges enforced at publish; dead end → reset to entry |
| Multiple fallback edges per node | `UNIQUE(source_node_id) WHERE is_fallback=true` DB constraint |
| API node failures | `retry_count` + `timeout_secs` config; ERROR state on exhaustion |
| Message delivery failure | State persisted before send; outbox queue; retry independently |
| Tenant data leakage | RLS on all tables + `owner_id` in every engine query |
| Trigger ambiguity (contains collision) | Longest-match-first sort in Pass 3 |
| Rapid restart spam | 5-second cooldown on restart trigger per phone |
| Flow published with broken graph | Client-side + server-side validation gate before publish |
| QA pairs migration edge cases | `legacy_qa_pair_id` for tracing; migration runs with dry-run flag |

---

## 14. Phased Implementation Plan

### Phase 1 — Foundation (start here)
- Drop booking tables + evolution tables
- Add `reception_phone` to owners
- Create `flows`, `flow_nodes`, `flow_edges`, `flow_triggers`, `flow_sessions`
- RLS policies on all new tables
- Migration script: `chatbots` + `qa_pairs` → graph (with dry-run mode)
- Remove `BookingConfigPage` + sidebar item + route
- Add `reception_phone` field to Settings page

### Phase 2 — Execution Engine
- Flow execution engine in Supabase edge function (replaces current webhook logic)
- Session locking, state-first persistence, message queue
- All node executors implemented
- Edge evaluator with JEXL
- Subflow call stack
- Safety: cycle detection, step limit, turn timeout
- Idempotency: `message_id` dedup

### Phase 3 — Flow Builder UI
- React Flow canvas replacing current `BuilderPage.tsx`
- Custom node components (10 types)
- Multi-flow sidebar
- Node config panels per type
- Publish validation UI
- Trigger management UI

### Phase 4 — Trigger Engine
- Trigger management UI (keywords, priorities)
- Multi-flow routing live
- API trigger endpoint
- Trigger cooldown enforcement

### Phase 5 — Handoff + Departments
- Handoff node fully wired to InboxPage
- Queue system (round_robin priority)
- Agent assignment + release
- Bot resume after handoff

---

## 15. Future Improvements (post Phase 5)

- **Flow versioning history:** full version table, sessions pinned to version at creation time
- **Visual debugger:** step-through execution trace in Flow Builder canvas
- **Analytics per node:** drop-off rates, path popularity heatmap
- **Campaign broadcasts:** API-triggered flows with bulk phone lists
- **Intent-based routing:** ML layer on top of keyword triggers
- **Conditional edge builder:** visual expression editor for `condition_expression`
- **Subflow library:** shared flows across all owner's bots
- **WhatsApp interactive lists:** automatic generation from flow structure
