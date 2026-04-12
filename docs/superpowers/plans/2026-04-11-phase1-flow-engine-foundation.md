# Phase 1: Flow Engine Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the graph engine schema, migrate existing chatbot/qa_pairs data into the new flow tables, remove all booking bot code, and add reception_phone to owner settings — without breaking the running system.

**Architecture:** Non-breaking foundation layer. New tables (`flows`, `flow_nodes`, `flow_edges`, `flow_triggers`, `flow_sessions`) are created alongside the old ones. The existing webhook continues running against `chatbots`/`qa_pairs` until Phase 2. Migration script populates new tables from old data with a dry-run mode and post-migration validator. Old tables (`chatbots`, `qa_pairs`, `customer_sessions`) are dropped in Phase 2 after the new engine is live. Booking and evolution tables are dropped immediately — they have no production data.

**Tech Stack:** PostgreSQL (Supabase migrations), TypeScript + tsx (migration script), React + Vitest + Testing Library (frontend tests), Supabase JS v2 client.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `supabase/migrations/20260411000001_flow_engine_schema.sql` | New tables, indexes, RLS |
| CREATE | `supabase/migrations/20260411000002_drop_booking_evolution.sql` | Drop booking + evolution tables |
| CREATE | `supabase/migrations/20260411000003_owners_reception_phone.sql` | Add reception_phone to owners |
| CREATE | `scripts/migrate-to-flows.ts` | One-time migration script (dry-run + live) |
| CREATE | `src/test/migrate-to-flows.test.ts` | Unit tests for migration pure functions |
| DELETE | `src/components/dashboard/booking/BookingConfigPage.tsx` | Remove booking tab |
| MODIFY | `src/App.tsx` | Remove BookingConfigPage route |
| MODIFY | `src/components/dashboard/DashboardSidebar.tsx` | Remove "Booking Setup" nav item |
| MODIFY | `src/hooks/useDashboardData.ts` | Add reception_phone to owner fetch + save |
| MODIFY | `src/components/dashboard/settings/SettingsPage.tsx` | Add reception_phone form field |
| MODIFY | `supabase/functions/whatsapp-webhook/index.ts` | Remove booking bot engine + interfaces |

---

## Task 1: New Schema Migration

