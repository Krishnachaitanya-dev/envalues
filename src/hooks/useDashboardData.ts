import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'

// Zod validation schemas
export const chatbotSchema = z.object({
  chatbot_name: z.string().min(1, 'Name is required').max(50, 'Name must be under 50 characters'),
  greeting_message: z.string().min(1, 'Greeting is required').max(500, 'Greeting must be under 500 characters'),
  farewell_message: z.string().min(1, 'Farewell is required').max(500, 'Farewell must be under 500 characters'),
})

export const questionSchema = z.object({
  question_text: z.string().min(1, 'Button label is required').max(20, 'Button label must be 20 characters or less'),
  answer_text: z.string().min(1, 'Response is required').max(1000, 'Response must be under 1000 characters'),
})

export const whatsappSchema = z.object({
  whatsapp_business_number: z.string().min(10, 'Phone number must be at least 10 digits').max(20, 'Phone number too long'),
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

export const EXAMPLE_TEMPLATES: Record<string, string> = {
  greeting: "🎉 Welcome to [Your Business]!\n\nWe're here to help you 24/7! 😊\n\nPlease select an option below to get started.",
  farewell: "Thank you for contacting us! 🙏\n\nWe appreciate your time and look forward to serving you again.\n\nHave a wonderful day! ✨",
}

declare global { interface Window { Razorpay: any } }

export function useDashboardData() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [ownerData, setOwnerData] = useState<any>(null)
  const [chatbot, setChatbot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qaPairs, setQaPairs] = useState<any[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [whatsappForm, setWhatsappForm] = useState({ whatsapp_business_number: '', whatsapp_api_token: '' })
  const [showToken, setShowToken] = useState(false)

  // Enterprise / branding
  const [isEnterprise, setIsEnterprise] = useState(false)
  const [isEnterpriseClient, setIsEnterpriseClient] = useState(false)
  const [brand, setBrand] = useState<{ name: string; logoUrl: string; primaryColor: string } | null>(null)

  // Edit states
  const [editingChatbot, setEditingChatbot] = useState(false)
  const [editChatbotForm, setEditChatbotForm] = useState({ chatbot_name: '', greeting_message: '', farewell_message: '' })
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editQuestionForm, setEditQuestionForm] = useState({ question_text: '', answer_text: '', media_url: '', media_type: '' })
  const [mainQuestionForm, setMainQuestionForm] = useState({ question_text: '', answer_text: '', media_url: '', media_type: '' })
  const [mainButtonOptions, setMainButtonOptions] = useState([{ id: Date.now(), button_text: '', answer: '' }])
  const [showAddQuestion, setShowAddQuestion] = useState(false)

  // Saving states
  const [savingMainQuestion, setSavingMainQuestion] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [goLiveLoading, setGoLiveLoading] = useState(false)

  useEffect(() => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.body.appendChild(s)
    return () => { document.body.removeChild(s) }
  }, [])

  useEffect(() => { checkUser() }, [])
  useEffect(() => { if (chatbot) fetchQAPairs() }, [chatbot])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)
      const { data: od, error: oe } = await (supabase.from('owners') as any).select('id, email, full_name, is_active, onboarding_completed, whatsapp_business_number, whatsapp_api_token, created_at, updated_at, plan_type, enterprise_id, brand_name, brand_logo_url, brand_primary_color, max_clients, reception_phone').eq('id', user.id).single()
      if (oe) throw oe
      setOwnerData(od)
      setWhatsappForm({ whatsapp_business_number: od.whatsapp_business_number || '', whatsapp_api_token: od.whatsapp_api_token || '' })

      // Enterprise branding
      if (od.plan_type === 'enterprise') {
        setIsEnterprise(true)
        setBrand({ name: od.brand_name || 'My Platform', logoUrl: od.brand_logo_url || '', primaryColor: od.brand_primary_color || '#25D366' })
      } else if (od.enterprise_id) {
        setIsEnterpriseClient(true)
        const { data: ent } = await (supabase.from('owners') as any).select('brand_name, brand_logo_url, brand_primary_color').eq('id', od.enterprise_id).single()
        if (ent) setBrand({ name: ent.brand_name || 'My Platform', logoUrl: ent.brand_logo_url || '', primaryColor: ent.brand_primary_color || '#25D366' })
      }
      let { data: cd } = await supabase.from('chatbots').select('*').eq('owner_id', user.id).single()
      if (!cd) {
        const { data: newBot } = await supabase.from('chatbots').insert([{
          owner_id: user.id,
          chatbot_name: (od.full_name || 'My') + "'s Bot",
          greeting_message: 'Welcome! How can I help you today? 😊\n\nPlease select an option below to get started.',
          farewell_message: 'Thank you for contacting us! 🙏\nHave a wonderful day! ✨',
          is_active: false
        }]).select().single()
        cd = newBot
      }
      if (cd) {
        setChatbot(cd)
        setEditChatbotForm({ chatbot_name: cd.chatbot_name, greeting_message: cd.greeting_message, farewell_message: cd.farewell_message })
        const { data: sd } = await supabase.from('subscriptions').select('*').eq('chatbot_id', cd.id).single()
        if (sd) setSubscription(sd)
      }
    } catch (err: any) {
      console.error('Error:', err)
      if (err.message !== 'JSON object requested, multiple (or no) rows returned') navigate('/login')
    } finally { setLoading(false) }
  }

  const fetchQAPairs = async () => {
    try {
      const { data, error } = await supabase.from('qa_pairs').select('*').eq('chatbot_id', chatbot.id).order('display_order', { ascending: true })
      if (error) throw error
      setQaPairs(data || [])
    } catch (err) { console.error('Error fetching Q&A:', err) }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login') }

  const handleWhatsappFormChange = (e: React.ChangeEvent<HTMLInputElement>) => setWhatsappForm({ ...whatsappForm, [e.target.name]: e.target.value })

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingWhatsapp(true); setError(null)
    try {
      const validated = whatsappSchema.parse(whatsappForm)
      const { error } = await supabase.from('owners').update({
        whatsapp_business_number: validated.whatsapp_business_number,
        whatsapp_api_token: validated.whatsapp_api_token,
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

  const handleStartEditChatbot = () => {
    setEditChatbotForm({ chatbot_name: chatbot.chatbot_name, greeting_message: chatbot.greeting_message, farewell_message: chatbot.farewell_message })
    setEditingChatbot(true)
  }

  const handleSaveChatbotEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingEdit(true); setError(null)
    try {
      const validated = chatbotSchema.parse(editChatbotForm)
      const { data, error } = await supabase.from('chatbots').update({ chatbot_name: validated.chatbot_name, greeting_message: validated.greeting_message, farewell_message: validated.farewell_message }).eq('id', chatbot.id).select().single()
      if (error) throw error
      setChatbot(data); setEditingChatbot(false)
      await supabase.from('audit_logs').insert({ owner_id: user.id, action: 'chatbot_updated', resource_type: 'chatbot', resource_id: chatbot.id, metadata: { chatbot_name: validated.chatbot_name } })
      toast({ title: 'Settings saved!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) { toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' }) }
      else { setError(err.message) }
    } finally { setSavingEdit(false) }
  }

  const handleStartEditQuestion = (q: any) => { setEditQuestionForm({ question_text: q.question_text, answer_text: q.answer_text, media_url: q.media_url || '', media_type: q.media_type || '' }); setEditingQuestion(q.id) }

  const handleSaveQuestionEdit = async (e: React.FormEvent, questionId: string) => {
    e.preventDefault(); setSavingEdit(true); setError(null)
    try {
      const validated = questionSchema.parse(editQuestionForm)
      const { data, error } = await supabase.from('qa_pairs').update({ question_text: validated.question_text, answer_text: validated.answer_text, media_url: editQuestionForm.media_url || null, media_type: editQuestionForm.media_type || null }).eq('id', questionId).select().single()
      if (error) throw error
      setQaPairs(qaPairs.map(q => q.id === questionId ? data : q)); setEditingQuestion(null)
      await supabase.from('audit_logs').insert({ owner_id: user.id, action: 'qa_pair_updated', resource_type: 'qa_pair', resource_id: questionId, metadata: { question_text: validated.question_text } })
      toast({ title: 'Updated!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) { toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' }) }
      else { setError(err.message) }
    } finally { setSavingEdit(false) }
  }

  const handleAddMainQuestion = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingMainQuestion(true); setError(null)
    try {
      const validated = questionSchema.parse(mainQuestionForm)
      const rootCount = qaPairs.filter(q => q.parent_question_id === null).length
      const { data: mainQ, error: mainError } = await supabase.from('qa_pairs').insert([{ chatbot_id: chatbot.id, question_text: validated.question_text, answer_text: validated.answer_text, media_url: mainQuestionForm.media_url || null, media_type: mainQuestionForm.media_type || null, is_main_question: true, parent_question_id: null, display_order: rootCount + 1, is_active: true }]).select().single()
      if (mainError) throw mainError
      const validOptions = mainButtonOptions.filter(opt => opt.button_text.trim() && opt.answer.trim())
      if (validOptions.length > 0) {
        validOptions.forEach(opt => { questionSchema.parse({ question_text: opt.button_text, answer_text: opt.answer }) })
        const inserts = validOptions.map((opt, i) => ({ chatbot_id: chatbot.id, question_text: opt.button_text, answer_text: opt.answer, is_main_question: false, parent_question_id: mainQ.id, display_order: i + 1, is_active: true }))
        const { data: buttons, error: be } = await supabase.from('qa_pairs').insert(inserts).select()
        if (be) throw be
        setQaPairs([...qaPairs, mainQ, ...buttons])
      } else { setQaPairs([...qaPairs, mainQ]) }
      await supabase.from('audit_logs').insert({ owner_id: user.id, action: 'qa_pair_created', resource_type: 'qa_pair', resource_id: mainQ.id, metadata: { question_text: validated.question_text, is_main: true } })
      setMainQuestionForm({ question_text: '', answer_text: '', media_url: '', media_type: '' })
      setMainButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
      setShowAddQuestion(false)
      toast({ title: 'Menu item added!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) { toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' }) }
      else { setError(err.message) }
    } finally { setSavingMainQuestion(false) }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this item and all its sub-items?')) return
    try {
      const { error } = await supabase.from('qa_pairs').delete().eq('id', questionId)
      if (error) throw error
      const remove = (id: string) => { qaPairs.filter(q => q.parent_question_id === id).forEach(c => remove(c.id)); setQaPairs(prev => prev.filter(q => q.id !== id)) }
      remove(questionId)
      toast({ title: 'Deleted!' })
    } catch (err: any) { toast({ title: 'Error: ' + err.message, variant: 'destructive' }) }
  }

  const handleAddSubOptions = async (parentId: string, options: { button_text: string; answer: string }[]) => {
    try {
      const valid = options.filter(opt => opt.button_text.trim() && opt.answer.trim())
      if (valid.length === 0) { toast({ title: 'Add at least one option', variant: 'destructive' }); return }
      const existingCount = qaPairs.filter(q => q.parent_question_id === parentId).length
      const inserts = valid.map((opt, i) => ({ chatbot_id: chatbot.id, question_text: opt.button_text, answer_text: opt.answer, is_main_question: false, parent_question_id: parentId, display_order: existingCount + i + 1, is_active: true }))
      const { data: buttons, error } = await supabase.from('qa_pairs').insert(inserts).select()
      if (error) throw error
      setQaPairs([...qaPairs, ...buttons])
      toast({ title: `${buttons.length} option${buttons.length > 1 ? 's' : ''} added!` })
      return true
    } catch (err: any) { toast({ title: 'Error: ' + err.message, variant: 'destructive' }); return false }
  }

  const getChildren = (parentId: string) => qaPairs.filter(q => q.parent_question_id === parentId)
  const rootQuestions = qaPairs.filter(q => q.parent_question_id === null)

  const handleGoLive = async () => {
    if (!ownerData?.whatsapp_business_number?.trim() || !ownerData?.whatsapp_api_token?.trim()) {
      toast({ title: 'WhatsApp configuration required', description: 'Please add your WhatsApp Business Phone Number and Access Token in Settings before going live.', variant: 'destructive' })
      return 'settings'
    }
    if (rootQuestions.length === 0) {
      toast({ title: 'Menu items required', description: 'Add at least one menu item in the Menu Builder before going live.', variant: 'destructive' })
      return 'builder'
    }
    setGoLiveLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ chatbot_id: chatbot.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed')
      const rzp = new window.Razorpay({ key: data.razorpay_key_id, subscription_id: data.subscription_id, name: 'WhatsApp Chatbot', description: `Activate: ${data.chatbot_name}`, currency: 'INR', prefill: { name: data.owner_name, email: data.owner_email }, theme: { color: '#25D366' }, handler: () => { toast({ title: 'Payment successful!' }); window.location.reload() }, modal: { ondismiss: () => setGoLiveLoading(false) } })
      rzp.on('payment.failed', (r: any) => { toast({ title: 'Payment failed', description: r.error.description, variant: 'destructive' }); setGoLiveLoading(false) })
      rzp.open()
    } catch (err: any) { setError(err.message); setGoLiveLoading(false) }
    return null
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
      setChatbot({ ...chatbot, is_active: false })
      toast({ title: 'Subscription cancelled', description: 'Your plan will remain active until the end of your current billing period.' })
      return { success: true }
    } catch (err: any) {
      toast({ title: 'Cancellation failed', description: err.message, variant: 'destructive' })
      return { success: false, error: err.message }
    }
  }

  const handleApplyTemplate = async (template: import('@/data/templates').Template): Promise<boolean> => {
    if (!chatbot) return false
    try {
      // 1. Delete all existing qa_pairs for this chatbot
      const { error: delErr } = await supabase.from('qa_pairs').delete().eq('chatbot_id', chatbot.id)
      if (delErr) throw delErr

      // 2. Update greeting & farewell
      const { data: updatedBot, error: botErr } = await supabase
        .from('chatbots')
        .update({ greeting_message: template.greeting, farewell_message: template.farewell })
        .eq('id', chatbot.id)
        .select()
        .single()
      if (botErr) throw botErr
      setChatbot(updatedBot)
      setEditChatbotForm({ chatbot_name: updatedBot.chatbot_name, greeting_message: updatedBot.greeting_message, farewell_message: updatedBot.farewell_message })

      // 3. Insert root nodes, then children
      const allInserted: any[] = []
      for (let i = 0; i < template.nodes.length; i++) {
        const node = template.nodes[i]
        const { data: root, error: rootErr } = await supabase
          .from('qa_pairs')
          .insert([{ chatbot_id: chatbot.id, question_text: node.question_text.slice(0, 20), answer_text: node.answer_text, is_main_question: true, parent_question_id: null, display_order: i + 1, is_active: true }])
          .select()
          .single()
        if (rootErr) throw rootErr
        allInserted.push(root)

        if (node.children && node.children.length > 0) {
          const childInserts = node.children.map((c, j) => ({
            chatbot_id: chatbot.id,
            question_text: c.question_text.slice(0, 20),
            answer_text: c.answer_text,
            is_main_question: false,
            parent_question_id: root.id,
            display_order: j + 1,
            is_active: true,
          }))
          const { data: children, error: childErr } = await supabase.from('qa_pairs').insert(childInserts).select()
          if (childErr) throw childErr
          allInserted.push(...(children ?? []))
        }
      }

      setQaPairs(allInserted)
      await supabase.from('audit_logs').insert({ owner_id: user.id, action: 'template_applied', resource_type: 'chatbot', resource_id: chatbot.id, metadata: { template_id: template.id } })
      toast({ title: `${template.emoji} ${template.name} template applied!`, description: `${template.nodes.length} menu items loaded. Customise the text to match your business.` })
      return true
    } catch (err: any) {
      toast({ title: 'Failed to apply template', description: err.message, variant: 'destructive' })
      return false
    }
  }

  const formatAmount = (amountInPaise: number) => `₹${Math.round(amountInPaise / 100)}`

  const useTemplate = (templateKey: string, formField: string) => {
    if (!editingChatbot) handleStartEditChatbot()
    setEditChatbotForm(prev => ({ ...prev, [formField]: EXAMPLE_TEMPLATES[templateKey] }))
  }

  const totalQuestions = qaPairs.length
  const mainMenuCount = rootQuestions.length
  const subOptionCount = totalQuestions - mainMenuCount
  const isLive = chatbot?.is_active
  const hasWhatsappCreds = !!(ownerData?.whatsapp_business_number?.trim() && ownerData?.whatsapp_api_token?.trim())
  const hasMenuItems = mainMenuCount > 0
  const readyToGoLive = hasWhatsappCreds && hasMenuItems

  return {
    // Data
    user, ownerData, chatbot, loading, qaPairs, subscription, error, setError,
    whatsappForm, showToken, setShowToken,
    editingChatbot, setEditingChatbot, editChatbotForm, setEditChatbotForm,
    editingQuestion, setEditingQuestion, editQuestionForm, setEditQuestionForm,
    mainQuestionForm, setMainQuestionForm, mainButtonOptions, setMainButtonOptions,
    showAddQuestion, setShowAddQuestion,
    savingMainQuestion, savingEdit, savingWhatsapp, goLiveLoading,

    // Computed
    rootQuestions, totalQuestions, mainMenuCount, subOptionCount,
    isLive, hasWhatsappCreds, hasMenuItems, readyToGoLive,
    isEnterprise, isEnterpriseClient, brand,

    // Actions
    handleLogout, handleWhatsappFormChange, handleSaveWhatsapp, handleSaveReceptionPhone,
    handleStartEditChatbot, handleSaveChatbotEdit,
    handleStartEditQuestion, handleSaveQuestionEdit,
    handleAddMainQuestion, handleDeleteQuestion, handleAddSubOptions,
    handleGoLive, handleCancelSubscription, handleApplyTemplate, formatAmount, useTemplate, getChildren,
    handleEditChatbotFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditChatbotForm({ ...editChatbotForm, [e.target.name]: e.target.value }),
    handleEditQuestionFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditQuestionForm({ ...editQuestionForm, [e.target.name]: e.target.value }),
    handleMainQuestionChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setMainQuestionForm({ ...mainQuestionForm, [e.target.name]: e.target.value }),
    handleMainButtonOptionChange: (optionId: number, field: string, value: string) => setMainButtonOptions(mainButtonOptions.map(opt => opt.id === optionId ? { ...opt, [field]: value } : opt)),
    addMainButtonOptionField: () => setMainButtonOptions([...mainButtonOptions, { id: Date.now() + Math.random(), button_text: '', answer: '' }]),
    removeMainButtonOptionField: (optionId: number) => setMainButtonOptions(mainButtonOptions.filter(opt => opt.id !== optionId)),
  }
}
