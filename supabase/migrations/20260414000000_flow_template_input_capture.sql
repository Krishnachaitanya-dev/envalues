-- Phase 3 template behavior fix:
-- Options that ask users to "share" details must be input nodes that pause
-- for a reply and then route to handoff, not message nodes that immediately end.

CREATE OR REPLACE FUNCTION public.build_stock_flow_template_v2(
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
  p_primary_collect boolean,
  p_secondary_label text,
  p_secondary_text text,
  p_secondary_collect boolean,
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
      jsonb_build_object(
        'id', 'menu',
        'type', 'message',
        'label', 'Main Menu',
        'position', jsonb_build_object('x', 260, 'y', 160),
        'data', jsonb_build_object(
          'text', p_menu,
          'buttons', jsonb_build_array(
            jsonb_build_object('id', 'btn_primary', 'title', p_primary_label),
            jsonb_build_object('id', 'btn_secondary', 'title', p_secondary_label),
            jsonb_build_object('id', 'btn_support', 'title', 'Talk to Team')
          )
        ),
        'messageMeta', jsonb_build_object('category', 'support', 'outboundApprovalRequired', false, 'editable', true)
      ),
      CASE WHEN p_primary_collect THEN
        jsonb_build_object(
          'id', 'primary',
          'type', 'input',
          'label', p_primary_label,
          'position', jsonb_build_object('x', 560, 'y', 40),
          'data', jsonb_build_object('prompt', p_primary_text, 'store_as', 'primary_response', 'timeout_secs', 300),
          'messageMeta', jsonb_build_object('category', CASE WHEN p_marketing THEN 'marketing' ELSE 'utility' END, 'outboundApprovalRequired', p_marketing, 'editable', true, 'variablesCreated', jsonb_build_array('primary_response'))
        )
      ELSE
        jsonb_build_object(
          'id', 'primary',
          'type', 'message',
          'label', p_primary_label,
          'position', jsonb_build_object('x', 560, 'y', 40),
          'data', jsonb_build_object('text', p_primary_text),
          'messageMeta', jsonb_build_object('category', CASE WHEN p_marketing THEN 'marketing' ELSE 'utility' END, 'outboundApprovalRequired', p_marketing, 'editable', true)
        )
      END,
      CASE WHEN p_secondary_collect THEN
        jsonb_build_object(
          'id', 'secondary',
          'type', 'input',
          'label', p_secondary_label,
          'position', jsonb_build_object('x', 560, 'y', 220),
          'data', jsonb_build_object('prompt', p_secondary_text, 'store_as', 'secondary_response', 'timeout_secs', 300),
          'messageMeta', jsonb_build_object('category', 'utility', 'outboundApprovalRequired', false, 'editable', true, 'variablesCreated', jsonb_build_array('secondary_response'))
        )
      ELSE
        jsonb_build_object(
          'id', 'secondary',
          'type', 'message',
          'label', p_secondary_label,
          'position', jsonb_build_object('x', 560, 'y', 220),
          'data', jsonb_build_object('text', p_secondary_text),
          'messageMeta', jsonb_build_object('category', 'utility', 'outboundApprovalRequired', false, 'editable', true)
        )
      END,
      jsonb_build_object('id', 'handoff', 'type', 'handoff', 'label', 'Talk to Team', 'position', jsonb_build_object('x', 860, 'y', 140), 'data', jsonb_build_object('department', 'support', 'message', p_support, 'allow_resume', false, 'resume_node_id', null, 'queue_strategy', 'round_robin', 'handoff_timeout_hours', 24), 'messageMeta', jsonb_build_object('category', 'support', 'outboundApprovalRequired', false, 'editable', true))
    ) || CASE WHEN NOT p_primary_collect OR NOT p_secondary_collect THEN
      jsonb_build_array(jsonb_build_object('id', 'end', 'type', 'end', 'label', 'End', 'position', jsonb_build_object('x', 1120, 'y', 140), 'data', jsonb_build_object('farewell_message', p_farewell), 'messageMeta', jsonb_build_object('category', 'support', 'outboundApprovalRequired', false, 'editable', true)))
    ELSE '[]'::jsonb END,
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'edge_start_menu', 'source', 'start', 'target', 'menu', 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', null, 'isFallback', false, 'priority', 0)),
      jsonb_build_object('id', 'edge_menu_primary', 'source', 'menu', 'target', 'primary', 'condition', jsonb_build_object('type', 'regex', 'value', '^(1|' || lower(p_primary_label) || ')$', 'variable', null, 'label', p_primary_label, 'isFallback', false, 'priority', 0)),
      jsonb_build_object('id', 'edge_menu_secondary', 'source', 'menu', 'target', 'secondary', 'condition', jsonb_build_object('type', 'regex', 'value', '^(2|' || lower(p_secondary_label) || ')$', 'variable', null, 'label', p_secondary_label, 'isFallback', false, 'priority', 1)),
      jsonb_build_object('id', 'edge_menu_handoff', 'source', 'menu', 'target', 'handoff', 'condition', jsonb_build_object('type', 'regex', 'value', '^(support|talk to team)$', 'variable', null, 'label', 'Talk to Team', 'isFallback', false, 'priority', 2)),
      jsonb_build_object('id', 'edge_menu_fallback', 'source', 'menu', 'target', 'handoff', 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', 'Fallback', 'isFallback', true, 'priority', 99)),
      jsonb_build_object('id', 'edge_primary_after', 'source', 'primary', 'target', CASE WHEN p_primary_collect THEN 'handoff' ELSE 'end' END, 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', null, 'isFallback', false, 'priority', 0)),
      jsonb_build_object('id', 'edge_secondary_after', 'source', 'secondary', 'target', CASE WHEN p_secondary_collect THEN 'handoff' ELSE 'end' END, 'condition', jsonb_build_object('type', 'always', 'value', null, 'variable', null, 'label', null, 'isFallback', false, 'priority', 0))
    )
  );
