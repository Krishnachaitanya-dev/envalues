-- Phase 3: server-owned, versioned flow template catalog + atomic instantiation.

ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS created_from_template_id text,
  ADD COLUMN IF NOT EXISTS created_from_template_version integer,
  ADD COLUMN IF NOT EXISTS template_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS template_request_id uuid;

ALTER TABLE public.flow_triggers
  ADD COLUMN IF NOT EXISTS normalized_trigger_value text GENERATED ALWAYS AS (
    NULLIF(lower(trim(regexp_replace(coalesce(trigger_value, ''), '\s+', ' ', 'g'))), '')
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_triggers_owner_type_normalized_active
  ON public.flow_triggers(owner_id, trigger_type, normalized_trigger_value)
  WHERE is_active = true
    AND trigger_type IN ('keyword', 'restart', 'api')
    AND normalized_trigger_value IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.flow_template_catalog (
  id          text NOT NULL,
  version     integer NOT NULL,
  name        text NOT NULL,
  description text,
  industries  text[] NOT NULL DEFAULT '{}',
  tags        text[] NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'draft', 'deprecated')),
  template    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

ALTER TABLE public.flow_template_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_template_catalog_read_active" ON public.flow_template_catalog;
CREATE POLICY "flow_template_catalog_read_active" ON public.flow_template_catalog
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (status = 'active');

