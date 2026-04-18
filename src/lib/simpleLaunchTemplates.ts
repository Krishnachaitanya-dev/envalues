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

function end(text = 'Thank you. Our team will contact you shortly.', x = 1320, y = 260): SimpleStep {
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

function connectByTitle(step: SimpleStep, routes: Record<string, string>): SimpleStep {
  return {
    ...step,
    buttons: step.buttons?.map(button => ({ ...button, nextStepId: routes[button.title] ?? null })),
  }
}

function buildBusinessStarter(): Pick<SimpleFlow, 'steps' | 'triggers'> {
  const welcome = question('Welcome. Please choose an option:', ['New Customer', 'Existing Customer'], 220, 200)

  const newCustomer = question('Thanks for contacting us. What are you looking for?', [
    'Product Details',
    'Pricing',
    'Book Visit',
    'Call Back',
  ], 560, 60)
  const existingCustomer = question('Welcome back. How can we help?', [
    'Payment Query',
    'Order Update',
    'Support Issue',
    'Talk to Team',
  ], 560, 340)

  const appointment = question('Would you like to book a visit or appointment?', ['Yes', 'Need More Info'], 900, 60)
  const leadCapture = stepBase('question', 'Please share your name, phone number, requirement, and preferred budget or timeline.', 900, 220)
  const supportCapture = stepBase('question', 'Please share your name, reference/order/project details, and issue.', 900, 420)

  const appointmentCapture = stepBase('question', 'Please share your name, preferred date, preferred time, and requirement.', 1160, 60)
  const infoMenu = question('What information do you need?', ['Pricing', 'Location', 'Services', 'Call Back'], 1160, 220)
  const done = end('Thank you. Our team will contact you shortly.', 1440, 260)

  return {
    steps: [
      connectByTitle(welcome, {
        'New Customer': newCustomer.id,
        'Existing Customer': existingCustomer.id,
      }),
      connectAll(newCustomer, leadCapture.id),
      connectAll(existingCustomer, supportCapture.id),
      connectByTitle(appointment, {
        Yes: appointmentCapture.id,
        'Need More Info': infoMenu.id,
      }),
      { ...leadCapture, nextStepId: done.id },
      { ...supportCapture, nextStepId: done.id },
      { ...appointmentCapture, nextStepId: done.id },
      connectAll(infoMenu, done.id),
      done,
    ],
    triggers: [
      trigger(['hi', 'hello', 'start'], welcome.id),
      trigger(['sales', 'price', 'pricing', 'lead'], newCustomer.id),
      trigger(['appointment', 'visit', 'booking'], appointment.id),
      trigger(['support', 'help'], existingCustomer.id),
    ],
  }
}

export const simpleLaunchTemplates: SimpleLaunchTemplate[] = [
  {
    id: 'business-starter',
    name: 'Business Starter Conversation',
    description: 'One canvas with sales, appointment, ad-lead, and support entry paths.',
    keywords: ['hi', 'sales', 'appointment', 'support'],
    build: buildBusinessStarter,
  },
]
