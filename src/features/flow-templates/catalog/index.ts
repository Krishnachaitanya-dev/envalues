import { STOCK_FLOW_TEMPLATES } from './stockTemplates'
import { assertValidTemplate } from '../domain/validateTemplateGraph'

const seen = new Set<string>()

export const stockFlowTemplates = STOCK_FLOW_TEMPLATES.map((template) => {
  const key = `${template.id}@${template.version}`
  if (seen.has(key)) throw new Error(`Duplicate stock template ${key}`)
  seen.add(key)
  return assertValidTemplate(template)
})

export function getStockTemplateById(id: string, version?: number) {
  return stockFlowTemplates.find(template => template.id === id && (version == null || template.version === version)) ?? null
}