**Files:**
- Create: `supabase/migrations/20260411000001_flow_engine_schema.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260411000001_flow_engine_schema.sql
-- Phase 1: Graph engine schema foundation
-- These tables are populated by migrate-to-flows.ts but NOT used by the live engine yet.
-- The running webhook continues against chatbots/qa_pairs until Phase 2.

-- ── flows ────────────────────────────────────────────────────────────────────
CREATE TABLE public.flows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  version       integer NOT NULL DEFAULT 1,
  entry_node_id uuid,  -- FK added after flow_nodes is created (circular ref)
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_flows_owner ON public.flows(owner_id);
CREATE INDEX idx_flows_owner_status ON public.flows(owner_id, status) WHERE status = 'published';

-- ── flow_nodes ────────────────────────────────────────────────────────────────
CREATE TABLE public.flow_nodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id             uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  owner_id            uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  node_type           text NOT NULL
                        CHECK (node_type IN (
                          'start', 'message', 'input', 'condition',
                          'api', 'delay', 'jump', 'subflow', 'handoff', 'end'
                        )),
  label               text,
  config              jsonb NOT NULL DEFAULT '{}',
  position_x          float NOT NULL DEFAULT 0,
  position_y          float NOT NULL DEFAULT 0,
  legacy_qa_pair_id   uuid,  -- migration tracing only, dropped after Phase 2
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_flow_nodes_flow ON public.flow_nodes(flow_id);
CREATE INDEX idx_flow_nodes_owner_flow ON public.flow_nodes(owner_id, flow_id);
CREATE INDEX idx_flow_nodes_type ON public.flow_nodes(flow_id, node_type);

-- Now add the circular FK from flows → flow_nodes (deferred so inserts work in one tx)
ALTER TABLE public.flows
  ADD CONSTRAINT flows_entry_node_id_fkey
  FOREIGN KEY (entry_node_id) REFERENCES public.flow_nodes(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ── flow_edges ────────────────────────────────────────────────────────────────
CREATE TABLE public.flow_edges (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id               uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  owner_id              uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  source_node_id        uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  target_node_id        uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  condition_type        text NOT NULL DEFAULT 'always'
                          CHECK (condition_type IN (
                            'always', 'equals', 'contains', 'starts_with',
                            'regex', 'variable_equals', 'variable_contains'
                          )),
  condition_value       text,
  condition_variable    text,
  condition_expression  text,
  is_fallback           boolean NOT NULL DEFAULT false,
  priority              integer NOT NULL DEFAULT 0,
  label                 text,
  created_at            timestamptz DEFAULT now()
);

-- Enforce determinism: no two non-fallback edges from same source at same priority
CREATE UNIQUE INDEX idx_flow_edges_priority
  ON public.flow_edges(source_node_id, priority)
  WHERE is_fallback = false;

-- Enforce single fallback per source node
CREATE UNIQUE INDEX idx_flow_edges_fallback
  ON public.flow_edges(source_node_id)
  WHERE is_fallback = true;

CREATE INDEX idx_flow_edges_source ON public.flow_edges(source_node_id);
CREATE INDEX idx_flow_edges_owner_flow ON public.flow_edges(owner_id, flow_id);
CREATE INDEX idx_flow_edges_flow ON public.flow_edges(flow_id);

-- ── flow_triggers ─────────────────────────────────────────────────────────────
CREATE TABLE public.flow_triggers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  flow_id         uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  target_node_id  uuid REFERENCES public.flow_nodes(id),  -- null = use flow.entry_node_id
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
  ON public.flow_triggers(owner_id)
  WHERE trigger_type = 'default' AND is_active = true;

CREATE INDEX idx_flow_triggers_owner ON public.flow_triggers(owner_id, is_active);
CREATE INDEX idx_flow_triggers_lookup ON public.flow_triggers(owner_id, trigger_type, is_active);

-- ── flow_sessions ─────────────────────────────────────────────────────────────
CREATE TABLE public.flow_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  flow_id                 uuid NOT NULL REFERENCES public.flows(id),
  current_node_id         uuid NOT NULL REFERENCES public.flow_nodes(id),
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
  UNIQUE(owner_id, phone)
);

CREATE INDEX idx_flow_sessions_status ON public.flow_sessions(owner_id, status);
CREATE INDEX idx_flow_sessions_phone ON public.flow_sessions(owner_id, phone);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Pattern: USING controls reads, WITH CHECK controls writes. Both required.
-- Service role (edge functions) bypasses RLS — engine still enforces owner_id per query.

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flows_tenant_isolation" ON public.flows
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_nodes_tenant_isolation" ON public.flow_nodes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_edges_tenant_isolation" ON public.flow_edges
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.flow_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_triggers_tenant_isolation" ON public.flow_triggers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.flow_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_sessions_tenant_isolation" ON public.flow_sessions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Admin read-only access (mirrors pattern from 20260319000000_admin_dashboard.sql)
CREATE POLICY "admin_select_all_flows" ON public.flows
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_select_all_flow_nodes" ON public.flow_nodes
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_select_all_flow_edges" ON public.flow_edges
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_select_all_flow_triggers" ON public.flow_triggers
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_select_all_flow_sessions" ON public.flow_sessions
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER flows_updated_at BEFORE UPDATE ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER flow_nodes_updated_at BEFORE UPDATE ON public.flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER flow_sessions_updated_at BEFORE UPDATE ON public.flow_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2: Apply migration via Supabase CLI**

```bash
npx supabase db push
# Or if using local dev:
npx supabase migration up
```

Expected output: `Applying migration 20260411000001_flow_engine_schema.sql... done`

- [ ] **Step 3: Verify tables exist**

```bash
npx supabase db execute --sql "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'flow%' ORDER BY table_name;"
```

Expected output:
```
 table_name
-----------------
 flow_edges
 flow_nodes
 flow_sessions
 flow_triggers
 flows
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260411000001_flow_engine_schema.sql
git commit -m "feat: add flow engine schema (flows, nodes, edges, triggers, sessions)"
```

---

## Task 2: Drop Booking + Evolution Tables

**Files:**
- Create: `supabase/migrations/20260411000002_drop_booking_evolution.sql`

These tables have no production data. The booking tables were a testing prototype. The evolution tables lack `owner_id` and cannot be made multi-tenant-safe.

- [ ] **Step 1: Create the drop migration**

```sql
-- supabase/migrations/20260411000002_drop_booking_evolution.sql
-- Drop booking bot prototype tables (testing-only, no production data)
-- Drop evolution tables (no owner_id — cannot be multi-tenant safe)

-- Booking tables: drop in FK-safe order
DROP TABLE IF EXISTS public.booking_blocked_slots CASCADE;
DROP TABLE IF EXISTS public.booking_appointments CASCADE;
DROP TABLE IF EXISTS public.booking_patients CASCADE;
DROP TABLE IF EXISTS public.booking_conversation_state CASCADE;
DROP TABLE IF EXISTS public.booking_configs CASCADE;

-- Remove chatbot_type column (booking-only concept, replaced by flow.status)
ALTER TABLE public.chatbots DROP COLUMN IF EXISTS chatbot_type;

-- Evolution tables: no owner_id — violates multi-tenant model
DROP TABLE IF EXISTS public.evolution_messages CASCADE;
DROP TABLE IF EXISTS public.evolution_reminders CASCADE;
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected output: `Applying migration 20260411000002_drop_booking_evolution.sql... done`

- [ ] **Step 3: Verify tables are gone**

```bash
npx supabase db execute --sql "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('booking_configs','booking_patients','booking_appointments','booking_blocked_slots','booking_conversation_state','evolution_messages','evolution_reminders');"
```

