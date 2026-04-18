import { describe, expect, it } from 'vitest'
import { graphToSimple, simpleToGraph } from '@/lib/simpleFlowAdapter'
import type { SimpleFlow } from '@/types/simpleFlow'

describe('simple flow adapter', () => {
  it('saves each reply button as its own conditional route', () => {
    const flow: SimpleFlow = {
      id: 'flow-1',
      name: 'Shop flow',
      status: 'draft',
      triggers: [
        { id: 'trigger-1', keywords: ['shirts', 'saree'], targetStepId: 'welcome' },
      ],
      steps: [
        {
          id: 'welcome',
          type: 'question',
          mode: 'button_choices',
          text: 'What do you want?',
          buttons: [
            { id: 'buyer-btn', title: 'Buyer', nextStepId: 'buyer-reply' },
            { id: 'investor-btn', title: 'Investor', nextStepId: 'investor-reply' },
          ],
        },
        { id: 'buyer-reply', type: 'message', text: 'Buyer path' },
        { id: 'investor-reply', type: 'message', text: 'Investor path' },
      ],
    }

    const graph = simpleToGraph(flow, 'owner-1', [])
    const buttonEdges = graph.edges.filter(edge => edge.source_node_id === 'welcome')

    expect(buttonEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target_node_id: 'buyer-reply',
        condition_type: 'equals',
        condition_value: 'Buyer',
      }),
      expect.objectContaining({
        target_node_id: 'investor-reply',
        condition_type: 'equals',
        condition_value: 'Investor',
      }),
    ]))
    expect(graph.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ trigger_value: 'shirts', target_node_id: 'welcome' }),
      expect.objectContaining({ trigger_value: 'saree', target_node_id: 'welcome' }),
    ]))
  })

  it('saves four choice questions without dropping list menu options', () => {
    const flow: SimpleFlow = {
      id: 'flow-1',
      name: 'Real estate lead',
      status: 'draft',
      triggers: [
        { id: 'trigger-1', keywords: ['property'], targetStepId: 'menu' },
      ],
      steps: [
        {
          id: 'menu',
          type: 'question',
          mode: 'button_choices',
          text: 'What are you looking for?',
          buttons: [
            { id: 'buy', title: 'Buy Flat', nextStepId: 'capture' },
            { id: 'projects', title: 'Projects', nextStepId: 'capture' },
            { id: 'visit', title: 'Site Visit', nextStepId: 'capture' },
            { id: 'price', title: 'Price Details', nextStepId: 'capture' },
          ],
        },
        { id: 'capture', type: 'question', mode: 'open_text', text: 'Please share budget and location.', nextStepId: 'done' },
        { id: 'done', type: 'end', text: 'Thank you. Our team will contact you shortly.' },
      ],
    }

    const graph = simpleToGraph(flow, 'owner-1', [])
    const menuNode = graph.nodes.find(node => node.id === 'menu')!
    const menuEdges = graph.edges.filter(edge => edge.source_node_id === 'menu')

    expect(menuNode.config.buttons).toHaveLength(4)
    expect(menuNode.config.list_button_text).toBe('Choose option')
    expect(menuEdges.map(edge => edge.condition_value)).toEqual([
      'Buy Flat',
      'Projects',
      'Site Visit',
      'Price Details',
    ])
    expect(graph.nodes.find(node => node.id === 'done')).toMatchObject({
      node_type: 'end',
      config: { farewell_message: 'Thank you. Our team will contact you shortly.' },
    })
  })

  it('loads explicit end nodes as simple end steps', () => {
    const simple = graphToSimple(
      { id: 'flow-1', name: 'Loaded', status: 'draft' },
      [
        { id: 'start', flow_id: 'flow-1', owner_id: 'owner-1', node_type: 'start', label: 'Start', config: {}, position_x: 0, position_y: 0, created_at: '', updated_at: '' },
        { id: 'msg', flow_id: 'flow-1', owner_id: 'owner-1', node_type: 'message', label: 'Msg', config: { text: 'Hi' }, position_x: 100, position_y: 100, created_at: '', updated_at: '' },
        { id: 'end', flow_id: 'flow-1', owner_id: 'owner-1', node_type: 'end', label: 'End', config: { farewell_message: 'Done' }, position_x: 400, position_y: 100, created_at: '', updated_at: '' },
      ],
      [
        { id: 'e1', flow_id: 'flow-1', owner_id: 'owner-1', source_node_id: 'start', target_node_id: 'msg', condition_type: 'always', condition_value: null, condition_variable: null, condition_expression: null, is_fallback: false, priority: 0, label: null, created_at: '' },
        { id: 'e2', flow_id: 'flow-1', owner_id: 'owner-1', source_node_id: 'msg', target_node_id: 'end', condition_type: 'always', condition_value: null, condition_variable: null, condition_expression: null, is_fallback: false, priority: 0, label: null, created_at: '' },
      ],
      [],
    )

    expect(simple.steps.map(step => step.type)).toEqual(['message', 'end'])
    expect(simple.steps[1].text).toBe('Done')
  })
})