CREATE TABLE IF NOT EXISTS public.flow_template_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  request_id       uuid NOT NULL,
  template_id      text NOT NULL,
  template_version integer NOT NULL,
  flow_id          uuid REFERENCES public.flows(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'started'
                    CHECK (status IN ('started', 'succeeded', 'failed')),
  response         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  UNIQUE(owner_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_template_applications_owner
  ON public.flow_template_applications(owner_id, created_at DESC);

ALTER TABLE public.flow_template_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_template_applications_owner_read" ON public.flow_template_applications;
CREATE POLICY "flow_template_applications_owner_read" ON public.flow_template_applications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_flow_template_provenance_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.created_from_template_id IS DISTINCT FROM NEW.created_from_template_id
    OR OLD.created_from_template_version IS DISTINCT FROM NEW.created_from_template_version
    OR OLD.template_applied_at IS DISTINCT FROM NEW.template_applied_at
    OR OLD.template_request_id IS DISTINCT FROM NEW.template_request_id
  THEN
    RAISE EXCEPTION 'flow template provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flows_template_provenance_immutable ON public.flows;
CREATE TRIGGER flows_template_provenance_immutable
  BEFORE UPDATE ON public.flows
  FOR EACH ROW
  WHEN (OLD.created_from_template_id IS NOT NULL)
  EXECUTE FUNCTION public.prevent_flow_template_provenance_update();

CREATE OR REPLACE FUNCTION public.flow_template_normalize_trigger(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g'))), '');
$$;

CREATE OR REPLACE FUNCTION public.build_stock_flow_template(
  p_id text,
  p_name text,
  p_emoji text,
  p_industries text[],
  p_tags text[],
  p_description text,
  p_trigger text,
  p_menu text,
  p_primary_label text,
  p_primary_text text,
  p_secondary_label text,
  p_secondary_text text,
  p_support text,
  p_farewell text,
  p_featured boolean DEFAULT false,
  p_sensitive boolean DEFAULT false,
  p_marketing boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_id,
    'version', 1,
    'name', p_name,
    'description', p_description,
    'industries', to_jsonb(p_industries),
    'tags', to_jsonb(p_tags),
    'emoji', p_emoji,
    'status', 'active',
    'featured', p_featured,
    'contentPolicy', jsonb_build_object(
      'requiresHumanReviewForSensitiveTopics', p_sensitive,
      'outboundApprovalRequiredCategories', jsonb_build_array('marketing'),
      'prohibitedClaims', CASE WHEN p_sensitive THEN jsonb_build_array('medical diagnosis', 'financial advice', 'guaranteed availability') ELSE '[]'::jsonb END
    ),
    'triggers', jsonb_build_array(
      jsonb_build_object('id', 'trigger_keyword', 'type', 'keyword', 'value', p_trigger, 'matchMode', 'normalized_exact', 'priority', 10),
      jsonb_build_object('id', 'trigger_restart', 'type', 'restart', 'value', 'menu', 'matchMode', 'normalized_exact', 'priority', 0)
    ),
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'start', 'type', 'start', 'label', 'Start', 'position', jsonb_build_object('x', 0, 'y', 160), 'data', jsonb_build_object('greeting_message', 'Started from ' || p_name)),
      jsonb_build_object('id', 'menu', 'type', 'message', 'label', 'Main Menu', 'position', jsonb_build_object('x', 260, 'y', 160), 'data', jsonb_build_object('text', p_menu), 'messageMeta', jsonb_build_object('category', 'support', 'outboundApprovalRequired', false, 'editable', true)),
      jsonb_build_object('id', 'primary', 'type', 'message', 'label', p_primary_label, 'position', jsonb_build_object('x', 560, 'y', 40), 'data', jsonb_build_object('text', p_primary_text), 'messageMeta', jsonb_build_object('category', CASE WHEN p_marketing THEN 'marketing' ELSE 'utility' END, 'outboundApprovalRequired', p_marketing, 'editable', true)),
      jsonb_build_object('id', 'secondary', 'type', 'message', 'label', p_secondary_label, 'position', jsonb_build_object('x', 560, 'y', 220), 'data', jsonb_build_object('text', p_secondary_text), 'messageMeta', jsonb_build_object('category', 'utility', 'outboundApprovalRequired', false, 'editable', true)),
      jsonb_build_object('id', 'handoff', 'type', 'handoff', 'label', 'Talk to Team', 'position', jsonb_build_object('x', 860, 'y', 140), 'data', jsonb_build_object('department', 'support', 'message', p_support, 'allow_resume', false, 'resume_node_id', null, 'queue_strategy', 'round_robin', 'handoff_timeout_hours', 24), 'messageMeta', jsonb_build_object('category', 'support', 'outboundApprovalRequired', false, 'editable', true)),
      jsonb_build_object('id', 'end', 'type', 'end', 'label', 'End', 'position', jsonb_build_object('x', 1120, 'y', 140), 'data', jsonb_build_object('farewell_message', p_farewell), 'messageMeta', jsonb_build_object('category', 'support', 'outboundApprovalRequired', false, 'editable', true))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'edge_start_menu', 'source', 'start', 'target', 'menu', 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', null, 'isFallback', false, 'priority', 0)),
      jsonb_build_object('id', 'edge_menu_primary', 'source', 'menu', 'target', 'primary', 'condition', jsonb_build_object('type', 'contains', 'value', '1', 'variable', null, 'label', p_primary_label, 'isFallback', false, 'priority', 0)),
      jsonb_build_object('id', 'edge_menu_secondary', 'source', 'menu', 'target', 'secondary', 'condition', jsonb_build_object('type', 'contains', 'value', '2', 'variable', null, 'label', p_secondary_label, 'isFallback', false, 'priority', 1)),
      jsonb_build_object('id', 'edge_menu_handoff', 'source', 'menu', 'target', 'handoff', 'condition', jsonb_build_object('type', 'contains', 'value', 'support', 'variable', null, 'label', 'Support', 'isFallback', false, 'priority', 2)),
      jsonb_build_object('id', 'edge_menu_fallback', 'source', 'menu', 'target', 'handoff', 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', 'Fallback', 'isFallback', true, 'priority', 99)),
      jsonb_build_object('id', 'edge_primary_end', 'source', 'primary', 'target', 'end', 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', null, 'isFallback', false, 'priority', 0)),
      jsonb_build_object('id', 'edge_secondary_end', 'source', 'secondary', 'target', 'end', 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', null, 'isFallback', false, 'priority', 0))
    )
  );
$$;

WITH seeds AS (
  SELECT * FROM (VALUES
    ('clinic_doctor_appointment','Clinic / Doctor Appointment','🏥',ARRAY['Healthcare'],ARRAY['appointments','clinic','handoff'],'Capture appointment interest and route urgent cases safely.','book appointment','Welcome to the clinic. Reply 1 to request an appointment, 2 for timings and location, or type support. For emergencies, call local emergency services immediately.','Appointment Request','Share patient name, preferred date, preferred time, and health concern. Reception will confirm availability before the appointment is final.','Timings and Location','Clinic hours: Mon-Sat 9 AM-1 PM and 5 PM-8 PM. Add your address and map link here.','Connecting you to reception. For urgent medical emergencies, call emergency services immediately.','Thank you. Our team will respond shortly.',true,true,false),
    ('restaurant_cafe','Restaurant / Cafe','🍽️',ARRAY['Food and Beverage'],ARRAY['menu','reservation','takeaway'],'Show menu highlights and collect reservation enquiries.','menu','Welcome. Reply 1 for menu highlights, 2 for reservations and timings, or type support.','Menu Highlights','Add your top dishes here. Prices and availability should be confirmed by staff.','Reservations','Share date, time, guest count, and special request. Staff will confirm table availability.','Connecting you to our restaurant team.','Thanks for contacting us. We hope to serve you soon.',true,false,false),
    ('ecommerce_store','Ecommerce Store','🛍️',ARRAY['Retail','Ecommerce'],ARRAY['orders','returns','support'],'Browse products, track orders, and route returns.','shop','Welcome to our store. Reply 1 to browse products, 2 for order tracking or returns, or type support.','Browse Products','Add your catalog link here. Promotional outbound copy may require WhatsApp approval.','Track or Return','Share order ID and registered phone/email. Support will check status or return eligibility.','Connecting you to customer support.','Thanks for shopping with us.',true,false,true),
    ('salon_spa','Salon / Spa','💇',ARRAY['Beauty and Wellness'],ARRAY['appointment','services','pricing'],'List services and collect appointment requests.','salon appointment','Welcome. Reply 1 for services and pricing, 2 to request an appointment, or type support.','Services','Add hair, skin, spa, and nail services here. Prices are indicative.','Book Visit','Share your name, service, preferred date, and preferred time. Staff will confirm the slot.','Connecting you to our salon team.','Thank you. We look forward to seeing you.',false,false,false),
    ('real_estate_leads','Real Estate','🏠',ARRAY['Real Estate'],ARRAY['lead capture','site visit','agent'],'Qualify buyers and route site visit requests.','property','Welcome. Reply 1 to buy or rent property, 2 to schedule a site visit, or type support.','Buy or Rent','Share city, property type, budget, and timeline. Listings and prices are subject to verification.','Site Visit','Share preferred date/time and property interest. An agent will confirm availability.','Connecting you to a property advisor.','Thank you. An advisor will follow up shortly.',false,false,false),
    ('education_coaching','Education / Coaching','🎓',ARRAY['Education'],ARRAY['courses','demo class','counsellor'],'Capture course enquiries and demo class requests.','course','Welcome. Reply 1 for courses and fees, 2 for a demo class, or type support.','Courses and Fees','Add course list, duration, fees, and batch options. Availability is confirmed by admissions.','Demo Class','Share student name, course interest, preferred date, and phone number.','Connecting you to an admissions counsellor.','Thank you. Our counsellor will contact you soon.',false,false,false),
    ('gym_fitness_studio','Gym / Fitness Studio','🏋️',ARRAY['Fitness'],ARRAY['trial','membership','trainer'],'Promote trial sessions and membership plans.','fitness','Welcome. Reply 1 for membership plans, 2 to book a trial session, or type support.','Membership Plans','Add plan details here. Promotional outbound messages may require WhatsApp approval.','Trial Session','Share your name, goal, and preferred time. Our team will confirm the slot.','Connecting you to the fitness desk.','Thanks. See you soon.',false,false,true),
    ('hotel_homestay','Hotel / Homestay','🏨',ARRAY['Hospitality'],ARRAY['rooms','booking','amenities'],'Capture room enquiries without implying confirmed booking.','room booking','Welcome. Reply 1 for rooms and amenities, 2 to request availability, or type support.','Rooms and Amenities','Add room types, amenities, check-in/out times, and policies. Rates and availability must be confirmed.','Check Availability','Share check-in date, check-out date, guest count, and room preference. Reservations will confirm.','Connecting you to reservations.','Thank you. Reservations will respond shortly.',false,false,false),
    ('travel_agency','Travel Agency','✈️',ARRAY['Travel'],ARRAY['packages','budget','callback'],'Collect destination, dates, and budget before advisor callback.','travel package','Welcome. Reply 1 for package enquiry, 2 for visa/flights help, or type support.','Package Enquiry','Share destination, dates, travelers, and budget. Package prices and availability are confirmed by an advisor.','Visa or Flights','Share destination country, travel date, and passenger count. An advisor will guide you.','Connecting you to a travel advisor.','Thank you. We will get back with suitable options.',false,false,false),
    ('insurance_finance','Insurance / Finance','🛡️',ARRAY['Finance','Insurance'],ARRAY['policy','claim','advisor'],'Route policy and claim queries without giving advice.','policy help','Welcome. Reply 1 for policy or renewal enquiry, 2 for claim support, or type support. This chat does not provide financial advice.','Policy or Renewal','Share policy type, renewal date, and contact number. An advisor will explain options; this is not financial advice.','Claim Support','Share policy number, claim type, and preferred callback time. Eligibility is subject to insurer review.','Connecting you to a licensed advisor or support team.','Thank you. Our team will contact you shortly.',false,true,false),
    ('automotive_service','Automotive Service','🚗',ARRAY['Automotive'],ARRAY['service booking','repair','pickup'],'Collect vehicle service details and repair requests.','car service','Welcome. Reply 1 to book service, 2 for repair estimate or pickup/drop, or type support.','Book Service','Share vehicle model, registration number, preferred date, and service type. Staff will confirm the slot.','Repair Estimate','Share issue details and photos if available. Estimates are indicative until inspection.','Connecting you to a service advisor.','Thank you. We will follow up soon.',false,false,false),
    ('general_business','General Business','🏢',ARRAY['General'],ARRAY['services','pricing','support'],'Flexible starter flow for service businesses.','hi','Welcome. Reply 1 for services, 2 for pricing or enquiry, or type support.','Services','Add your core services here and update this copy for your business.','Pricing or Enquiry','Share what you need, timeline, and contact details. Our team will respond with next steps.','Connecting you to our team.','Thank you for contacting us.',false,false,false)
  ) AS s(id,name,emoji,industries,tags,description,trigger_value,menu,primary_label,primary_text,secondary_label,secondary_text,support,farewell,featured,sensitive,marketing)
)
INSERT INTO public.flow_template_catalog (id, version, name, description, industries, tags, status, template)
SELECT
  id,
  1,
  name,
  description,
  industries,
  tags,
  'active',
  public.build_stock_flow_template(id, name, emoji, industries, tags, description, trigger_value, menu, primary_label, primary_text, secondary_label, secondary_text, support, farewell, featured, sensitive, marketing)
FROM seeds
ON CONFLICT (id, version) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  industries = EXCLUDED.industries,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  template = EXCLUDED.template,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.instantiate_flow_template(
  p_template_id text,
  p_template_version integer,
  p_request_id uuid,
  p_flow_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_template jsonb;
  v_existing public.flow_template_applications%ROWTYPE;
  v_flow public.flows%ROWTYPE;
  v_node jsonb;
  v_edge jsonb;
  v_trigger jsonb;
  v_node_id uuid;
  v_start_node_id uuid;
  v_response jsonb;
  v_normalized text;
BEGIN
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PERMISSION_DENIED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_existing
  FROM public.flow_template_applications
  WHERE owner_id = v_owner_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.status = 'succeeded' AND v_existing.response IS NOT NULL THEN
      RETURN v_existing.response || jsonb_build_object('replayed', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT', 'message', 'Template application is already in progress.');
  END IF;

  SELECT template INTO v_template
  FROM public.flow_template_catalog
  WHERE id = p_template_id AND version = p_template_version AND status = 'active';

  IF v_template IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TEMPLATE_NOT_FOUND', 'message', 'Template not found.');
  END IF;

  IF jsonb_array_length(v_template->'nodes') < 2
    OR (SELECT count(*) FROM jsonb_array_elements(v_template->'nodes') n WHERE n->>'type' = 'start') <> 1
  THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TEMPLATE_INVALID', 'message', 'Template must contain exactly one start node.');
  END IF;

  FOR v_trigger IN SELECT * FROM jsonb_array_elements(v_template->'triggers') LOOP
    v_normalized := public.flow_template_normalize_trigger(v_trigger->>'value');
    IF v_trigger->>'type' <> 'default' AND v_normalized IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TEMPLATE_INVALID', 'message', 'Template trigger cannot be empty.');
    END IF;
    IF v_normalized IN ('stop', 'unsubscribe') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TEMPLATE_INVALID', 'message', 'Template uses a reserved trigger keyword.');
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO public.flow_template_applications (owner_id, request_id, template_id, template_version, status)
    VALUES (v_owner_id, p_request_id, p_template_id, p_template_version, 'started');

    DROP TABLE IF EXISTS pg_temp.template_node_map;
    CREATE TEMP TABLE template_node_map (
      template_node_id text PRIMARY KEY,
      persisted_node_id uuid NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO public.flows (
      owner_id,
      name,
      description,
      status,
      version,
      created_from_template_id,
      created_from_template_version,
      template_applied_at,
      template_request_id
    )
    VALUES (
      v_owner_id,
      COALESCE(NULLIF(trim(p_flow_name), ''), v_template->>'name'),
      v_template->>'description',
      'draft',
      1,
      p_template_id,
      p_template_version,
      now(),
      p_request_id
    )
    RETURNING * INTO v_flow;

    FOR v_node IN SELECT * FROM jsonb_array_elements(v_template->'nodes') LOOP
      v_node_id := gen_random_uuid();
      INSERT INTO template_node_map VALUES (v_node->>'id', v_node_id);

      INSERT INTO public.flow_nodes (
        id,
        flow_id,
        owner_id,
        node_type,
        label,
        config,
        position_x,
        position_y
      )
      VALUES (
        v_node_id,
        v_flow.id,
        v_owner_id,
        v_node->>'type',
        v_node->>'label',
        COALESCE(v_node->'data', '{}'::jsonb),
        COALESCE(((v_node->'position'->>'x')::float), 0),
        COALESCE(((v_node->'position'->>'y')::float), 0)
      );

      IF v_node->>'type' = 'start' THEN
        v_start_node_id := v_node_id;
      END IF;
    END LOOP;

    UPDATE public.flows SET entry_node_id = v_start_node_id WHERE id = v_flow.id RETURNING * INTO v_flow;

    FOR v_edge IN SELECT * FROM jsonb_array_elements(v_template->'edges') LOOP
      IF NOT EXISTS (SELECT 1 FROM template_node_map WHERE template_node_id = v_edge->>'source')
        OR NOT EXISTS (SELECT 1 FROM template_node_map WHERE template_node_id = v_edge->>'target')
      THEN
        RAISE EXCEPTION 'template edge references missing node';
      END IF;

      INSERT INTO public.flow_edges (
        flow_id,
        owner_id,
        source_node_id,
        target_node_id,
        condition_type,
        condition_value,
        condition_variable,
        condition_expression,
        is_fallback,
        priority,
        label
      )
      SELECT
        v_flow.id,
        v_owner_id,
        source_map.persisted_node_id,
        target_map.persisted_node_id,
        v_edge->'condition'->>'type',
        v_edge->'condition'->>'value',
        v_edge->'condition'->>'variable',
        NULL,
        COALESCE((v_edge->'condition'->>'isFallback')::boolean, false),
        COALESCE((v_edge->'condition'->>'priority')::integer, 0),
        v_edge->'condition'->>'label'
      FROM template_node_map source_map
      CROSS JOIN template_node_map target_map
      WHERE source_map.template_node_id = v_edge->>'source'
        AND target_map.template_node_id = v_edge->>'target';
    END LOOP;

    FOR v_trigger IN SELECT * FROM jsonb_array_elements(v_template->'triggers') LOOP
      INSERT INTO public.flow_triggers (
        owner_id,
        flow_id,
        target_node_id,
        trigger_type,
        trigger_value,
        priority,
        is_active,
        metadata
      )
      VALUES (
        v_owner_id,
        v_flow.id,
        NULL,
        v_trigger->>'type',
        v_trigger->>'value',
        COALESCE((v_trigger->>'priority')::integer, 0),
        false,
        jsonb_build_object(
          'created_from_template_id', p_template_id,
          'created_from_template_version', p_template_version,
          'matchMode', v_trigger->>'matchMode'
        )
      );
    END LOOP;

    SELECT jsonb_build_object(
      'ok', true,
      'flow', to_jsonb(v_flow),
      'nodes', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at) FROM public.flow_nodes n WHERE n.flow_id = v_flow.id), '[]'::jsonb),
      'edges', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.priority, e.created_at) FROM public.flow_edges e WHERE e.flow_id = v_flow.id), '[]'::jsonb),
      'triggers', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.priority, t.created_at) FROM public.flow_triggers t WHERE t.flow_id = v_flow.id), '[]'::jsonb)
    ) INTO v_response;

    INSERT INTO public.audit_logs (owner_id, action, resource_type, resource_id, metadata)
    VALUES (
      v_owner_id,
      'flow_template_apply_succeeded',
      'flow',
      v_flow.id,
      jsonb_build_object('template_id', p_template_id, 'template_version', p_template_version, 'request_id', p_request_id)
    );

    UPDATE public.flow_template_applications
    SET status = 'succeeded', flow_id = v_flow.id, response = v_response, completed_at = now()
    WHERE owner_id = v_owner_id AND request_id = p_request_id;

    RETURN v_response;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TRIGGER_CONFLICT', 'message', 'A trigger conflict prevented template creation.');
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'code', 'DB_WRITE_FAILED', 'message', SQLERRM);
  END;
END;
$$;