$$;

WITH seeds AS (
  SELECT * FROM (VALUES
    ('clinic_doctor_appointment','Clinic / Doctor Appointment','🏥',ARRAY['Healthcare'],ARRAY['appointments','clinic','handoff'],'Capture appointment interest and route urgent cases safely.','book appointment','Welcome to the clinic. Choose an option below. For emergencies, call local emergency services immediately.','Appointment Request','Share patient name, preferred date, preferred time, and health concern. Reception will confirm availability before the appointment is final.',true,'Timings and Location','Clinic hours: Mon-Sat 9 AM-1 PM and 5 PM-8 PM. Add your address and map link here.',false,'Connecting you to reception. For urgent medical emergencies, call emergency services immediately.','Thank you. Our team will respond shortly.',true,true,false),
    ('restaurant_cafe','Restaurant / Cafe','🍽️',ARRAY['Food and Beverage'],ARRAY['menu','reservation','takeaway'],'Show menu highlights and collect reservation enquiries.','menu','Welcome. Choose an option below.','Menu Highlights','Add your top dishes here. Prices and availability should be confirmed by staff.',false,'Reservations','Share date, time, guest count, and special request. Staff will confirm table availability.',true,'Connecting you to our restaurant team.','Thanks for contacting us. We hope to serve you soon.',true,false,false),
    ('ecommerce_store','Ecommerce Store','🛍️',ARRAY['Retail','Ecommerce'],ARRAY['orders','returns','support'],'Browse products, track orders, and route returns.','shop','Welcome to our store. Choose an option below.','Browse Products','Share what you are looking for, or add your catalog link here. Promotional outbound copy may require WhatsApp approval.',true,'Track or Return','Share order ID and registered phone/email. Support will check status or return eligibility.',true,'Connecting you to customer support.','Thanks for shopping with us.',true,false,true),
    ('salon_spa','Salon / Spa','💇',ARRAY['Beauty and Wellness'],ARRAY['appointment','services','pricing'],'List services and collect appointment requests.','salon appointment','Welcome. Choose an option below.','Services','Add hair, skin, spa, and nail services here. Prices are indicative.',false,'Book Visit','Share your name, service, preferred date, and preferred time. Staff will confirm the slot.',true,'Connecting you to our salon team.','Thank you. We look forward to seeing you.',false,false,false),
    ('real_estate_leads','Real Estate','🏠',ARRAY['Real Estate'],ARRAY['lead capture','site visit','agent'],'Qualify buyers and route site visit requests.','property','Welcome. Choose an option below.','Buy or Rent','Share city, property type, budget, and timeline. Listings and prices are subject to verification.',true,'Site Visit','Share preferred date/time and property interest. An agent will confirm availability.',true,'Connecting you to a property advisor.','Thank you. An advisor will follow up shortly.',false,false,false),
    ('education_coaching','Education / Coaching','🎓',ARRAY['Education'],ARRAY['courses','demo class','counsellor'],'Capture course enquiries and demo class requests.','course','Welcome. Choose an option below.','Courses and Fees','Add course list, duration, fees, and batch options. Availability is confirmed by admissions.',false,'Demo Class','Share student name, course interest, preferred date, and phone number.',true,'Connecting you to an admissions counsellor.','Thank you. Our counsellor will contact you soon.',false,false,false),
    ('gym_fitness_studio','Gym / Fitness Studio','🏋️',ARRAY['Fitness'],ARRAY['trial','membership','trainer'],'Promote trial sessions and membership plans.','fitness','Welcome. Choose an option below.','Membership Plans','Add plan details here. Promotional outbound messages may require WhatsApp approval.',false,'Trial Session','Share your name, goal, and preferred time. Our team will confirm the trial slot.',true,'Connecting you to the fitness desk.','Thanks. See you soon.',false,false,true),
    ('hotel_homestay','Hotel / Homestay','🏨',ARRAY['Hospitality'],ARRAY['rooms','booking','amenities'],'Capture room enquiries without implying confirmed booking.','room booking','Welcome. Choose an option below.','Rooms and Amenities','Add room types, amenities, check-in/out times, and policies. Rates and availability must be confirmed.',false,'Check Availability','Share check-in date, check-out date, guest count, and room preference. Reservations will confirm.',true,'Connecting you to reservations.','Thank you. Reservations will respond shortly.',false,false,false),
    ('travel_agency','Travel Agency','✈️',ARRAY['Travel'],ARRAY['packages','budget','callback'],'Collect destination, dates, and budget before advisor callback.','travel package','Welcome. Choose an option below.','Package Enquiry','Share destination, dates, travelers, and budget. Package prices and availability are confirmed by an advisor.',true,'Visa or Flights','Share destination country, travel date, and passenger count. An advisor will guide you.',true,'Connecting you to a travel advisor.','Thank you. We will get back with suitable options.',false,false,false),
    ('insurance_finance','Insurance / Finance','🛡️',ARRAY['Finance','Insurance'],ARRAY['policy','claim','advisor'],'Route policy and claim queries without giving advice.','policy help','Welcome. Choose an option below. This chat does not provide financial advice.','Policy or Renewal','Share policy type, renewal date, and contact number. An advisor will explain options; this is not financial advice.',true,'Claim Support','Share policy number, claim type, and preferred callback time. Eligibility is subject to insurer review.',true,'Connecting you to a licensed advisor or support team.','Thank you. Our team will contact you shortly.',false,true,false),
    ('automotive_service','Automotive Service','🚗',ARRAY['Automotive'],ARRAY['service booking','repair','pickup'],'Collect vehicle service details and repair requests.','car service','Welcome. Choose an option below.','Book Service','Share vehicle model, registration number, preferred date, and service type. Staff will confirm the slot.',true,'Repair Estimate','Share issue details and photos if available. Estimates are indicative until inspection.',true,'Connecting you to a service advisor.','Thank you. We will follow up soon.',false,false,false),
    ('general_business','General Business','🏢',ARRAY['General'],ARRAY['services','pricing','support'],'Flexible starter flow for service businesses.','hi','Welcome. Choose an option below.','Services','Add your core services here and update this copy for your business.',false,'Pricing or Enquiry','Share what you need, timeline, and contact details. Our team will respond with next steps.',true,'Connecting you to our team.','Thank you for contacting us.',false,false,false)
  ) AS s(id,name,emoji,industries,tags,description,trigger_value,menu,primary_label,primary_text,primary_collect,secondary_label,secondary_text,secondary_collect,support,farewell,featured,sensitive,marketing)
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
  public.build_stock_flow_template_v2(id, name, emoji, industries, tags, description, trigger_value, menu, primary_label, primary_text, primary_collect, secondary_label, secondary_text, secondary_collect, support, farewell, featured, sensitive, marketing)
FROM seeds
ON CONFLICT (id, version) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  industries = EXCLUDED.industries,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  template = EXCLUDED.template,
  updated_at = now();
