import type { FlowTemplate, TemplateNode } from '../domain/template.types'
import { assertValidTemplate } from '../domain/validateTemplateGraph'

type BusinessTemplateInput = {
  id: string
  name: string
  emoji: string
  industries: string[]
  tags: string[]
  featured?: boolean
  description: string
  trigger: string
  menuText: string
  primaryOption: { label: string; text: string; category?: 'utility' | 'marketing' | 'support'; approval?: boolean; collect?: boolean }
  secondaryOption: { label: string; text: string; category?: 'utility' | 'marketing' | 'support'; approval?: boolean; collect?: boolean }
  supportText: string
  farewell: string
  contentPolicy?: FlowTemplate['contentPolicy']
}

const defaultContentPolicy: FlowTemplate['contentPolicy'] = {
  requiresHumanReviewForSensitiveTopics: false,
  outboundApprovalRequiredCategories: ['marketing'],
  prohibitedClaims: [],
}

function messageNode(
  id: string,
  label: string,
  text: string,
  x: number,
  y: number,
  category: 'utility' | 'marketing' | 'support' = 'utility',
  outboundApprovalRequired = false,
): TemplateNode {
  return {
    id,
    type: 'message',
    label,
    position: { x, y },
    data: { text },
    messageMeta: {
      category,
      outboundApprovalRequired,
      editable: true,
    },
  }
}

function optionNode(
  id: 'primary' | 'secondary',
  label: string,
  text: string,
  x: number,
  y: number,
  collect: boolean,
  category: 'utility' | 'marketing' | 'support' = 'utility',
  outboundApprovalRequired = false,
): TemplateNode {
  if (!collect) return messageNode(id, label, text, x, y, category, outboundApprovalRequired)

  return {
    id,
    type: 'input',
    label,
    position: { x, y },
    data: {
      prompt: text,
      store_as: `${id}_response`,
      timeout_secs: 300,
    },
    messageMeta: {
      category,
      outboundApprovalRequired,
      editable: true,
      variablesCreated: [`${id}_response`],
    },
  }
}

function choicePattern(index: 1 | 2, label: string) {
  const escapedLabel = label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `^(${index}|${escapedLabel})$`
}

function createBusinessTemplate(input: BusinessTemplateInput): FlowTemplate {
  const primaryCollect = Boolean(input.primaryOption.collect)
  const secondaryCollect = Boolean(input.secondaryOption.collect)
  const hasEndPath = !primaryCollect || !secondaryCollect

  const template: FlowTemplate = {
    id: input.id,
    version: 1,
    name: input.name,
    description: input.description,
    industries: input.industries,
    tags: input.tags,
    emoji: input.emoji,
    status: 'active',
    featured: Boolean(input.featured),
    contentPolicy: input.contentPolicy ?? defaultContentPolicy,
    triggers: [
      { id: 'trigger_keyword', type: 'keyword', value: input.trigger, matchMode: 'normalized_exact', priority: 10 },
      { id: 'trigger_restart', type: 'restart', value: 'menu', matchMode: 'normalized_exact', priority: 0 },
    ],
    nodes: [
      { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 160 }, data: { greeting_message: `Started from ${input.name}` } },
      {
        id: 'menu',
        type: 'message',
        label: 'Main Menu',
        position: { x: 260, y: 160 },
        data: {
          text: input.menuText,
          buttons: [
            { id: 'btn_primary', title: input.primaryOption.label },
            { id: 'btn_secondary', title: input.secondaryOption.label },
            { id: 'btn_support', title: 'Talk to Team' },
          ],
        },
        messageMeta: { category: 'support', outboundApprovalRequired: false, editable: true },
      },
      optionNode('primary', input.primaryOption.label, input.primaryOption.text, 560, 40, primaryCollect, input.primaryOption.category ?? 'utility', Boolean(input.primaryOption.approval)),
      optionNode('secondary', input.secondaryOption.label, input.secondaryOption.text, 560, 220, secondaryCollect, input.secondaryOption.category ?? 'utility', Boolean(input.secondaryOption.approval)),
      {
        id: 'handoff',
        type: 'handoff',
        label: 'Talk to Team',
        position: { x: 860, y: 140 },
        data: {
          department: 'support',
          message: input.supportText,
          allow_resume: false,
          resume_node_id: null,
          queue_strategy: 'round_robin',
          handoff_timeout_hours: 24,
        },
        messageMeta: { category: 'support', outboundApprovalRequired: false, editable: true },
      },
      ...(hasEndPath ? [{
        id: 'end',
        type: 'end',
        label: 'End',
        position: { x: 1120, y: 140 },
        data: { farewell_message: input.farewell },
        messageMeta: { category: 'support', outboundApprovalRequired: false, editable: true },
      }] : []),
    ],
    edges: [
      { id: 'edge_start_menu', source: 'start', target: 'menu', condition: { type: 'always', value: null, variable: null, label: null, isFallback: false, priority: 0 } },
      { id: 'edge_menu_primary', source: 'menu', target: 'primary', condition: { type: 'regex', value: choicePattern(1, input.primaryOption.label), variable: null, label: input.primaryOption.label, isFallback: false, priority: 0 } },
      { id: 'edge_menu_secondary', source: 'menu', target: 'secondary', condition: { type: 'regex', value: choicePattern(2, input.secondaryOption.label), variable: null, label: input.secondaryOption.label, isFallback: false, priority: 1 } },
      { id: 'edge_menu_handoff', source: 'menu', target: 'handoff', condition: { type: 'regex', value: '^(support|talk to team)$', variable: null, label: 'Support', isFallback: false, priority: 2 } },
      { id: 'edge_menu_fallback', source: 'menu', target: 'handoff', condition: { type: 'always', value: null, variable: null, label: 'Fallback', isFallback: true, priority: 99 } },
      { id: 'edge_primary_after', source: 'primary', target: primaryCollect ? 'handoff' : 'end', condition: { type: 'always', value: null, variable: null, label: null, isFallback: false, priority: 0 } },
      { id: 'edge_secondary_after', source: 'secondary', target: secondaryCollect ? 'handoff' : 'end', condition: { type: 'always', value: null, variable: null, label: null, isFallback: false, priority: 0 } },
    ],
  }

  return assertValidTemplate(template)
}

