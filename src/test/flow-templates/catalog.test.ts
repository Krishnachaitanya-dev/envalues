import { describe, expect, it } from 'vitest'
import { stockFlowTemplates } from '@/features/flow-templates/catalog'
import { validateTemplateGraph } from '@/features/flow-templates/domain/validateTemplateGraph'
import { normalizeTemplateTrigger } from '@/features/flow-templates/domain/normalizeTrigger'
import type { FlowTemplate } from '@/features/flow-templates/domain/template.types'

describe('stock flow templates', () => {
  it('exports the expected production starter catalog', () => {
    expect(stockFlowTemplates).toHaveLength(12)
    expect(stockFlowTemplates.map(template => template.id)).toContain('clinic_doctor_appointment')
    expect(stockFlowTemplates.map(template => template.id)).toContain('general_business')
  })

  it('validates every stock template graph', () => {
    for (const template of stockFlowTemplates) {
      expect(validateTemplateGraph(template)).toEqual([])
      expect(template.nodes.filter(node => node.type === 'start')).toHaveLength(1)
      expect(template.nodes.some(node => node.type === 'handoff')).toBe(true)
      expect(template.nodes.some(node => node.type === 'end')).toBe(true)
    }
  })

  it('ensures template edges reference existing nodes', () => {
    for (const template of stockFlowTemplates) {
      const nodeIds = new Set(template.nodes.map(node => node.id))
      for (const edge of template.edges) {
        expect(nodeIds.has(edge.source)).toBe(true)
        expect(nodeIds.has(edge.target)).toBe(true)
      }
    }
  })

  it('ensures triggers normalize uniquely inside each template', () => {
    for (const template of stockFlowTemplates) {
      const keys = template.triggers
        .filter(trigger => trigger.type !== 'default')
        .map(trigger => `${trigger.type}:${normalizeTemplateTrigger(trigger.value)}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('rejects invalid template fixtures', () => {
    const base = stockFlowTemplates[0]
    const duplicateStart: FlowTemplate = {
      ...base,
      nodes: [...base.nodes, { ...base.nodes[0], id: 'start_two' }],
    }
    const orphanNode: FlowTemplate = {
      ...base,
      nodes: [...base.nodes, { ...base.nodes[1], id: 'orphan', position: { x: 999, y: 999 } }],
    }
    const duplicateTrigger: FlowTemplate = {
      ...base,
      triggers: [...base.triggers, { ...base.triggers[0], id: 'duplicate', value: ` ${base.triggers[0].value?.toUpperCase()} ` }],
    }
    const badCycle: FlowTemplate = {
      ...base,
      edges: [...base.edges, {
        id: 'edge_end_menu',
        source: 'end',
        target: 'menu',
        condition: { type: 'always', value: null, variable: null, label: null, isFallback: false, priority: 0 },
      }],
    }

    expect(validateTemplateGraph(duplicateStart).some(issue => issue.includes('exactly one start'))).toBe(true)
    expect(validateTemplateGraph(orphanNode).some(issue => issue.includes('not reachable'))).toBe(true)
    expect(validateTemplateGraph(duplicateTrigger).some(issue => issue.includes('Duplicate trigger'))).toBe(true)
    expect(validateTemplateGraph(badCycle).some(issue => issue.includes('Disallowed cycle'))).toBe(true)
  })
})
