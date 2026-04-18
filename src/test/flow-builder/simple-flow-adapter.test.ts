import { describe, expect, it } from 'vitest'
import { simpleToGraph } from '@/lib/simpleFlowAdapter'
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
})