export const STOCK_FLOW_TEMPLATES: FlowTemplate[] = [
  createBusinessTemplate({
    id: 'clinic_doctor_appointment',
    name: 'Clinic / Doctor Appointment',
    emoji: '🏥',
    industries: ['Healthcare'],
    tags: ['appointments', 'clinic', 'handoff'],
    featured: true,
    description: 'Capture appointment interest, explain services, and safely route urgent cases to reception.',
    trigger: 'book appointment',
    menuText: 'Welcome to the clinic. Reply 1 to request an appointment, 2 to view timings and location, or type support to talk to reception. For emergencies, call local emergency services immediately.',
    primaryOption: { label: 'Appointment Request', text: 'Please share patient name, preferred date, preferred time, and health concern. Our reception team will confirm availability before the appointment is final.', collect: true },
    secondaryOption: { label: 'Timings and Location', text: 'Clinic hours: Mon-Sat 9 AM-1 PM and 5 PM-8 PM. Sunday by prior appointment only. Add your address and Google Maps link here.' },
    supportText: 'Connecting you to reception. For urgent medical emergencies, call emergency services immediately; do not wait for chatbot replies.',
    farewell: 'Thank you. Our team will respond shortly during working hours.',
    contentPolicy: {
      requiresHumanReviewForSensitiveTopics: true,
      outboundApprovalRequiredCategories: ['marketing'],
      prohibitedClaims: ['medical diagnosis', 'guaranteed cure', 'emergency handling by chatbot'],
    },
  }),
  createBusinessTemplate({
    id: 'restaurant_cafe',
    name: 'Restaurant / Cafe',
    emoji: '🍽️',
    industries: ['Food and Beverage'],
    tags: ['menu', 'reservation', 'takeaway'],
    featured: true,
    description: 'Show menu highlights, route reservations, and collect takeaway enquiries.',
    trigger: 'menu',
    menuText: 'Welcome. Reply 1 to see menu highlights, 2 for reservations and timings, or type support to talk to staff.',
    primaryOption: { label: 'Menu Highlights', text: 'Add your top dishes here. Example: starters, mains, desserts, beverages. Prices and availability should be confirmed by staff.' },
    secondaryOption: { label: 'Reservations', text: 'Share date, time, number of guests, and any special request. Our team will confirm table availability before your reservation is final.', collect: true },
    supportText: 'Connecting you to our restaurant team for orders, reservations, or special requests.',
    farewell: 'Thanks for contacting us. We hope to serve you soon.',
  }),
  createBusinessTemplate({
    id: 'ecommerce_store',
    name: 'Ecommerce Store',
    emoji: '🛍️',
    industries: ['Retail', 'Ecommerce'],
    tags: ['orders', 'returns', 'support'],
    featured: true,
    description: 'Help customers browse products, track orders, and start return/support requests.',
    trigger: 'shop',
    menuText: 'Welcome to our store. Reply 1 to browse product categories, 2 for order tracking or returns, or type support for help.',
    primaryOption: { label: 'Browse Products', text: 'Share what you are looking for, or add your catalog link here. Promotional copy may require WhatsApp approval before outbound campaigns.', category: 'marketing', approval: true, collect: true },
    secondaryOption: { label: 'Track or Return', text: 'Please share your order ID and registered phone/email. Our support team will check the latest status or return eligibility.', collect: true },
    supportText: 'Connecting you to customer support for order or product help.',
    farewell: 'Thanks for shopping with us.',
  }),
  createBusinessTemplate({
    id: 'salon_spa',
    name: 'Salon / Spa',
    emoji: '💇',
    industries: ['Beauty and Wellness'],
    tags: ['appointment', 'services', 'pricing'],
    description: 'List services, collect appointment interest, and hand off to staff.',
    trigger: 'salon appointment',
    menuText: 'Welcome. Reply 1 for services and pricing, 2 to request an appointment, or type support to talk to our team.',
    primaryOption: { label: 'Services', text: 'Add hair, skin, spa, and nail services here. Prices are indicative and should be confirmed by staff.' },
    secondaryOption: { label: 'Book Visit', text: 'Share your name, service, preferred date, and preferred time. Our team will confirm slot availability.', collect: true },
    supportText: 'Connecting you to our salon team.',
    farewell: 'Thank you. We look forward to seeing you.',
  }),
  createBusinessTemplate({
    id: 'real_estate_leads',
    name: 'Real Estate',
    emoji: '🏠',
    industries: ['Real Estate'],
    tags: ['lead capture', 'site visit', 'agent'],
    description: 'Qualify buyer/renter intent and route serious leads to agents.',
    trigger: 'property',
    menuText: 'Welcome. Reply 1 if you want to buy or rent property, 2 to schedule a site visit, or type support to talk to an agent.',
    primaryOption: { label: 'Buy or Rent', text: 'Please share city/locality, property type, budget, and timeline. Listings and prices are subject to availability and verification.', collect: true },
    secondaryOption: { label: 'Site Visit', text: 'Share your preferred date/time and property interest. Our agent will confirm availability before scheduling.', collect: true },
    supportText: 'Connecting you to a property advisor.',
    farewell: 'Thank you. An advisor will follow up shortly.',
  }),
  createBusinessTemplate({
    id: 'education_coaching',
    name: 'Education / Coaching',
    emoji: '🎓',
    industries: ['Education'],
    tags: ['courses', 'demo class', 'counsellor'],
    description: 'Capture course enquiries, demo requests, and counsellor handoff.',
    trigger: 'course',
    menuText: 'Welcome. Reply 1 for courses and fees, 2 to request a demo class, or type support to speak with a counsellor.',
    primaryOption: { label: 'Courses and Fees', text: 'Add your course list, duration, fees, and batch options here. Final availability is confirmed by admissions.' },
    secondaryOption: { label: 'Demo Class', text: 'Share student name, course interest, preferred date, and phone number. Our counsellor will confirm the demo slot.', collect: true },
    supportText: 'Connecting you to an admissions counsellor.',
    farewell: 'Thank you. Our counsellor will contact you soon.',
  }),
  createBusinessTemplate({
    id: 'gym_fitness_studio',
    name: 'Gym / Fitness Studio',
    emoji: '🏋️',
    industries: ['Fitness'],
    tags: ['trial', 'membership', 'trainer'],
    description: 'Promote trial sessions, membership plans, and trainer callbacks.',
    trigger: 'fitness',
    menuText: 'Welcome. Reply 1 for membership plans, 2 to book a trial session, or type support to talk to the fitness desk.',
    primaryOption: { label: 'Membership Plans', text: 'Add monthly, quarterly, and annual plans here. Promotional plan messages may require WhatsApp approval before outbound campaigns.', category: 'marketing', approval: true },
    secondaryOption: { label: 'Trial Session', text: 'Share your name, goal, and preferred time. Our team will confirm the trial slot.', collect: true },
    supportText: 'Connecting you to the fitness desk.',
    farewell: 'Thanks. See you soon.',
  }),
  createBusinessTemplate({
    id: 'hotel_homestay',
    name: 'Hotel / Homestay',
    emoji: '🏨',
    industries: ['Hospitality'],
    tags: ['rooms', 'booking', 'amenities'],
    description: 'Capture room enquiries and route booking requests safely.',
    trigger: 'room booking',
    menuText: 'Welcome. Reply 1 for rooms and amenities, 2 to request booking availability, or type support to speak with reservations.',
    primaryOption: { label: 'Rooms and Amenities', text: 'Add room types, amenities, check-in/out times, and policies here. Rates and availability must be confirmed by reservations.' },
    secondaryOption: { label: 'Check Availability', text: 'Share check-in date, check-out date, guest count, and room preference. Our team will confirm availability before booking.', collect: true },
    supportText: 'Connecting you to reservations.',
    farewell: 'Thank you. Reservations will respond shortly.',
  }),
  createBusinessTemplate({
    id: 'travel_agency',
    name: 'Travel Agency',
    emoji: '✈️',
    industries: ['Travel'],
    tags: ['packages', 'budget', 'callback'],
    description: 'Collect destination, dates, and budget before agent follow-up.',
    trigger: 'travel package',
    menuText: 'Welcome. Reply 1 for package enquiry, 2 for visa/flights help, or type support to talk to a travel advisor.',
    primaryOption: { label: 'Package Enquiry', text: 'Share destination, travel dates, number of travelers, and budget. Package prices and availability are confirmed by an advisor.', collect: true },
    secondaryOption: { label: 'Visa or Flights', text: 'Share destination country, travel date, and passenger count. Our advisor will guide you on options and requirements.', collect: true },
    supportText: 'Connecting you to a travel advisor.',
    farewell: 'Thank you. We will get back with suitable options.',
  }),
  createBusinessTemplate({
    id: 'insurance_finance',
    name: 'Insurance / Finance',
    emoji: '🛡️',
    industries: ['Finance', 'Insurance'],
    tags: ['policy', 'claim', 'advisor'],
    description: 'Route policy, renewal, and claim queries to an advisor without implying advice.',
    trigger: 'policy help',
    menuText: 'Welcome. Reply 1 for policy or renewal enquiry, 2 for claim support, or type support to speak with an advisor. This chat does not provide financial advice.',
    primaryOption: { label: 'Policy or Renewal', text: 'Share policy type, renewal date, and contact number. An advisor will explain options; this is not financial advice.', collect: true },
    secondaryOption: { label: 'Claim Support', text: 'Share policy number, claim type, and preferred callback time. Claim eligibility is subject to insurer review.', collect: true },
    supportText: 'Connecting you to a licensed advisor or support team.',
    farewell: 'Thank you. Our team will contact you shortly.',
    contentPolicy: {
      requiresHumanReviewForSensitiveTopics: true,
      outboundApprovalRequiredCategories: ['marketing'],
      prohibitedClaims: ['guaranteed returns', 'financial advice', 'guaranteed claim approval'],
    },
  }),
  createBusinessTemplate({
    id: 'automotive_service',
    name: 'Automotive Service',
    emoji: '🚗',
    industries: ['Automotive'],
    tags: ['service booking', 'repair', 'pickup'],
    description: 'Collect vehicle service details and route repair estimates.',
    trigger: 'car service',
    menuText: 'Welcome. Reply 1 to book vehicle service, 2 for repair estimate or pickup/drop, or type support to talk to an advisor.',
    primaryOption: { label: 'Book Service', text: 'Share vehicle model, registration number, preferred date, and service type. Our advisor will confirm the slot.', collect: true },
    secondaryOption: { label: 'Repair Estimate', text: 'Share issue details and photos if available. Estimates are indicative until inspection.', collect: true },
    supportText: 'Connecting you to a service advisor.',
    farewell: 'Thank you. We will follow up soon.',
  }),
  createBusinessTemplate({
    id: 'general_business',
    name: 'General Business',
    emoji: '🏢',
    industries: ['General'],
    tags: ['services', 'pricing', 'support'],
    description: 'A flexible starter flow for service businesses.',
    trigger: 'hi',
    menuText: 'Welcome. Reply 1 for services, 2 for pricing or enquiry, or type support to talk to our team.',
    primaryOption: { label: 'Services', text: 'Add your core services here. Keep this copy clear and update it for your business.' },
    secondaryOption: { label: 'Pricing or Enquiry', text: 'Share what you need, your timeline, and contact details. Our team will respond with next steps.', collect: true },
    supportText: 'Connecting you to our team.',
    farewell: 'Thank you for contacting us.',
  }),
]
