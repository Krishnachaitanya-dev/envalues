import { z } from 'zod'

const nodeTypeSchema = z.enum([
  'start',
  'message',
  'input',
  'condition',
  'api',
  'delay',
  'jump',
  'subflow',
  'handoff',
  'end',
])

const conditionTypeSchema = z.enum([
  'always',
  'equals',
  'contains',
  'starts_with',
  'regex',
  'variable_equals',
  'variable_contains',
])

const triggerTypeSchema = z.enum(['keyword', 'restart', 'default', 'api'])

export const templateContentCategorySchema = z.enum(['utility', 'marketing', 'support'])

export const templateTriggerSchema = z.object({
  id: z.string().min(1),
  type: triggerTypeSchema,
  value: z.string().trim().min(1).nullable(),
  matchMode: z.literal('normalized_exact'),
  priority: z.number().int().min(0),
})

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
})

const attachmentSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['image', 'video', 'document']),
  url: z.string().min(1),
  caption: z.string().optional(),
  storage_path: z.string().optional(),
  source: z.enum(['upload', 'url']).optional(),
})

const linkSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1),
  label: z.string().optional(),
})

const validationSchema = z.object({
  type: z.enum(['regex', 'length', 'required']),
  value: z.string(),
  error_message: z.string().min(1),
})

const nodeDataSchemas = {
  start: z.object({ greeting_message: z.string().optional() }).passthrough(),
  message: z.object({
    text: z.string().min(1),
    attachments: z.array(attachmentSchema).optional(),
    links: z.array(linkSchema).optional(),
  }).passthrough(),
  input: z.object({
    prompt: z.string().min(1),
    store_as: z.string().regex(/^[a-z][a-z0-9_]*$/),
    timeout_secs: z.number().int().min(0),
    validation: validationSchema.optional(),
  }).passthrough(),
  condition: z.object({}).passthrough(),
  handoff: z.object({
    department: z.string().min(1),
    message: z.string().min(1),
    allow_resume: z.boolean(),
    resume_node_id: z.string().nullable().optional(),
    queue_strategy: z.string().min(1),
    handoff_timeout_hours: z.number().int().min(1),
  }).passthrough(),
  end: z.object({ farewell_message: z.string().optional() }).passthrough(),
  api: z.object({
    method: z.enum(['GET', 'POST', 'PUT']),
    url: z.string().min(1),
    headers: z.record(z.string()),
    body_template: z.string(),
    response_variable: z.string().regex(/^[a-z][a-z0-9_]*$/),
    timeout_secs: z.number().int().min(1),
    retry_count: z.number().int().min(0),
  }).passthrough(),
  delay: z.object({ delay_secs: z.number().int().min(0) }).passthrough(),
  jump: z.object({
    target_flow_id: z.string().nullable().optional(),
    target_node_id: z.string().min(1),
  }).passthrough(),
  subflow: z.object({
    subflow_id: z.string().min(1),
    return_mode: z.enum(['auto', 'manual']),
  }).passthrough(),
} as const

export const templateNodeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  type: nodeTypeSchema,
  label: z.string().min(1),
  position: positionSchema,
  data: z.record(z.unknown()),
  messageMeta: z.object({
    category: templateContentCategorySchema,
    outboundApprovalRequired: z.boolean(),
    editable: z.boolean(),
    variablesCreated: z.array(z.string()).optional(),
  }).optional(),
}).superRefine((node, ctx) => {
  const result = nodeDataSchemas[node.type].safeParse(node.data)
  if (!result.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid ${node.type} node config: ${result.error.issues.map(issue => issue.message).join(', ')}`,
      path: ['data'],
    })
  }
})

export const templateEdgeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  source: z.string().min(1),
  target: z.string().min(1),
  condition: z.object({
    type: conditionTypeSchema,
    value: z.string().nullable(),
    variable: z.string().nullable(),
    label: z.string().nullable(),
    isFallback: z.boolean(),
    priority: z.number().int().min(0),
    allowedCycle: z.enum(['restart_to_start', 'return_to_menu']).optional(),
  }),
})

export const flowTemplateSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().min(1),
  industries: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)),
  emoji: z.string().min(1),
  status: z.enum(['active', 'draft', 'deprecated']),
  featured: z.boolean(),
  contentPolicy: z.object({
    requiresHumanReviewForSensitiveTopics: z.boolean(),
    outboundApprovalRequiredCategories: z.array(templateContentCategorySchema),
    prohibitedClaims: z.array(z.string()),
  }),
  triggers: z.array(templateTriggerSchema).min(1),
  nodes: z.array(templateNodeSchema).min(2),
  edges: z.array(templateEdgeSchema),
})
