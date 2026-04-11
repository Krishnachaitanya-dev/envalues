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
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_flows_owner ON public.flows(owner_id);
CREATE INDEX idx_flows_owner_status ON public.flows(owner_id) WHERE status = 'published';

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
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
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
  created_at            timestamptz NOT NULL DEFAULT now()
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
  target_node_id  uuid REFERENCES public.flow_nodes(id) ON DELETE SET NULL,  -- null = use flow.entry_node_id
  trigger_type    text NOT NULL
                    CHECK (trigger_type IN ('keyword', 'api', 'default', 'restart')),
  trigger_value   text,
  priority        integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
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
  flow_id                 uuid NOT NULL REFERENCES public.flows(id) ON DELETE RESTRICT,
  current_node_id         uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE RESTRICT,
  phone                   text NOT NULL,
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'handoff', 'expired', 'error')),
  context                 jsonb NOT NULL DEFAULT '{}',
  call_stack              jsonb NOT NULL DEFAULT '[]',
  step_count              integer NOT NULL DEFAULT 0,
  max_steps               integer NOT NULL DEFAULT 100,
  last_node_executed_at   timestamptz,
  last_message_at         timestamptz DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, phone)
);

CREATE INDEX idx_flow_sessions_status ON public.flow_sessions(owner_id, status);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Pattern: USING controls reads, WITH CHECK controls writes. Both required.
-- Service role (edge functions) bypasses RLS — engine still enforces owner_id per query.

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flows_tenant_isolation" ON public.flows
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_nodes_tenant_isolation" ON public.flow_nodes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_edges_tenant_isolation" ON public.flow_edges
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

ALTER TABLE public.flow_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_triggers_tenant_isolation" ON public.flow_triggers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

ALTER TABLE public.flow_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_sessions_tenant_isolation" ON public.flow_sessions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

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
