import { supabase } from '@/integrations/supabase/client'
import { FlowTemplateError, type InstantiateTemplateResult, type TemplateErrorCode } from '../domain/template.types'

type RpcSuccess = {
  ok: true
  flow: Record<string, unknown>
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  triggers: Record<string, unknown>[]
  replayed?: boolean
}

type RpcFailure = {
  ok: false
  code: TemplateErrorCode
  message: string
}

type RpcResponse = RpcSuccess | RpcFailure

export async function applyFlowTemplate(params: {
  templateId: string
  templateVersion: number
  requestId: string
  flowName?: string | null
}): Promise<InstantiateTemplateResult> {
  const { data, error } = await (supabase as any).rpc('instantiate_flow_template', {
    p_template_id: params.templateId,
    p_template_version: params.templateVersion,
    p_request_id: params.requestId,
    p_flow_name: params.flowName ?? null,
  })

  if (error) {
    throw new FlowTemplateError('UNKNOWN', error.message ?? 'Template application failed')
  }

  const response = data as RpcResponse
  if (!response?.ok) {
    throw new FlowTemplateError(response?.code ?? 'UNKNOWN', response?.message ?? 'Template application failed')
  }

  return {
    flow: response.flow,
    nodes: response.nodes ?? [],
    edges: response.edges ?? [],
    triggers: response.triggers ?? [],
    replayed: response.replayed,
  }
}

export function templateErrorMessage(error: unknown) {
  if (!(error instanceof FlowTemplateError)) return 'Template could not be applied. Please try again.'

  const messages: Record<TemplateErrorCode, string> = {
    TEMPLATE_NOT_FOUND: 'This template is unavailable or has been deprecated.',
    TEMPLATE_INVALID: 'This template is invalid. Please choose another template or contact support.',
    TRIGGER_CONFLICT: "One of this template's keywords is already active in another flow. Disable the conflicting trigger and try again.",
    PERMISSION_DENIED: 'You do not have permission to create flows for this workspace.',
    IDEMPOTENCY_CONFLICT: 'This template is already being applied. Please wait a moment and refresh.',
    DB_WRITE_FAILED: 'The template could not be saved. No partial flow was created.',
    UNKNOWN: 'Template could not be applied. Please try again.',
  }

  return messages[error.code] ?? error.message
}