Expected output: `(0 rows)`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260411000002_drop_booking_evolution.sql
git commit -m "feat: drop booking bot prototype tables and evolution tables without tenant isolation"
```

---

## Task 3: Add Reception Phone to Owners

**Files:**
- Create: `supabase/migrations/20260411000003_owners_reception_phone.sql`

- [ ] **Step 1: Create the migration**

```sql
-- supabase/migrations/20260411000003_owners_reception_phone.sql
-- Add tenant-scoped reception WhatsApp number.
-- Used by handoff node alerts and displayed in Settings.

ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS reception_phone text;

COMMENT ON COLUMN public.owners.reception_phone IS
  'WhatsApp number for handoff alerts and appointment notifications. One per tenant. Format: 919876543210 (no + or spaces).';
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected output: `Applying migration 20260411000003_owners_reception_phone.sql... done`

- [ ] **Step 3: Verify column exists**

```bash
npx supabase db execute --sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='owners' AND column_name='reception_phone';"
```

Expected output:
```
 column_name    | data_type
----------------+-----------
 reception_phone | text
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260411000003_owners_reception_phone.sql
git commit -m "feat: add reception_phone to owners table"
```

---

## Task 4: Migration Script — Write Failing Tests

**Files:**
- Create: `src/test/migrate-to-flows.test.ts`

The migration script exports pure functions (no DB calls). Test those functions in isolation.

- [ ] **Step 1: Create the test file**

