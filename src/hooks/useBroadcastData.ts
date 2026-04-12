import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'

export type BroadcastTemplate = {
  id: string
  owner_id: string
  template_name: string
  display_name: string
  language_code: string
  body_preview: string
  parameter_count: number
  category: 'marketing' | 'utility' | 'authentication'
  is_active: boolean
  created_at: string
}

export type BroadcastCampaign = {
  id: string
  owner_id: string
  template_id: string
  template_name: string
  display_name: string
  template_params: string[] | null
  status: 'draft' | 'processing' | 'completed' | 'failed' | 'partial'
  recipient_source: 'contacts' | 'manual'
  chatbot_id: string | null
  total_count: number
  sent_count: number
  failed_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export const templateSchema = z.object({
  template_name: z
    .string()
    .min(1, 'Template name is required')
    .max(512, 'Name too long')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, digits and underscores'),
  display_name: z.string().min(1, 'Display name is required').max(100, 'Too long'),
  language_code: z.string().min(2, 'Language code required').max(10),
  body_preview: z.string().max(1024, 'Body preview too long'),
  parameter_count: z.number().int().min(0).max(20),
  category: z.enum(['marketing', 'utility', 'authentication']),
})

export const campaignSchema = z.object({
  template_id: z.string().uuid('Select a template'),
  recipient_source: z.enum(['contacts', 'manual']),
  manual_phones: z.string().optional(),
  template_params: z.array(z.string()).optional(),
})

export function useBroadcastData(ownerId: string | null, chatbotId: string | null) {
  const { toast } = useToast()

  const [templates, setTemplates] = useState<BroadcastTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [saving, setSaving] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    if (!ownerId) { setLoadingTemplates(false); return }
    setLoadingTemplates(true)
    try {
      const { data, error } = await (supabase.from('broadcast_templates') as any)
        .select('*')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      setTemplates(data ?? [])
    } catch (e: any) {
      console.error('Failed to load templates:', e)
    } finally {
      setLoadingTemplates(false)
    }
  }, [ownerId])

  const loadCampaigns = useCallback(async () => {
    if (!ownerId) { setLoadingCampaigns(false); return }
    setLoadingCampaigns(true)
    try {
      const { data, error } = await (supabase.from('broadcast_campaigns') as any)
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setCampaigns(data ?? [])
    } catch (e: any) {
      console.error('Failed to load campaigns:', e)
    } finally {
      setLoadingCampaigns(false)
    }
  }, [ownerId])

  useEffect(() => { loadTemplates() }, [loadTemplates])
  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  const addTemplate = useCallback(async (form: z.infer<typeof templateSchema>): Promise<boolean> => {
    if (!ownerId) return false
    setSaving(true)
    try {
      const validated = templateSchema.parse(form)
      const { data, error } = await (supabase.from('broadcast_templates') as any)
        .insert([{ ...validated, owner_id: ownerId }])
        .select()
        .single()
      if (error) throw error
      setTemplates(prev => [data, ...prev])
      toast({ title: 'Template added!' })
      return true
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
      return false
    } finally {
      setSaving(false)
    }
  }, [ownerId, toast])

  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    try {
      const { error } = await (supabase.from('broadcast_templates') as any)
        .update({ is_active: false })
        .eq('id', templateId)
        .eq('owner_id', ownerId!)
      if (error) throw error
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      toast({ title: 'Template removed' })
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [ownerId, toast])

  const createCampaign = useCallback(async (form: z.infer<typeof campaignSchema>): Promise<BroadcastCampaign | null> => {
    if (!ownerId) return null
    setSaving(true)
    try {
      const validated = campaignSchema.parse(form)
      const template = templates.find(t => t.id === validated.template_id)
      if (!template) throw new Error('Template not found')

      let manualPhones: string[] = []
      if (validated.recipient_source === 'manual' && validated.manual_phones) {
        manualPhones = validated.manual_phones
          .split(/[\n,]+/)
          .map(p => p.trim().replace(/\s/g, ''))
          .filter(p => p.length >= 7)
      }

      if (validated.recipient_source === 'manual' && manualPhones.length === 0) {
        toast({ title: 'No valid phone numbers entered', variant: 'destructive' })
        return null
      }

      const { data: campaign, error } = await (supabase.from('broadcast_campaigns') as any)
        .insert([{
          owner_id: ownerId,
          template_id: validated.template_id,
          template_name: template.template_name,
          display_name: template.display_name,
          template_params: validated.template_params?.length ? validated.template_params : null,
          recipient_source: validated.recipient_source,
          chatbot_id: validated.recipient_source === 'contacts' ? chatbotId : null,
          status: 'draft',
        }])
        .select()
        .single()
      if (error) throw error

      if (validated.recipient_source === 'manual' && manualPhones.length > 0) {
        await (supabase.from('broadcast_recipients') as any).insert(
          [...new Set(manualPhones)].map(phone => ({ campaign_id: campaign.id, owner_id: ownerId, phone, status: 'pending' }))
        )
      }

      setCampaigns(prev => [campaign, ...prev])
      toast({ title: 'Campaign created!' })
      return campaign
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
      return null
    } finally {
      setSaving(false)
    }
  }, [ownerId, chatbotId, templates, toast])

  const launchCampaign = useCallback(async (campaignId: string): Promise<boolean> => {
    setLaunching(campaignId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      // Optimistically mark as processing
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'processing' } : c))

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-broadcast`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ campaign_id: campaignId }),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Broadcast failed')

      setCampaigns(prev => prev.map(c =>
        c.id === campaignId
          ? { ...c, status: result.status, sent_count: result.sent, failed_count: result.failed }
          : c
      ))

      toast({
        title: result.status === 'completed' ? 'Broadcast complete!' : 'Broadcast finished with errors',
        description: `Sent: ${result.sent}  ·  Failed: ${result.failed}`,
        variant: result.status === 'failed' ? 'destructive' : 'default',
      })
      return true
    } catch (err: any) {
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'failed' } : c))
      toast({ title: 'Launch failed', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setLaunching(null)
    }
  }, [toast])

  return {
    templates, loadingTemplates, addTemplate, deleteTemplate, refreshTemplates: loadTemplates,
    campaigns, loadingCampaigns, createCampaign, launchCampaign, refreshCampaigns: loadCampaigns,
    saving, launching,
  }
}
