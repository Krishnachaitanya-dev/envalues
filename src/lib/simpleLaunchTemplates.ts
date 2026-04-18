import type { SimpleFlow, SimpleStep, SimpleTrigger } from '@/types/simpleFlow'

export interface SimpleLaunchTemplate {
  id: string
  name: string
  description: string
  keywords: string[]
  build: () => Pick<SimpleFlow, 'steps' | 'triggers'>
}

function stepBase(type: SimpleStep['type'], text: string, x: number, y: number): SimpleStep {
  return {
    id: crypto.randomUUID(),
    type,
    mode: type === 'question' ? 'open_text' : undefined,
    text,
    position: { x, y },
  }
}

function question(text: string, choices: string[], x: number, y: number): SimpleStep {
  return {
    ...stepBase('question', text, x, y),
    mode: choices.length > 0 ? 'button_choices' : 'open_text',
    buttons: choices.length > 0
      ? choices.map(title => ({ id: crypto.randomUUID(), title, nextStepId: null }))
      : undefined,
  }
}

function end(text = 'Thank you. Our team will contact you shortly.', x = 980, y = 160): SimpleStep {
  return stepBase('end', text, x, y)
}

function trigger(keywords: string[], targetStepId: string): SimpleTrigger {
  return {
    id: crypto.randomUUID(),
    keywords,
    targetStepId,
  }
}

function connectAll(step: SimpleStep, targetId: string): SimpleStep {
  if (!step.buttons?.length) return { ...step, nextStepId: targetId }
  return {
    ...step,
    buttons: step.buttons.map(button => ({ ...button, nextStepId: targetId })),
  }
}

function buildRealEstateMain(): Pick<SimpleFlow, 'steps' | 'triggers'> {
  const welcome = question('Welcome to Radha Govind Homes.\n\nPlease choose an option:', ['New Customer', 'Existing Customer'], 220, 120)
  const newMenu = question('Thank you for choosing us.\n\nWhat are you looking for?', ['Buy Flat', 'Ongoing Projects', 'Site Visit', 'Price Details'], 560, 20)
  const existingMenu = question('Welcome back.\n\nHow may we help you?', ['Payment Query', 'Project Update', 'Support', 'Talk to Team'], 560, 260)
  const newCapture = stepBase('question', 'Please share your preferred location and budget.\n\nExample: Patia, 80 Lakhs', 900, 20)
  const existingCapture = stepBase('question', 'Please share your Name + Project Name + Flat Number.', 900, 260)
  const done = end('Thank you. Our team will contact you shortly.', 1240, 140)

  welcome.buttons = welcome.buttons?.map(button => ({
    ...button,
    nextStepId: button.title === 'New Customer' ? newMenu.id : existingMenu.id,
  }))

  return {
    steps: [
      welcome,
      connectAll(newMenu, newCapture.id),
      connectAll(existingMenu, existingCapture.id),
      { ...newCapture, nextStepId: done.id },
      { ...existingCapture, nextStepId: done.id },
      done,
    ],
    triggers: [trigger(['hi', 'hello', 'property'], welcome.id)],
  }
}

function buildSiteVisit(): Pick<SimpleFlow, 'steps' | 'triggers'> {
  const start = question('Welcome to Radha Govind Homes.\n\nWould you like to schedule a site visit?', ['Yes', 'Need More Info'], 220, 120)
  const visitCapture = stepBase('question', 'Please share:\n\nName\nProject Name\nPreferred Date\nPreferred Time', 560, 20)
  const info = question('Please choose what you need:', ['Price', 'Location', 'Amenities', 'Call Back'], 560, 260)
  const done = end('Thank you. Your request has been received. Our team will confirm shortly.', 900, 140)

  start.buttons = start.buttons?.map(button => ({
    ...button,
    nextStepId: button.title === 'Yes' ? visitCapture.id : info.id,
  }))

  return {
    steps: [
      start,
      { ...visitCapture, nextStepId: done.id },
      connectAll(info, done.id),
      done,
    ],
    triggers: [trigger(['site visit', 'visit'], start.id)],
  }
}

function buildMetaLead(): Pick<SimpleFlow, 'steps' | 'triggers'> {
  const menu = question('Thank you for contacting Radha Govind Homes.\n\nPlease choose:', ['Price Details', 'Ongoing Projects', 'Site Visit', 'Call Back'], 220, 120)
  const capture = stepBase('question', 'Please share your budget, preferred location, and name.\n\nExample: 70 Lakhs, BJB Nagar, Rahul', 560, 120)
  const done = end('Thank you. Our property expert will contact you shortly.', 900, 120)

  return {
    steps: [connectAll(menu, capture.id), { ...capture, nextStepId: done.id }, done],
    triggers: [trigger(['price', 'projects', 'callback'], menu.id)],
  }
}

function buildSupport(): Pick<SimpleFlow, 'steps' | 'triggers'> {
  const menu = question('Welcome back.\n\nSupport Options:', ['Payment Receipt', 'Construction Update', 'Complaint', 'Talk to Support'], 220, 120)
  const capture = stepBase('question', 'Please share:\n\nName + Project Name + Flat Number', 560, 120)
  const done = end('Thank you. Our support team will contact you shortly.', 900, 120)

  return {
    steps: [connectAll(menu, capture.id), { ...capture, nextStepId: done.id }, done],
    triggers: [trigger(['support', 'help'], menu.id)],
  }
}

export const simpleLaunchTemplates: SimpleLaunchTemplate[] = [
  {
    id: 'real-estate-main',
    name: 'Real Estate Main Flow',
    description: 'New/existing customer menu with lead capture.',
    keywords: ['hi', 'hello', 'property'],
    build: buildRealEstateMain,
  },
  {
    id: 'site-visit',
    name: 'Site Visit Flow',
    description: 'Visit booking and information requests.',
    keywords: ['site visit', 'visit'],
    build: buildSiteVisit,
  },
  {
    id: 'meta-ads-lead',
    name: 'Meta Ads Lead Flow',
    description: 'Price, projects, site visit, and callback lead capture.',
    keywords: ['price', 'projects', 'callback'],
    build: buildMetaLead,
  },
  {
    id: 'support',
    name: 'Support Flow',
    description: 'Simple support menu with project and flat details.',
    keywords: ['support', 'help'],
    build: buildSupport,
  },
]