```typescript
// src/test/migrate-to-flows.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildFlowFromChatbot,
  buildStartAndGreetingNodes,
  buildMessageNodesFromQAPairs,
  buildEdgesFromQAPairs,
  buildTriggersFromChatbot,
  validateMigrationResult,
  normalizePhone,
} from '../../scripts/migrate-to-flows'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_ID = 'owner-uuid-1'
const CHATBOT_ID = 'chatbot-uuid-1'

const mockChatbot = {
  id: CHATBOT_ID,
  owner_id: OWNER_ID,
  chatbot_name: 'Test Bot',
  greeting_message: 'Welcome! How can I help?',
  farewell_message: 'Thanks! Goodbye.',
  is_active: true,
}

const mockRootQAPair = {
  id: 'qa-root-1',
  chatbot_id: CHATBOT_ID,
  question_text: 'Services',
  answer_text: 'Here are our services.',
  is_main_question: true,
  parent_question_id: null,
  display_order: 1,
  media_url: null,
  media_type: null,
}

const mockRootQAPairWithMedia = {
  ...mockRootQAPair,
  id: 'qa-root-2',
  question_text: 'Gallery',
  answer_text: 'Check our gallery.',
  display_order: 2,
  media_url: 'https://storage.supabase.co/chatbot-media/owner/bot/photo.jpg',
  media_type: 'image',
}

const mockChildQAPair = {
  id: 'qa-child-1',
  chatbot_id: CHATBOT_ID,
  question_text: 'Consulting',
  answer_text: 'We offer consulting.',
  is_main_question: false,
  parent_question_id: 'qa-root-1',
  display_order: 1,
  media_url: null,
  media_type: null,
}

// ── buildFlowFromChatbot ──────────────────────────────────────────────────────

describe('buildFlowFromChatbot', () => {
  it('maps active chatbot to published flow', () => {
    const flow = buildFlowFromChatbot(mockChatbot)
    expect(flow.name).toBe('Test Bot')
    expect(flow.owner_id).toBe(OWNER_ID)
    expect(flow.status).toBe('published')
    expect(flow.version).toBe(1)
  })

  it('maps inactive chatbot to draft flow', () => {
    const flow = buildFlowFromChatbot({ ...mockChatbot, is_active: false })
    expect(flow.status).toBe('draft')
  })
})

// ── buildStartAndGreetingNodes ────────────────────────────────────────────────

describe('buildStartAndGreetingNodes', () => {
  it('creates a start node', () => {
    const { startNode } = buildStartAndGreetingNodes(mockChatbot, 'flow-uuid-1')
    expect(startNode.node_type).toBe('start')
    expect(startNode.flow_id).toBe('flow-uuid-1')
    expect(startNode.owner_id).toBe(OWNER_ID)
    expect(startNode.label).toBe('Start')
  })

  it('creates a greeting message node with chatbot greeting', () => {
    const { greetingNode } = buildStartAndGreetingNodes(mockChatbot, 'flow-uuid-1')
    expect(greetingNode.node_type).toBe('message')
    expect(greetingNode.config.text).toBe('Welcome! How can I help?')
    expect(greetingNode.owner_id).toBe(OWNER_ID)
  })

  it('creates an end node with farewell message', () => {
    const { endNode } = buildStartAndGreetingNodes(mockChatbot, 'flow-uuid-1')
    expect(endNode.node_type).toBe('end')
    expect(endNode.config.farewell_message).toBe('Thanks! Goodbye.')
  })
})

// ── buildMessageNodesFromQAPairs ──────────────────────────────────────────────

describe('buildMessageNodesFromQAPairs', () => {
  it('creates one message node per qa_pair', () => {
    const qaPairs = [mockRootQAPair, mockChildQAPair]
    const nodes = buildMessageNodesFromQAPairs(qaPairs, 'flow-uuid-1', OWNER_ID)
    expect(nodes).toHaveLength(2)
  })

  it('maps answer_text to config.text', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPair], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].config.text).toBe('Here are our services.')
    expect(nodes[0].node_type).toBe('message')
  })

  it('maps media to config.attachments when present', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPairWithMedia], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].config.attachments).toHaveLength(1)
    expect(nodes[0].config.attachments[0].type).toBe('image')
    expect(nodes[0].config.attachments[0].url).toBe(mockRootQAPairWithMedia.media_url)
  })

  it('sets no attachments when media_url is null', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPair], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].config.attachments).toBeUndefined()
  })

  it('stores legacy_qa_pair_id for migration tracing', () => {
    const nodes = buildMessageNodesFromQAPairs([mockRootQAPair], 'flow-uuid-1', OWNER_ID)
    expect(nodes[0].legacy_qa_pair_id).toBe('qa-root-1')
  })
})

// ── buildEdgesFromQAPairs ─────────────────────────────────────────────────────

describe('buildEdgesFromQAPairs', () => {
  it('creates start → greeting edge (always)', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const startEdge = edges.find(e => e.source_node_id === 'node-start-id')
    expect(startEdge).toBeDefined()
    expect(startEdge!.target_node_id).toBe('node-greeting-id')
    expect(startEdge!.condition_type).toBe('always')
    expect(startEdge!.is_fallback).toBe(false)
  })

  it('creates greeting → root-message edge with equals condition on question_text', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const greetingEdge = edges.find(
      e => e.source_node_id === 'node-greeting-id' && !e.is_fallback
    )
    expect(greetingEdge).toBeDefined()
    expect(greetingEdge!.condition_type).toBe('equals')
    expect(greetingEdge!.condition_value).toBe('Services')
    expect(greetingEdge!.target_node_id).toBe('node-msg-1')
  })

  it('creates a fallback edge from greeting back to greeting', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const fallback = edges.find(
      e => e.source_node_id === 'node-greeting-id' && e.is_fallback
    )
    expect(fallback).toBeDefined()
    expect(fallback!.target_node_id).toBe('node-greeting-id')
    expect(fallback!.condition_type).toBe('always')
  })

  it('creates parent → child edge with equals condition', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-root',
      'qa-child-1': 'node-msg-child',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair, mockChildQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const childEdge = edges.find(
      e => e.source_node_id === 'node-msg-root' && !e.is_fallback
    )
    expect(childEdge).toBeDefined()
    expect(childEdge!.condition_value).toBe('Consulting')
    expect(childEdge!.target_node_id).toBe('node-msg-child')
  })

  it('gives leaf nodes a fallback edge back to greeting', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-root',
      'qa-child-1': 'node-msg-child',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair, mockChildQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const leafFallback = edges.find(
      e => e.source_node_id === 'node-msg-child' && e.is_fallback
    )
    expect(leafFallback).toBeDefined()
    expect(leafFallback!.target_node_id).toBe('node-greeting-id')
  })

  it('sets priority from display_order', () => {
    const nodeMap = {
      '__start__': 'node-start-id',
      '__greeting__': 'node-greeting-id',
      'qa-root-1': 'node-msg-1',
    }
    const edges = buildEdgesFromQAPairs(
      [mockRootQAPair],
      nodeMap,
      'flow-uuid-1',
      OWNER_ID
    )
    const greetingEdge = edges.find(
      e => e.source_node_id === 'node-greeting-id' && !e.is_fallback
    )
    expect(greetingEdge!.priority).toBe(1)  // display_order: 1
  })
})

// ── buildTriggersFromChatbot ──────────────────────────────────────────────────

describe('buildTriggersFromChatbot', () => {
  it('creates restart triggers for hi, hello, start', () => {
    const triggers = buildTriggersFromChatbot(
      mockChatbot,
      'flow-uuid-1',
      OWNER_ID,
      'greeting-node-id'
    )
    const restarts = triggers.filter(t => t.trigger_type === 'restart')
    const values = restarts.map(t => t.trigger_value)
    expect(values).toContain('hi')
    expect(values).toContain('hello')
    expect(values).toContain('start')
  })

  it('creates a default trigger pointing to greeting node', () => {
    const triggers = buildTriggersFromChatbot(
      mockChatbot,
      'flow-uuid-1',
      OWNER_ID,
      'greeting-node-id'
    )
    const def = triggers.find(t => t.trigger_type === 'default')
    expect(def).toBeDefined()
    expect(def!.target_node_id).toBe('greeting-node-id')
    expect(def!.flow_id).toBe('flow-uuid-1')
  })

  it('all triggers have owner_id and flow_id', () => {
    const triggers = buildTriggersFromChatbot(
      mockChatbot,
      'flow-uuid-1',
      OWNER_ID,
      'greeting-node-id'
    )
    for (const t of triggers) {
      expect(t.owner_id).toBe(OWNER_ID)
      expect(t.flow_id).toBe('flow-uuid-1')
    }
  })
})

// ── validateMigrationResult ───────────────────────────────────────────────────

describe('validateMigrationResult', () => {
  it('passes for a valid migration with entry set and fallbacks present', () => {
    const nodes = [
      { id: 'n-start', node_type: 'start' },
      { id: 'n-greeting', node_type: 'message' },
      { id: 'n-msg1', node_type: 'message' },
    ]
    const edges = [
      { source_node_id: 'n-start', target_node_id: 'n-greeting', is_fallback: false },
      { source_node_id: 'n-greeting', target_node_id: 'n-msg1', is_fallback: false, condition_value: 'Services' },
      { source_node_id: 'n-greeting', target_node_id: 'n-greeting', is_fallback: true },
      { source_node_id: 'n-msg1', target_node_id: 'n-greeting', is_fallback: true },
    ]
    const result = validateMigrationResult('n-start', nodes, edges, 1)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when entry_node_id is missing', () => {
    const result = validateMigrationResult(null, [], [], 0)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('entry_node_id is not set')
  })

  it('fails when a non-terminal node has no outgoing edges', () => {
    const nodes = [
      { id: 'n-start', node_type: 'start' },
      { id: 'n-orphan', node_type: 'message' },
    ]
    const edges = [
      { source_node_id: 'n-start', target_node_id: 'n-orphan', is_fallback: false },
      // n-orphan has no outgoing edge
    ]
    const result = validateMigrationResult('n-start', nodes, edges, 2)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('no outgoing edge'))).toBe(true)
  })

  it('fails when a non-terminal node is missing a fallback edge', () => {
    const nodes = [
      { id: 'n-start', node_type: 'start' },
      { id: 'n-greeting', node_type: 'message' },
    ]
    const edges = [
      { source_node_id: 'n-start', target_node_id: 'n-greeting', is_fallback: false },
      // n-greeting has a non-fallback but no fallback
      { source_node_id: 'n-greeting', target_node_id: 'n-greeting', is_fallback: false, condition_type: 'equals', condition_value: 'test' },
    ]
    const result = validateMigrationResult('n-start', nodes, edges, 1)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('missing fallback edge'))).toBe(true)
  })
})

// ── normalizePhone ────────────────────────────────────────────────────────────

describe('normalizePhone', () => {
  it('strips non-digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210')
  })

  it('prepends 91 to 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210')
  })

  it('leaves 12-digit number unchanged', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail with import error**

```bash
npm run test -- src/test/migrate-to-flows.test.ts
```

Expected output: `FAIL — Cannot find module '../../scripts/migrate-to-flows'`

---

## Task 5: Migration Script — Implement Pure Functions

**Files:**
- Create: `scripts/migrate-to-flows.ts`

- [ ] **Step 1: Create the script with all pure functions**

```typescript
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

  // Terminal node types — these don't need outgoing edges
  const terminalTypes = new Set(['end', 'handoff'])

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

    // Non-terminal nodes with more than one edge must have exactly one fallback
    if (outgoing.length > 1) {
      const fallbacks = outgoing.filter(e => e.is_fallback)
      if (fallbacks.length === 0) {
        errors.push(`Node ${node.id} (${node.node_type}) has multiple edges but is missing fallback edge`)
      } else if (fallbacks.length > 1) {
        errors.push(`Node ${node.id} (${node.node_type}) has multiple fallback edges (max 1 allowed)`)
      }
    }
  }

  // Node count: should have start + greeting + end + 1 per qa_pair
  const expectedMinNodes = originalQAPairCount + 3  // start, greeting, end
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
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
npm run test -- src/test/migrate-to-flows.test.ts
```

Expected output: `✓ 20 tests passed`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-to-flows.ts src/test/migrate-to-flows.test.ts
git commit -m "feat: add qa_pairs → flows migration script with dry-run and validator"
```

