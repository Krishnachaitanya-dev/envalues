import { describe, expect, it } from 'vitest'
import {
  appendSimpleFlowCopy,
  cloneSimpleFlowCopy,
  createSimpleFlowCopyText,
  createSimpleFlowShareUrl,
  parseSimpleFlowCopyText,
} from '@/lib/simpleFlowCopy'
import type { SimpleFlow } from '@/types/simpleFlow'

function sampleFlow(): SimpleFlow {
  return {
    id: 'source-flow',
    name: 'Salon Booking',
    status: 'published',
    steps: [
      {
        id: 'welcome',
        type: 'question',
        mode: 'button_choices',
        text: 'Welcome. Choose service.',
        buttons: [
          { id: 'haircut', title: 'Haircut', nextStepId: 'capture' },
          { id: 'spa', title: 'Spa', nextStepId: 'done' },
        ],
        position: { x: 100, y: 100 },
      },
      {
        id: 'capture',
        type: 'question',
        mode: 'open_text',
        text: 'Please share name and time.',
        nextStepId: 'done',
        attachments: [
          {
            id: 'logo',
            type: 'image',
            source: 'url',
            url: 'https://example.com/logo.png',
          },
        ],
        position: { x: 420, y: 100 },
      },
      {
        id: 'done',
        type: 'end',
        text: 'Thank you. Team will contact you shortly.',
        position: { x: 740, y: 100 },
      },
    ],
    triggers: [
      { id: 'trigger-1', keywords: ['hi', 'booking'], targetStepId: 'welcome' },
    ],
  }
}

describe('simple flow copy', () => {
  it('exports and parses portable flow copy JSON without publishing state', () => {
    const text = createSimpleFlowCopyText(sampleFlow())
    const parsed = parseSimpleFlowCopyText(text)

    expect(parsed.name).toBe('Salon Booking')
    expect(parsed.steps).toHaveLength(3)
    expect(parsed.triggers[0].keywords).toEqual(['hi', 'booking'])
    expect(text).not.toContain('"status": "published"')
    expect(text).not.toContain('"id": "source-flow"')
  })

  it('clones ids and keeps routing intact as a draft', () => {
    const parsed = parseSimpleFlowCopyText(createSimpleFlowCopyText(sampleFlow()))
    const cloned = cloneSimpleFlowCopy(parsed, 'new-flow', 'Imported Salon')

    expect(cloned.id).toBe('new-flow')
    expect(cloned.name).toBe('Imported Salon')
    expect(cloned.status).toBe('draft')
    expect(cloned.steps.map(step => step.id)).not.toContain('welcome')
    expect(cloned.steps.map(step => step.id)).not.toContain('capture')
    expect(cloned.steps.map(step => step.id)).not.toContain('done')

    const welcome = cloned.steps.find(step => step.text.startsWith('Welcome'))!
    const capture = cloned.steps.find(step => step.text.startsWith('Please share'))!
    const done = cloned.steps.find(step => step.type === 'end')!

    expect(welcome.buttons?.find(button => button.title === 'Haircut')?.nextStepId).toBe(capture.id)
    expect(welcome.buttons?.find(button => button.title === 'Spa')?.nextStepId).toBe(done.id)
    expect(capture.nextStepId).toBe(done.id)
    expect(cloned.triggers[0].targetStepId).toBe(welcome.id)
    expect(capture.attachments?.[0].id).not.toBe('logo')
    expect(capture.attachments?.[0].url).toBe('https://example.com/logo.png')
  })

  it('creates share URLs that can be parsed back on another device', () => {
    const shareUrl = createSimpleFlowShareUrl(sampleFlow(), 'https://app.example.com/dashboard/builder')
    const parsed = parseSimpleFlowCopyText(shareUrl)

    expect(shareUrl).toContain('/dashboard/builder?flow_copy=')
    expect(parsed.name).toBe('Salon Booking')
    expect(parsed.steps).toHaveLength(3)
  })

  it('appends a copied flow into an existing canvas with copied triggers', () => {
    const target: SimpleFlow = {
      id: 'target-flow',
      name: 'Main Flow',
      status: 'draft',
      steps: [
        {
          id: 'main-step',
          type: 'message',
          text: 'Main welcome',
          position: { x: 100, y: 80 },
        },
      ],
      triggers: [
        { id: 'main-trigger', keywords: ['main'], targetStepId: 'main-step' },
      ],
    }
    const copied = parseSimpleFlowCopyText(createSimpleFlowCopyText(sampleFlow()))
    const merged = appendSimpleFlowCopy(target, copied)

    expect(merged.id).toBe('target-flow')
    expect(merged.steps).toHaveLength(4)
    expect(merged.triggers).toHaveLength(2)
    expect(merged.triggers[1].keywords).toEqual(['hi', 'booking'])
    expect(merged.triggers[1].targetStepId).not.toBe('welcome')
    expect(merged.steps.slice(1).every(step => (step.position?.x ?? 0) > 100)).toBe(true)
  })
})
