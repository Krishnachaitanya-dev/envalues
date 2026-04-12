import { supabase } from '@/integrations/supabase/client'
import { flowTemplateSchema } from '../domain/template.schemas'
import type { FlowTemplate, FlowTemplateCatalogRow } from '../domain/template.types'

export async function getFlowTemplates(): Promise<FlowTemplate[]> {
  const { data, error } = await (supabase.from('flow_template_catalog') as any)
    .select('id, version, name, description, industries, tags, status, template')
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (error) throw error

  return ((data ?? []) as FlowTemplateCatalogRow[])
    .map((row) => flowTemplateSchema.parse(row.template))
    .filter((template) => template.status === 'active')
}

export async function getFlowTemplateById(id: string, version?: number): Promise<FlowTemplate | null> {
  let query = (supabase.from('flow_template_catalog') as any)
    .select('id, version, name, description, industries, tags, status, template')
    .eq('id', id)
    .eq('status', 'active')

  if (version != null) query = query.eq('version', version)

  const { data, error } = await query.order('version', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!data) return null

  return flowTemplateSchema.parse((data as FlowTemplateCatalogRow).template)
}