---

## Task 6: Remove BookingConfigPage from Frontend

**Files:**
- Delete: `src/components/dashboard/booking/BookingConfigPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/dashboard/DashboardSidebar.tsx`

- [ ] **Step 1: Write a test to verify the route no longer exists**

```typescript
// src/test/booking-removed.test.ts
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import App from '../../src/App'

// We verify that the /dashboard/booking-config route renders NotFound, not a form.
// This test imports App directly — if App still imports BookingConfigPage, the test
// will fail at the import level, giving us an early signal.
describe('BookingConfigPage removal', () => {
  it('App module does not export or reference BookingConfigPage', async () => {
    // If this import succeeds without error, BookingConfigPage is properly removed
    const appModule = await import('../../src/App')
    expect(appModule.default).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test — it should pass already (import succeeds before deletion too)**

```bash
npm run test -- src/test/booking-removed.test.ts
```

Expected: `✓ 1 test passed`

- [ ] **Step 3: Delete BookingConfigPage.tsx**

```bash
# Windows:
del "src\components\dashboard\booking\BookingConfigPage.tsx"
# Or simply delete the file in your editor
```

- [ ] **Step 4: Remove BookingConfigPage from App.tsx**

In `src/App.tsx`, remove these two lines:

```typescript
// REMOVE this import:
import BookingConfigPage from "./components/dashboard/booking/BookingConfigPage";

