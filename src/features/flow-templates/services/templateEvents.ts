import { supabase } from '@/integrations/supabase/client'

type TemplateEventAction =
  | 'flow_template_picker_opened'
  | 'flow_template_preview_viewed'
  | 'flow_template_apply_started'
  | 'flow_template_apply_succeeded'
  | 'flow_template_apply_failed'
  | 'flow_template_apply_replayed'

export async function trackTemplateEvent(
  ownerId: string | null,
  action: TemplateEventAction,
  metadata: Record<string, unknown> = {},
) {
  if (!ownerId) return
  try {
    await (supabase.from('audit_logs') as any).insert({
      owner_id: ownerId,
      action,
      resource_type: 'flow_template',
      resource_id: null,
      metadata,
    })
  } catch {
    // Analytics must never block builder interactions.
  }
}
