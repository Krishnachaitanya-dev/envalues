-- One-time repair for stock flow templates created before message buttons were seeded.
-- Run in the production database after deploying the application changes.

BEGIN;

WITH stock_template_menu_fixes(template_id, menu_text, primary_title, secondary_title) AS (
  VALUES
    ('clinic_doctor_appointment', 'Welcome to the clinic. Choose an option below. For emergencies, call local emergency services immediately.', 'Appointment Request', 'Timings and Location'),
    ('restaurant_cafe', 'Welcome. Choose an option below.', 'Menu Highlights', 'Reservations'),
    ('ecommerce_store', 'Welcome to our store. Choose an option below.', 'Browse Products', 'Track or Return'),
    ('salon_spa', 'Welcome. Choose an option below.', 'Services', 'Book Visit'),
    ('real_estate_leads', 'Welcome. Choose an option below.', 'Buy or Rent', 'Site Visit'),
    ('education_coaching', 'Welcome. Choose an option below.', 'Courses and Fees', 'Demo Class'),
    ('gym_fitness_studio', 'Welcome. Choose an option below.', 'Membership Plans', 'Trial Session'),
    ('hotel_homestay', 'Welcome. Choose an option below.', 'Rooms and Amenities', 'Check Availability'),
    ('travel_agency', 'Welcome. Choose an option below.', 'Package Enquiry', 'Visa or Flights'),
    ('insurance_finance', 'Welcome. Choose an option below. This chat does not provide financial advice.', 'Policy or Renewal', 'Claim Support'),
    ('automotive_service', 'Welcome. Choose an option below.', 'Book Service', 'Repair Estimate'),
    ('general_business', 'Welcome. Choose an option below.', 'Services', 'Pricing or Enquiry')
)
UPDATE public.flow_template_catalog catalog
SET
  template = jsonb_set(
    jsonb_set(
      catalog.template,
      '{nodes}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN node_item.node->>'id' = 'menu' THEN
              jsonb_set(
                jsonb_set(
                  node_item.node,
                  '{data,text}',
                  to_jsonb(fixes.menu_text),
                  true
                ),
                '{data,buttons}',
                jsonb_build_array(
                  jsonb_build_object('id', 'btn_primary', 'title', fixes.primary_title),
                  jsonb_build_object('id', 'btn_secondary', 'title', fixes.secondary_title),
                  jsonb_build_object('id', 'btn_support', 'title', 'Talk to Team')
                ),
                true
              )
            ELSE node_item.node
          END
          ORDER BY node_item.ordinality
        )
        FROM jsonb_array_elements(catalog.template->'nodes') WITH ORDINALITY AS node_item(node, ordinality)
      ),
      false
    ),
    '{edges}',
    (
      SELECT jsonb_agg(
        CASE edge_item.edge->>'id'
          WHEN 'edge_menu_primary' THEN
            jsonb_set(edge_item.edge, '{condition,value}', to_jsonb(lower(fixes.primary_title)), true)
          WHEN 'edge_menu_secondary' THEN
            jsonb_set(edge_item.edge, '{condition,value}', to_jsonb(lower(fixes.secondary_title)), true)
          WHEN 'edge_menu_handoff' THEN
            jsonb_set(
              jsonb_set(edge_item.edge, '{condition,value}', to_jsonb('talk to team'::text), true),
              '{condition,label}',
              to_jsonb('Talk to Team'::text),
              true
            )
          ELSE edge_item.edge
        END
        ORDER BY edge_item.ordinality
      )
      FROM jsonb_array_elements(catalog.template->'edges') WITH ORDINALITY AS edge_item(edge, ordinality)
    ),
    false
  ),
  updated_at = now()
FROM stock_template_menu_fixes fixes
WHERE catalog.id = fixes.template_id
  AND catalog.version = 1;