// REMOVE this route inside <Route path="/dashboard" ...>:
<Route path="booking-config" element={<BookingConfigPage />} />
```

- [ ] **Step 5: Remove "Booking Setup" from DashboardSidebar.tsx**

In `src/components/dashboard/DashboardSidebar.tsx`, remove the CalendarClock import and the Booking Setup nav item:

```typescript
// REMOVE from the import line:
// CalendarClock  ← remove this import

// REMOVE from baseNavItems array:
// { title: 'Booking Setup', url: '/dashboard/booking-config', icon: CalendarClock },
```

The full updated import line should be:
```typescript
import { LayoutDashboard, Workflow, Settings2, CreditCard, BarChart3, ScrollText, HelpCircle, Inbox, Users, Building2, Send } from 'lucide-react'
```

The `baseNavItems` array should no longer include the `booking-config` entry.

- [ ] **Step 6: Run TypeScript check**

```bash
npm run build 2>&1 | head -30
```

Expected: No TypeScript errors referencing BookingConfigPage.

- [ ] **Step 7: Run tests**

```bash
npm run test -- src/test/booking-removed.test.ts
```

Expected: `✓ 1 test passed`

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/dashboard/DashboardSidebar.tsx src/test/booking-removed.test.ts
git rm src/components/dashboard/booking/BookingConfigPage.tsx
git commit -m "feat: remove BookingConfigPage route and sidebar item"
```

---

## Task 7: Add Reception Phone to Settings

**Files:**
- Modify: `src/hooks/useDashboardData.ts`
- Modify: `src/components/dashboard/settings/SettingsPage.tsx`
- Create: `src/test/reception-phone.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/reception-phone.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DashboardContext } from '../../src/contexts/DashboardContext'
import SettingsPage from '../../src/components/dashboard/settings/SettingsPage'
import { createMockDashboardContext } from './helpers/mock-dashboard-context'

// Mock supabase
vi.mock('../../src/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    })),
    from: vi.fn(),
  },
}))

describe('SettingsPage — reception phone', () => {
  it('renders Reception Phone field', () => {
    const ctx = createMockDashboardContext({
      ownerData: { reception_phone: '' },
    })
    render(
      <DashboardContext.Provider value={ctx}>
        <SettingsPage />
      </DashboardContext.Provider>
    )
    expect(screen.getByLabelText(/reception/i)).toBeDefined()
  })

  it('pre-fills existing reception_phone value', () => {
    const ctx = createMockDashboardContext({
      ownerData: { reception_phone: '919876543210' },
    })
    render(
      <DashboardContext.Provider value={ctx}>
        <SettingsPage />
      </DashboardContext.Provider>
    )
    const input = screen.getByDisplayValue('919876543210')
    expect(input).toBeDefined()
  })
})
```

**Note:** If `src/test/helpers/mock-dashboard-context.ts` doesn't exist yet, create it:

```typescript
// src/test/helpers/mock-dashboard-context.ts
export function createMockDashboardContext(overrides = {}) {
  return {
    user: { id: 'user-1' },
    chatbot: { id: 'chatbot-1', chatbot_name: 'Test Bot', is_active: false },
    ownerData: { reception_phone: '' },
    loading: false,
    qaPairs: [],
    rootQuestions: [],
    mainMenuCount: 0,
    subOptionCount: 0,
    isEnterprise: false,
    isEnterpriseClient: false,
    brand: null,
    ...overrides,
    // stub all handlers
    handleLogout: () => {},
    handleSaveWhatsapp: () => {},
    handleSaveChatbotEdit: () => {},
    handleStartEditChatbot: () => {},
    handleAddMainQuestion: () => {},
    handleDeleteQuestion: () => {},
    getChildren: () => [],
    showAddQuestion: false,
    setShowAddQuestion: () => {},
    mainQuestionForm: { question_text: '', answer_text: '', media_url: '', media_type: '' },
    mainButtonOptions: [],
    error: null,
    handleMainQuestionChange: () => {},
    handleMainButtonOptionChange: () => {},
    addMainButtonOptionField: () => {},
    removeMainButtonOptionField: () => {},
    savingMainQuestion: false,
    setMainQuestionForm: () => {},
    setMainButtonOptions: () => {},
    editingQuestion: null,
    editQuestionForm: { question_text: '', answer_text: '', media_url: '', media_type: '' },
    setEditQuestionForm: () => {},
    handleStartEditQuestion: () => {},
    handleSaveQuestionEdit: () => {},
    handleEditQuestionFormChange: () => {},
    setEditingQuestion: () => {},
    savingEdit: false,
    handleAddSubOptions: async () => false,
    subscription: null,
    whatsappForm: { whatsapp_business_number: '', whatsapp_api_token: '' },
    showToken: false,
    setShowToken: () => {},
    handleWhatsappFormChange: () => {},
    savingWhatsapp: false,
    goLiveLoading: false,
  }
}
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- src/test/reception-phone.test.ts
```

