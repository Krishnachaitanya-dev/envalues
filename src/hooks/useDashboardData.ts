import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'

export const whatsappSchema = z.object({
  whatsapp_business_number: z.string().min(10, 'Phone number must be at least 10 digits').max(20, 'Phone number too long'),
  whatsapp_phone_number_id: z.string().min(10, 'Phone Number ID must be at least 10 digits').max(30, 'Phone Number ID too long'),
  whatsapp_api_token: z.string().min(1, 'Access token is required').max(500, 'Token too long'),
})

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

declare global { interface Window { Razorpay: any } }

export function useDashboardData() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [ownerData, setOwnerData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [whatsappForm, setWhatsappForm] = useState({ whatsapp_business_number: '', whatsapp_api_token: '', whatsapp_phone_number_id: '' })
  const [showToken, setShowToken] = useState(false)
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [flowSummary, setFlowSummary] = useState({ total: 0, published: 0, draft: 0 })

  // Enterprise / branding
  const [isEnterprise, setIsEnterprise] = useState(false)
  const [isEnterpriseClient, setIsEnterpriseClient] = useState(false)
  const [brand, setBrand] = useState<{ name: string; logoUrl: string; primaryColor: string } | null>(null)

  // Backward-compat state for pages replaced later in Phase 3.
  const [mainQuestionForm, setMainQuestionForm] = useState({ question_text: '', answer_text: '', media_url: '', media_type: '' })
  const [mainButtonOptions, setMainButtonOptions] = useState([{ id: Date.now(), button_text: '', answer: '' }])
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editQuestionForm, setEditQuestionForm] = useState({ question_text: '', answer_text: '', media_url: '', media_type: '' })

  useEffect(() => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.body.appendChild(s)
    return () => { document.body.removeChild(s) }
  }, [])

  useEffect(() => { checkUser() }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)
      const { data: od, error: oe } = await (supabase.from('owners') as any)
        .select('id, email, full_name, is_active, onboarding_completed, whatsapp_business_number, whatsapp_api_token, whatsapp_phone_number_id, created_at, updated_at, plan_type, enterprise_id, brand_name, brand_logo_url, brand_primary_color, max_clients, reception_phone')
        .eq('id', user.id)
        .single()
      if (oe) throw oe
      setOwnerData(od)
      setWhatsappForm({ whatsapp_business_number: od.whatsapp_business_number || '', whatsapp_api_token: od.whatsapp_api_token || '', whatsapp_phone_number_id: od.whatsapp_phone_number_id ?? '' })

      if (od.plan_type === 'enterprise') {
        setIsEnterprise(true)
        setBrand({ name: od.brand_name || 'My Platform', logoUrl: od.brand_logo_url || '', primaryColor: od.brand_primary_color || '#25D366' })
      } else if (od.enterprise_id) {
        setIsEnterpriseClient(true)
        const { data: ent } = await (supabase.from('owners') as any).select('brand_name, brand_logo_url, brand_primary_color').eq('id', od.enterprise_id).single()
        if (ent) setBrand({ name: ent.brand_name || 'My Platform', logoUrl: ent.brand_logo_url || '', primaryColor: ent.brand_primary_color || '#25D366' })
      }

      // Subscriptions are now keyed on owner_id after the flow engine migration.
      const { data: sd } = await supabase.from('subscriptions').select('*').eq('owner_id', user.id).maybeSingle()
      if (sd) setSubscription(sd)

      const { data: flowRows, error: flowError } = await (supabase.from('flows') as any)
        .select('id, status')
        .eq('owner_id', user.id)
        .neq('status', 'archived')
      if (flowError) {
        console.error('Flow summary error:', flowError)
      } else {
        const rows = flowRows ?? []
        setFlowSummary({
          total: rows.length,
          published: rows.filter((flow: { status?: string }) => flow.status === 'published').length,
          draft: rows.filter((flow: { status?: string }) => flow.status !== 'published').length,
        })
      }
    } catch (err: any) {
      console.error('Error:', err)
      if (err.message !== 'JSON object requested, multiple (or no) rows returned') navigate('/login')
    } finally { setLoading(false) }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login') }

  const handleWhatsappFormChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setWhatsappForm({ ...whatsappForm, [e.target.name]: e.target.value })

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingWhatsapp(true); setError(null)
    try {
      const validated = whatsappSchema.parse(whatsappForm)
      const { error } = await supabase.from('owners').update({
        whatsapp_business_number: validated.whatsapp_business_number,
        whatsapp_api_token: validated.whatsapp_api_token,
        whatsapp_phone_number_id: validated.whatsapp_phone_number_id,
      }).eq('id', user.id)
      if (error) throw error
      setOwnerData({ ...ownerData, ...whatsappForm })
      await supabase.from('audit_logs').insert({ owner_id: user.id, action: 'whatsapp_credentials_updated', resource_type: 'owner', resource_id: user.id, metadata: { whatsapp_business_number: validated.whatsapp_business_number } })
      toast({ title: 'WhatsApp configuration saved!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) { toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' }) }
      else { setError(err.message) }
    } finally { setSavingWhatsapp(false) }
  }

  const handleSaveReceptionPhone = async (phone: string) => {
    try {
      const cleaned = phone.trim().replace(/\D/g, '')
      const { error } = await supabase.from('owners').update({ reception_phone: cleaned || null }).eq('id', user.id)
      if (error) throw error
      setOwnerData((prev: any) => ({ ...prev, reception_phone: cleaned || null }))
      await supabase.from('audit_logs').insert({
        owner_id: user.id,
        action: 'reception_phone_updated',
        resource_type: 'owner',
        resource_id: user.id,
        metadata: { reception_phone: cleaned },
      })
      toast({ title: 'Reception number saved!' })
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' })
    }
  }

  const handleCancelSubscription = async (): Promise<{ success: boolean; error?: string }> => {
    if (!subscription?.id) return { success: false, error: 'No subscription found' }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ subscription_id: subscription.id }),
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Cancellation failed')
      setSubscription({ ...subscription, status: 'cancelled' })
      toast({ title: 'Subscription cancelled', description: 'Your plan will remain active until the end of your current billing period.' })
      return { success: true }
    } catch (err: any) {
      toast({ title: 'Cancellation failed', description: err.message, variant: 'destructive' })
      return { success: false, error: err.message }
    }
  }

  const formatAmount = (amountInPaise: number) => `Rs.${Math.round(amountInPaise / 100)}`
  const hasWhatsappCreds = !!(ownerData?.whatsapp_business_number?.trim() && ownerData?.whatsapp_api_token?.trim() && ownerData?.whatsapp_phone_number_id?.trim())

  const handleGoLive = async () => null
  const handleAddMainQuestion = async (e: React.FormEvent) => { e.preventDefault(); return false }
  const handleSaveQuestionEdit = async (e: React.FormEvent, _questionId?: string) => { e.preventDefault(); return false }
  const handleAddSubOptions = async (_parentId?: string, _options?: { button_text: string; answer: string }[]) => false
  const handleApplyTemplate = async (_template?: unknown) => false
  const getChildren = (_id: string) => [] as never[]

  return {
    user, ownerData, loading, error, setError,
    whatsappForm, showToken, setShowToken,
    savingWhatsapp,
    handleLogout, handleWhatsappFormChange, handleSaveWhatsapp, handleSaveReceptionPhone,
    subscription,
    handleGoLive, handleCancelSubscription, formatAmount,
    hasWhatsappCreds,
    flowSummary,
    hasAnyFlow: flowSummary.total > 0,
    hasPublishedFlow: flowSummary.published > 0,
    isEnterprise, isEnterpriseClient, brand,

    // Backward-compat stubs for pages replaced later in Phase 3.
    chatbot: null as null,
    qaPairs: [] as never[],
    rootQuestions: [] as never[],
    totalQuestions: 0,
    mainMenuCount: 0,
    subOptionCount: 0,
    isLive: false,
    hasMenuItems: false,
    readyToGoLive: hasWhatsappCreds,
    goLiveLoading: false,
    editingChatbot: false,
    setEditingChatbot: (_value: boolean) => {},
    editChatbotForm: { chatbot_name: '', greeting_message: '', farewell_message: '' },
    setEditChatbotForm: (_value: any) => {},
    savingEdit: false,
    handleStartEditChatbot: () => {},
    handleSaveChatbotEdit: (e: React.FormEvent) => { e.preventDefault(); return Promise.resolve() },
    handleEditChatbotFormChange: (_e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {},
    useTemplate: (_templateKey: string, _formField: string) => {},
    editingQuestion, setEditingQuestion, editQuestionForm, setEditQuestionForm,
    mainQuestionForm, setMainQuestionForm, mainButtonOptions, setMainButtonOptions,
    showAddQuestion, setShowAddQuestion,
    savingMainQuestion: false,
    getChildren,
    handleStartEditQuestion: (_q: any) => {},
    handleSaveQuestionEdit,
    handleDeleteQuestion: (_questionId: string) => {},
    handleAddMainQuestion,
    handleAddSubOptions,
    handleApplyTemplate,
    handleEditQuestionFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditQuestionForm({ ...editQuestionForm, [e.target.name]: e.target.value }),
    handleMainQuestionChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setMainQuestionForm({ ...mainQuestionForm, [e.target.name]: e.target.value }),
    handleMainButtonOptionChange: (optionId: number, field: string, value: string) => setMainButtonOptions(mainButtonOptions.map(opt => opt.id === optionId ? { ...opt, [field]: value } : opt)),
    addMainButtonOptionField: () => setMainButtonOptions([...mainButtonOptions, { id: Date.now() + Math.random(), button_text: '', answer: '' }]),
    removeMainButtonOptionField: (optionId: number) => setMainButtonOptions(mainButtonOptions.filter(opt => opt.id !== optionId)),
  }
}