WITH stock_template_menu_fixes(template_id, menu_text, primary_title, secondary_title) AS (
  VALUES
    ('clinic_doctor_appointment', 'Welcome to the clinic. Choose an option below. For emergencies, call local emergency services immediately.', 'Appointment Request', 'Timings and Location'),
    ('restaurant_cafe', 'Welcome. Choose an option below.', 'Menu Highlights', 'Reservations'),
    ('ecommerce_store', 'Welcome to our store. Choose an option below.', 'Browse Products', 'Track or Return'),
    ('salon_spa', 'Welcome. Choose an option below.', 'Services', 'Book Visit'),
    ('real_estate_leads', 'Welcome. Choose an option below.', 'Buy or Rent', 'Site Visit'),
    ('education_coaching', 'Welcome. Choose an option below.', 'Courses and Fees', 'Demo Class'),
    ('gym_fitness_studio', 'Welcome. Choose an option below.', 'Membership Plans', 'Trial Session'),
    ('hotel_homestay', 'Welcome. Choose an option below.', 'Rooms and Amenities', 'Check Availability'),
    ('travel_agency', 'Welcome. Choose an option below.', 'Package Enquiry', 'Visa or Flights'),
    ('insurance_finance', 'Welcome. Choose an option below. This chat does not provide financial advice.', 'Policy or Renewal', 'Claim Support'),
    ('automotive_service', 'Welcome. Choose an option below.', 'Book Service', 'Repair Estimate'),
    ('general_business', 'Welcome. Choose an option below.', 'Services', 'Pricing or Enquiry')
)
UPDATE public.flow_nodes node
SET config = jsonb_set(
  jsonb_set(
    COALESCE(node.config, '{}'::jsonb),
    '{text}',
    to_jsonb(fixes.menu_text),
    true
  ),
  '{buttons}',
  jsonb_build_array(
    jsonb_build_object('id', 'btn_primary', 'title', fixes.primary_title),
    jsonb_build_object('id', 'btn_secondary', 'title', fixes.secondary_title),
    jsonb_build_object('id', 'btn_support', 'title', 'Talk to Team')
  ),
  true
)
FROM public.flows flow
JOIN stock_template_menu_fixes fixes
  ON fixes.template_id = flow.created_from_template_id
WHERE node.flow_id = flow.id
  AND flow.created_from_template_version = 1
  AND node.node_type = 'message'
  AND node.label = 'Main Menu'
  AND node.config->>'text' ILIKE '%reply 1%';

WITH stock_template_menu_fixes(template_id, primary_title, secondary_title) AS (
  VALUES
    ('clinic_doctor_appointment', 'Appointment Request', 'Timings and Location'),
    ('restaurant_cafe', 'Menu Highlights', 'Reservations'),
    ('ecommerce_store', 'Browse Products', 'Track or Return'),
    ('salon_spa', 'Services', 'Book Visit'),
    ('real_estate_leads', 'Buy or Rent', 'Site Visit'),
    ('education_coaching', 'Courses and Fees', 'Demo Class'),
    ('gym_fitness_studio', 'Membership Plans', 'Trial Session'),
    ('hotel_homestay', 'Rooms and Amenities', 'Check Availability'),
    ('travel_agency', 'Package Enquiry', 'Visa or Flights'),
    ('insurance_finance', 'Policy or Renewal', 'Claim Support'),
    ('automotive_service', 'Book Service', 'Repair Estimate'),
    ('general_business', 'Services', 'Pricing or Enquiry')
),
edge_fixes AS (
  SELECT
    edge.id AS edge_id,
    CASE edge.condition_value
      WHEN '1' THEN lower(fixes.primary_title)
      WHEN '2' THEN lower(fixes.secondary_title)
      WHEN 'support' THEN 'talk to team'
      ELSE edge.condition_value
    END AS next_condition_value,
    CASE edge.condition_value
      WHEN '1' THEN fixes.primary_title
      WHEN '2' THEN fixes.secondary_title
      WHEN 'support' THEN 'Talk to Team'
      ELSE edge.label
    END AS next_label
  FROM public.flow_edges edge
  JOIN public.flow_nodes source_node
    ON source_node.id = edge.source_node_id
  JOIN public.flows flow
    ON flow.id = edge.flow_id
  JOIN stock_template_menu_fixes fixes
    ON fixes.template_id = flow.created_from_template_id
  WHERE flow.created_from_template_version = 1
    AND source_node.node_type = 'message'
    AND source_node.label = 'Main Menu'
    AND edge.is_fallback = false
    AND edge.condition_type = 'contains'
    AND edge.condition_value IN ('1', '2', 'support')
)
UPDATE public.flow_edges edge
SET
  condition_value = edge_fixes.next_condition_value,
  label = edge_fixes.next_label
FROM edge_fixes
WHERE edge.id = edge_fixes.edge_id;

COMMIT;