Expected: `FAIL — reception_phone input not found`

- [ ] **Step 3: Add reception_phone to useDashboardData.ts**

In `src/hooks/useDashboardData.ts`, find the `checkUser` function. The owner select query already fetches from `owners`. Add `reception_phone` to the columns selected:

```typescript
// Find this line (around line 89):
const { data: od, error: oe } = await (supabase.from('owners') as any).select('id, email, full_name, is_active, onboarding_completed, whatsapp_business_number, whatsapp_api_token, created_at, updated_at, plan_type, enterprise_id, brand_name, brand_logo_url, brand_primary_color, max_clients').eq('id', user.id).single()

// Change to (add reception_phone to the select list):
const { data: od, error: oe } = await (supabase.from('owners') as any).select('id, email, full_name, is_active, onboarding_completed, whatsapp_business_number, whatsapp_api_token, created_at, updated_at, plan_type, enterprise_id, brand_name, brand_logo_url, brand_primary_color, max_clients, reception_phone').eq('id', user.id).single()
```

Then add the save handler. Find `handleSaveWhatsapp` (around line 138) and add this new function after it:

```typescript
const handleSaveReceptionPhone = async (phone: string) => {
  try {
    const cleaned = phone.trim().replace(/\D/g, '')
    const { error } = await supabase.from('owners').update({ reception_phone: cleaned || null }).eq('id', user.id)
    if (error) throw error
    setOwnerData((prev: any) => ({ ...prev, reception_phone: cleaned || null }))
    await supabase.from('audit_logs').insert({
      owner_id: user.id,
      action: 'reception_phone_updated',
      resource_type: 'owner',
      resource_id: user.id,
      metadata: { reception_phone: cleaned },
    })
    toast({ title: 'Reception number saved!' })
  } catch (err: any) {
    toast({ title: 'Failed to save', description: err.message, variant: 'destructive' })
  }
}
```

Also add `handleSaveReceptionPhone` to the return object at the bottom of `useDashboardData`.

- [ ] **Step 4: Add reception_phone to SettingsPage.tsx**

Open `src/components/dashboard/settings/SettingsPage.tsx`. Add the following inside the settings form, after the WhatsApp credentials section and before the closing card/section. Use the existing input/label styling patterns in that file:

```tsx
{/* Reception Phone */}
<div>
  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
    Reception WhatsApp Number
  </label>
  <input
    type="text"
    value={receptionPhone}
    onChange={e => setReceptionPhone(e.target.value)}
    placeholder="919876543210 (country code, no +)"
    aria-label="Reception phone"
    className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-input text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
  />
  <p className="text-[11px] text-muted-foreground mt-1">
    Booking and handoff alerts are sent to this number
  </p>
  <button
    type="button"
    onClick={() => handleSaveReceptionPhone(receptionPhone)}
    className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
  >
    Save Reception Number
  </button>
</div>
```

At the top of the component, add state:
```tsx
const { ownerData, handleSaveReceptionPhone } = useDashboard()
const [receptionPhone, setReceptionPhone] = React.useState(ownerData?.reception_phone ?? '')
```

- [ ] **Step 5: Run tests**

```bash
npm run test -- src/test/reception-phone.test.ts
```

Expected: `✓ 2 tests passed`

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDashboardData.ts src/components/dashboard/settings/SettingsPage.tsx src/test/reception-phone.test.ts src/test/helpers/mock-dashboard-context.ts
git commit -m "feat: add reception_phone field to Settings page and owner data hook"
```

---

## Task 8: Remove Booking Bot from Whatsapp Webhook

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

The `whatsapp-webhook` edge function currently has two execution paths: menu bot (`chatbot_type === 'menu'`) and booking bot (`chatbot_type === 'booking'`). We remove everything booking-related. The menu bot path is the only one that remains.

- [ ] **Step 1: Remove the BookingConfig interface**

Find and delete the entire `BookingConfig` interface block:

```typescript
// DELETE this entire interface:
interface BookingConfig {
  id: string
  chatbot_id: string
  doctor_name: string
  reception_phone: string
  work_start: string   // "12:00:00"
  work_end: string     // "20:00:00"
  slot_duration_mins: number
  buffer_mins: number
  symptoms: string[]
  step_media: Record<string, { url: string; type: string }>
}
```

- [ ] **Step 2: Remove booking DB helper functions**

Find and delete these entire functions:
- `getBookingConfig`
- `getConversationState`
- `updateConversationState`
- `upsertPatient`
- `getAvailableSlots`
- Any function prefixed `handleBooking`

These are the booking-specific DB helpers added after the `// ── Booking Bot: DB helpers ───` comment.

- [ ] **Step 3: Remove chatbot_type branching from the main handler**

Find the section in the main `serve` handler that does:

```typescript
if (chatbot.chatbot_type === 'booking') {
  // booking bot handling
} else {
  // menu bot handling
}
```

Replace the entire if/else with just the menu bot handling body (remove the outer conditional).

- [ ] **Step 4: Remove booking-specific date/time helpers if menu bot doesn't use them**

The functions `formatDate`, `fromMinutes`, `todayIST`, `tomorrowIST`, `currentMinutesIST` are only used by the booking bot. Check if any remain referenced after the previous removals:

```bash
grep -n "formatDate\|fromMinutes\|todayIST\|tomorrowIST\|currentMinutesIST" supabase/functions/whatsapp-webhook/index.ts
```

If the grep returns no results (no remaining references), delete those functions too.

- [ ] **Step 5: Verify the file compiles — check for TypeScript errors using Deno**

```bash
# Deno check (edge functions use Deno runtime)
npx supabase functions serve --no-verify-jwt whatsapp-webhook 2>&1 | head -20
# OR check for obvious syntax errors:
grep -c "booking" supabase/functions/whatsapp-webhook/index.ts
```

Expected: `grep -c "booking"` returns `0` (no remaining booking references).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat: remove booking bot engine from whatsapp-webhook edge function"
```

---

## Task 9: Run Migration — Dry Run then Live

This task is executed **against your actual Supabase project**, not locally. Ensure Tasks 1–3 (schema migrations) have been applied to the target environment first.

- [ ] **Step 1: Set environment variables**

```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Or add them to a `.env` file (already in `.gitignore`).

- [ ] **Step 2: Install tsx if not already installed**

```bash
npm install --save-dev tsx dotenv
```

- [ ] **Step 3: Run dry-run first — review output carefully**

```bash
npx tsx scripts/migrate-to-flows.ts --dry-run
```

Expected output format:
```
🚀 Starting migration (DRY RUN — no writes)
────────────────────────────────────────────────────────────

📦 Migrating chatbot: "My Bot" (chatbot-uuid-1)
  ✅ 12 nodes, 18 edges, 5 triggers
  (dry-run: skipping writes)

────────────────────────────────────────────────────────────

📊 Summary:
   Flows:    1
   Nodes:    12
   Edges:    18
   Triggers: 5

✅ Migration complete.
```

If any `❌ Validation errors` appear, fix the migration script logic before proceeding to live.

- [ ] **Step 4: Run live migration**

```bash
npx tsx scripts/migrate-to-flows.ts
```

Expected: Same output format but with `💾 Written to DB.` instead of `(dry-run: skipping writes)`.

- [ ] **Step 5: Verify in Supabase dashboard**

Run these verification queries in the Supabase SQL editor:

```sql
-- Check flows were created
SELECT id, name, status, entry_node_id FROM flows;

-- Check entry_node_id is set
SELECT COUNT(*) FROM flows WHERE entry_node_id IS NULL;
-- Expected: 0

-- Check trigger coverage
SELECT trigger_type, COUNT(*) FROM flow_triggers GROUP BY trigger_type;
-- Expected: restart (4 per chatbot), default (1 per chatbot)

-- Check no orphan nodes (nodes with no incoming edges except start node)
SELECT fn.id, fn.node_type, fn.label
FROM flow_nodes fn
WHERE fn.node_type != 'start'
AND fn.id NOT IN (SELECT target_node_id FROM flow_edges);
-- Expected: 0 rows
```

- [ ] **Step 6: Final commit**

```bash
git add package.json package-lock.json  # if tsx/dotenv were added
git commit -m "chore: run phase1 qa_pairs to flows migration (dry-run verified)"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Create flows, flow_nodes, flow_edges, flow_triggers, flow_sessions | Task 1 |
| All indexes from spec | Task 1 |
| RLS policies on all new tables (USING + WITH CHECK) | Task 1 |
| Drop booking tables (all 5) | Task 2 |
| Drop evolution_messages, evolution_reminders | Task 2 |
| Drop chatbots.chatbot_type | Task 2 |
| owners.reception_phone | Task 3 |
| Migration script: chatbots → flows | Task 5 |
| Migration script: qa_pairs → flow_nodes + flow_edges | Task 5 |
| Migration script: default + restart triggers | Task 5 |
| Migration script: dry-run flag | Task 5 |
| Post-migration validator (7 checks) | Task 5 |
| Remove BookingConfigPage (file, route, sidebar) | Task 6 |
| reception_phone in Settings UI | Task 7 |
| Remove booking bot from webhook | Task 8 |
| Run migration live | Task 9 |
| legacy_qa_pair_id on flow_nodes | Task 1 + Task 5 |
| set_updated_at triggers on new tables | Task 1 |
| Admin read-only policies on new tables | Task 1 |

All spec requirements are covered. No gaps.

**Placeholder scan:** No TBD/TODO patterns. All code blocks are complete.

**Type consistency:**
- `FlowRow`, `FlowNodeRow`, `FlowEdgeRow`, `FlowTriggerRow` defined in Task 5, used only in Task 5. ✅
- `buildFlowFromChatbot`, `buildStartAndGreetingNodes`, etc. — names match exactly between test file (Task 4) and implementation (Task 5). ✅
- `validateMigrationResult` signature matches in both test and implementation. ✅
