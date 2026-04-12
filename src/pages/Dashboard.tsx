import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate, Link } from 'react-router-dom'
import ButtonOptionInput from '@/components/ButtonOptionInput'
import {
  Loader2, LogOut, User, ChevronDown, MessageSquare, Plus, Settings,
  Zap, Bot, Pencil, Trash2, X, Check, Send, Phone, Video,
  MoreVertical, ChevronRight, Rocket, Sparkles,
  ListTree, CircleDot, Smartphone, CreditCard,
  Activity, GitBranch, Workflow, MousePointerClick,
  AlertTriangle, Power, HandMetal, Mic, Key, Eye, EyeOff, Link2,
  CheckCircle2, Circle, Shield
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'

// Zod validation schemas
const chatbotSchema = z.object({
  chatbot_name: z.string().min(1, 'Name is required').max(50, 'Name must be under 50 characters'),
  greeting_message: z.string().min(1, 'Greeting is required').max(500, 'Greeting must be under 500 characters'),
  farewell_message: z.string().min(1, 'Farewell is required').max(500, 'Farewell must be under 500 characters'),
})

const questionSchema = z.object({
  question_text: z.string().min(1, 'Button label is required').max(20, 'Button label must be 20 characters or less'),
  answer_text: z.string().min(1, 'Response is required').max(1000, 'Response must be under 1000 characters'),
})

const whatsappSchema = z.object({
  whatsapp_business_number: z.string().min(10, 'Phone number must be at least 10 digits').max(20, 'Phone number too long'),
  whatsapp_api_token: z.string().min(1, 'Access token is required').max(500, 'Token too long'),
})

// XSS sanitization: escape HTML entities for safe rendering
function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const EXAMPLE_TEMPLATES: Record<string, string> = {
  greeting: "🎉 Welcome to [Your Business]!\n\nWe're here to help you 24/7! 😊\n\nPlease select an option below to get started.",
  farewell: "Thank you for contacting us! 🙏\n\nWe appreciate your time and look forward to serving you again.\n\nHave a wonderful day! ✨",
}

declare global { interface Window { Razorpay: any } }

type TabType = 'overview' | 'menu' | 'settings'

function Dashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [ownerData, setOwnerData] = useState<any>(null)
  const [chatbot, setChatbot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // showCreateChatbot removed — chatbot is auto-created on signup
  const [qaPairs, setQaPairs] = useState<any[]>([])
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [editingChatbot, setEditingChatbot] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    if (showUserMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  const [editChatbotForm, setEditChatbotForm] = useState({ chatbot_name: '', greeting_message: '', farewell_message: '' })
  const [editQuestionForm, setEditQuestionForm] = useState({ question_text: '', answer_text: '' })
  const [mainQuestionForm, setMainQuestionForm] = useState({ question_text: '', answer_text: '' })
  const [mainButtonOptions, setMainButtonOptions] = useState([{ id: Date.now(), button_text: '', answer: '' }])
  
  const [savingMainQuestion, setSavingMainQuestion] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [goLiveLoading, setGoLiveLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [whatsappForm, setWhatsappForm] = useState({ whatsapp_business_number: '', whatsapp_api_token: '' })
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true; document.body.appendChild(s); return () => { document.body.removeChild(s) } }, [])
  useEffect(() => { checkUser() }, [])
  useEffect(() => { if (chatbot) fetchQAPairs() }, [chatbot])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)
      const { data: od, error: oe } = await supabase.from('owners').select('id, email, full_name, is_active, onboarding_completed, whatsapp_business_number, whatsapp_api_token, created_at, updated_at').eq('id', user.id).single()
      if (oe) throw oe
      setOwnerData(od)
      setWhatsappForm({ whatsapp_business_number: od.whatsapp_business_number || '', whatsapp_api_token: od.whatsapp_api_token || '' })
      let { data: cd } = await supabase.from('chatbots').select('*').eq('owner_id', user.id).single()
      if (!cd) {
        // Auto-create a default chatbot for existing users who don't have one
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
  const handleEditChatbotFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditChatbotForm({ ...editChatbotForm, [e.target.name]: e.target.value })
  const handleEditQuestionFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditQuestionForm({ ...editQuestionForm, [e.target.name]: e.target.value })
  const handleMainQuestionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setMainQuestionForm({ ...mainQuestionForm, [e.target.name]: e.target.value })
  const handleMainButtonOptionChange = (optionId: number, field: string, value: string) => setMainButtonOptions(mainButtonOptions.map(opt => opt.id === optionId ? { ...opt, [field]: value } : opt))
  const addMainButtonOptionField = () => setMainButtonOptions([...mainButtonOptions, { id: Date.now() + Math.random(), button_text: '', answer: '' }])
  const removeMainButtonOptionField = (optionId: number) => setMainButtonOptions(mainButtonOptions.filter(opt => opt.id !== optionId))

  const handleWhatsappFormChange = (e: React.ChangeEvent<HTMLInputElement>) => setWhatsappForm({ ...whatsappForm, [e.target.name]: e.target.value })

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingWhatsapp(true); setError(null)
    try {
      // Validate with Zod
      const validated = whatsappSchema.parse(whatsappForm)
      const { error } = await supabase.from('owners').update({
        whatsapp_business_number: validated.whatsapp_business_number,
        whatsapp_api_token: validated.whatsapp_api_token,
      }).eq('id', user.id)
      if (error) throw error
      setOwnerData({ ...ownerData, ...whatsappForm })
      // Insert audit log
      await supabase.from('audit_logs').insert({
        owner_id: user.id,
        action: 'whatsapp_credentials_updated',
        resource_type: 'owner',
        resource_id: user.id,
        metadata: { whatsapp_business_number: validated.whatsapp_business_number }
      })
      toast({ title: 'WhatsApp configuration saved!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' })
      } else {
        setError(err.message)
      }
    } finally { setSavingWhatsapp(false) }
  }

  const useTemplate = (templateKey: string, formField: string) => {
    if (!editingChatbot) handleStartEditChatbot()
    setEditChatbotForm(prev => ({ ...prev, [formField]: EXAMPLE_TEMPLATES[templateKey] }))
  }

  // handleCreateChatbot removed — chatbot auto-created on signup

  const handleStartEditChatbot = () => {
    setEditChatbotForm({ chatbot_name: chatbot.chatbot_name, greeting_message: chatbot.greeting_message, farewell_message: chatbot.farewell_message })
    setEditingChatbot(true)
    setActiveTab('settings')
  }

  const handleSaveChatbotEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingEdit(true); setError(null)
    try {
      // Validate with Zod
      const validated = chatbotSchema.parse(editChatbotForm)
      const { data, error } = await supabase.from('chatbots').update({ 
        chatbot_name: validated.chatbot_name, 
        greeting_message: validated.greeting_message, 
        farewell_message: validated.farewell_message 
      }).eq('id', chatbot.id).select().single()
      if (error) throw error
      setChatbot(data); setEditingChatbot(false)
      // Insert audit log
      await supabase.from('audit_logs').insert({
        owner_id: user.id,
        action: 'chatbot_updated',
        resource_type: 'chatbot',
        resource_id: chatbot.id,
        metadata: { chatbot_name: validated.chatbot_name }
      })
      toast({ title: 'Settings saved!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' })
      } else {
        setError(err.message)
      }
    } finally { setSavingEdit(false) }
  }

  const handleStartEditQuestion = (q: any) => { setEditQuestionForm({ question_text: q.question_text, answer_text: q.answer_text }); setEditingQuestion(q.id) }

  const handleSaveQuestionEdit = async (e: React.FormEvent, questionId: string) => {
    e.preventDefault(); setSavingEdit(true); setError(null)
    try {
      // Validate with Zod
      const validated = questionSchema.parse(editQuestionForm)
      const { data, error } = await supabase.from('qa_pairs').update({ 
        question_text: validated.question_text, 
        answer_text: validated.answer_text 
      }).eq('id', questionId).select().single()
      if (error) throw error
      setQaPairs(qaPairs.map(q => q.id === questionId ? data : q)); setEditingQuestion(null)
      // Insert audit log
      await supabase.from('audit_logs').insert({
        owner_id: user.id,
        action: 'qa_pair_updated',
        resource_type: 'qa_pair',
        resource_id: questionId,
        metadata: { question_text: validated.question_text }
      })
      toast({ title: 'Updated!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' })
      } else {
        setError(err.message)
      }
    } finally { setSavingEdit(false) }
  }

  const handleAddMainQuestion = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingMainQuestion(true); setError(null)
    try {
      // Validate with Zod
      const validated = questionSchema.parse(mainQuestionForm)
      const rootCount = qaPairs.filter(q => q.parent_question_id === null).length
      const { data: mainQ, error: mainError } = await supabase.from('qa_pairs').insert([{ 
        chatbot_id: chatbot.id, 
        question_text: validated.question_text, 
        answer_text: validated.answer_text, 
        is_main_question: true, 
        parent_question_id: null, 
        display_order: rootCount + 1, 
        is_active: true 
      }]).select().single()
      if (mainError) throw mainError
      
      const validOptions = mainButtonOptions.filter(opt => opt.button_text.trim() && opt.answer.trim())
      if (validOptions.length > 0) {
        // Validate each button option
        validOptions.forEach(opt => {
          questionSchema.parse({ question_text: opt.button_text, answer_text: opt.answer })
        })
        const inserts = validOptions.map((opt, i) => ({ 
          chatbot_id: chatbot.id, 
          question_text: opt.button_text, 
          answer_text: opt.answer, 
          is_main_question: false, 
          parent_question_id: mainQ.id, 
          display_order: i + 1, 
          is_active: true 
        }))
        const { data: buttons, error: be } = await supabase.from('qa_pairs').insert(inserts).select()
        if (be) throw be
        setQaPairs([...qaPairs, mainQ, ...buttons])
      } else { setQaPairs([...qaPairs, mainQ]) }
      
      // Insert audit log
      await supabase.from('audit_logs').insert({
        owner_id: user.id,
        action: 'qa_pair_created',
        resource_type: 'qa_pair',
        resource_id: mainQ.id,
        metadata: { question_text: validated.question_text, is_main: true }
      })
      
      setMainQuestionForm({ question_text: '', answer_text: '' })
      setMainButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
      setShowAddQuestion(false)
      toast({ title: 'Menu item added!' })
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: 'Validation error', description: err.errors[0].message, variant: 'destructive' })
      } else {
        setError(err.message)
      }
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

  const getChildren = (parentId: string) => qaPairs.filter(q => q.parent_question_id === parentId)
  const rootQuestions = qaPairs.filter(q => q.parent_question_id === null)

  const handleGoLive = async () => {
    // Validate WhatsApp credentials before allowing Go Live
    if (!ownerData?.whatsapp_business_number?.trim() || !ownerData?.whatsapp_api_token?.trim()) {
      toast({
        title: 'WhatsApp configuration required',
        description: 'Please add your WhatsApp Business Phone Number and Access Token in Settings before going live.',
        variant: 'destructive'
      })
      setActiveTab('settings')
      return
    }
    if (rootQuestions.length === 0) {
      toast({
        title: 'Menu items required',
        description: 'Add at least one menu item in the Menu Builder before going live.',
        variant: 'destructive'
      })
      setActiveTab('menu')
      return
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
  }

  // Format subscription amount (stored in paise)
  const formatAmount = (amountInPaise: number) => `₹${Math.round(amountInPaise / 100)}`

  const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-input text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm'
  const textareaCls = inputCls + ' resize-none'
  const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider'

  // --- WhatsApp Preview Component ---
  const WhatsAppPreview = () => (
    <div className="sticky top-20">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
          <Smartphone size={14} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">Live Preview</p>
          <p className="text-[10px] text-muted-foreground">How your bot looks on WhatsApp</p>
        </div>
      </div>
      <div className="bg-card rounded-[20px] overflow-hidden shadow-2xl shadow-black/30 border border-border/50 ring-1 ring-white/[0.03]">
        {/* WA header */}
        <div className="bg-gradient-to-r from-[hsl(145,63%,16%)] to-[hsl(152,45%,20%)] px-3.5 py-3 flex items-center gap-2.5">
          <ChevronDown size={16} className="text-white/60 rotate-90" />
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10">
            {chatbot?.chatbot_name?.charAt(0)?.toUpperCase() || 'B'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold truncate">{chatbot?.chatbot_name}</p>
            <p className="text-white/45 text-[10px]">{chatbot?.is_active ? 'online' : 'offline'}</p>
          </div>
          <div className="flex items-center gap-3.5 text-white/50">
            <Video size={16} />
            <Phone size={15} />
            <MoreVertical size={16} />
          </div>
        </div>

        {/* Chat */}
        <div className="bg-[hsl(0,0%,5%)] min-h-[340px] p-3.5 space-y-3"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.012'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
          {/* User */}
          <div className="flex justify-end">
            <div className="bg-[hsl(145,60%,16%)] text-white px-3.5 py-2 rounded-2xl rounded-tr-md max-w-[70%] shadow-sm">
              <p className="text-[13px]">hi</p>
              <p className="text-[9px] text-white/35 text-right mt-0.5">12:00</p>
            </div>
          </div>
          {/* Bot */}
          <div className="flex justify-start">
            <div className="bg-[hsl(0,0%,10%)] text-foreground px-3.5 py-2.5 rounded-2xl rounded-tl-md max-w-[82%] shadow-sm border border-white/[0.04]">
              <p 
                className="text-[13px] whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeText(chatbot?.greeting_message || '') }}
              />
              <p className="text-[9px] text-muted-foreground/60 mt-1">12:00</p>
            </div>
          </div>
          {/* Buttons */}
          {rootQuestions.length > 0 ? (
            <div className="flex justify-start">
              <div className="w-[82%] space-y-1.5">
                {rootQuestions.slice(0, 3).map(q => (
                  <div key={q.id} className="bg-[hsl(0,0%,10%)] border border-white/[0.04] rounded-xl py-2.5 text-center cursor-pointer hover:bg-[hsl(0,0%,13%)] transition-colors shadow-sm">
                    <p className="text-primary text-[13px] font-medium">{q.question_text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground/25 text-xs">Add menu items to see them here</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-[hsl(0,0%,7%)] border-t border-white/[0.04] px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 bg-[hsl(0,0%,12%)] rounded-full px-4 py-2 border border-white/[0.04]">
            <p className="text-muted-foreground/25 text-[13px]">Type a message</p>
          </div>
          <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
            <Mic size={16} className="text-primary-foreground" />
          </div>
        </div>
      </div>
      {rootQuestions.length > 3 && (
        <div className="flex items-center gap-1.5 justify-center mt-3 text-warning">
          <AlertTriangle size={12} />
          <p className="text-[11px] font-medium">Only 3 buttons shown (WhatsApp limit)</p>
        </div>
      )}
    </div>
  )

  // --- QuestionTree ---
  const QuestionTree = ({ question, level = 0 }: { question: any; level?: number }) => {
    const children = getChildren(question.id)
    const [showAddButtons, setShowAddButtons] = useState(false)
    const [localButtonOptions, setLocalButtonOptions] = useState([{ id: Date.now(), button_text: '', answer: '' }])
    const [savingButtons, setSavingButtons] = useState(false)
    const [localError, setLocalError] = useState<string | null>(null)

    const handleLocalButtonChange = (optionId: number, field: string, value: string) => setLocalButtonOptions(localButtonOptions.map(opt => opt.id === optionId ? { ...opt, [field]: value } : opt))
    const addLocalButtonField = () => setLocalButtonOptions([...localButtonOptions, { id: Date.now() + Math.random(), button_text: '', answer: '' }])
    const removeLocalButtonField = (optionId: number) => setLocalButtonOptions(localButtonOptions.filter(opt => opt.id !== optionId))

    const handleAddButtonsForThisQuestion = async (e: React.FormEvent) => {
      e.preventDefault(); setSavingButtons(true); setLocalError(null)
      try {
        const valid = localButtonOptions.filter(opt => opt.button_text.trim() && opt.answer.trim())
        if (valid.length === 0) { toast({ title: 'Add at least one option', variant: 'destructive' }); setSavingButtons(false); return }
        const existingCount = qaPairs.filter(q => q.parent_question_id === question.id).length
        const inserts = valid.map((opt, i) => ({ chatbot_id: chatbot.id, question_text: opt.button_text, answer_text: opt.answer, is_main_question: false, parent_question_id: question.id, display_order: existingCount + i + 1, is_active: true }))
        const { data: buttons, error } = await supabase.from('qa_pairs').insert(inserts).select()
        if (error) throw error
        setQaPairs([...qaPairs, ...buttons])
        setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
        setShowAddButtons(false)
        toast({ title: `${buttons.length} option${buttons.length > 1 ? 's' : ''} added!` })
      } catch (err: any) { setLocalError(err.message) } finally { setSavingButtons(false) }
    }

    const isEditing = editingQuestion === question.id

    return (
      <div className={`${level > 0 ? 'ml-4 sm:ml-6 mt-2' : 'mt-3'}`}>
        {/* Connector line for nested items */}
        <div className={`group relative rounded-xl border transition-all duration-200 ${
          level === 0
            ? 'bg-card border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5'
            : 'bg-muted/30 border-border/40 hover:border-primary/20 hover:bg-muted/50'
        }`}>
          {/* Level indicator strip */}
          {level === 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-primary/60 to-primary/20" />
          )}

          {isEditing ? (
            <form onSubmit={(e) => handleSaveQuestionEdit(e, question.id)} className="p-4 sm:p-5 space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={labelCls}>Button Label</label>
                  <span className={`text-xs font-mono tabular-nums ${editQuestionForm.question_text.length > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {editQuestionForm.question_text.length}/20
                  </span>
                </div>
                <input type="text" name="question_text" value={editQuestionForm.question_text} onChange={handleEditQuestionFormChange} required maxLength={30} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Response Message</label>
                <textarea name="answer_text" value={editQuestionForm.answer_text} onChange={handleEditQuestionFormChange} required rows={3} className={textareaCls} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                </button>
                <button type="button" onClick={() => setEditingQuestion(null)}
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <X size={14} /> Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 flex-1 min-w-0">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    level === 0
                      ? 'bg-gradient-to-br from-primary/20 to-primary/5'
                      : 'bg-muted'
                  }`}>
                    {level === 0 ? <MousePointerClick size={16} className="text-primary" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{question.question_text}</span>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        level === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {level === 0 ? 'Main' : `L${level + 1}`}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed break-words">{question.answer_text}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0">
                  <button onClick={() => handleStartEditQuestion(question)}
                    className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDeleteQuestion(question.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {children.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/40">
                  <div className="flex items-center gap-1.5 mb-2">
                    <GitBranch size={11} className="text-muted-foreground/50" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{children.length} sub-option{children.length !== 1 ? 's' : ''}</p>
                  </div>
                  {children.map(child => <QuestionTree key={child.id} question={child} level={level + 1} />)}
                </div>
              )}

              <div className="mt-3 pt-2 border-t border-border/30">
                {showAddButtons ? (
                  <div className="bg-background/50 rounded-xl p-3 sm:p-4 mt-2 border border-border/50">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Add Sub-Options</h5>
                      <button onClick={() => { setShowAddButtons(false); setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }]) }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={14} /></button>
                    </div>
                    <form onSubmit={handleAddButtonsForThisQuestion} className="space-y-3">
                      {localButtonOptions.map(opt => <ButtonOptionInput key={opt.id} option={opt} onChange={handleLocalButtonChange} onRemove={removeLocalButtonField} canRemove={localButtonOptions.length > 1} />)}
                      <button type="button" onClick={addLocalButtonField}
                        className="text-primary text-xs font-semibold hover:underline">+ Add another option</button>
                      {localError && <p className="text-destructive text-xs">{localError}</p>}
                      <button type="submit" disabled={savingButtons}
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {savingButtons ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Options
                      </button>
                    </form>
                  </div>
                ) : (
                  <button onClick={() => { setShowAddButtons(true); setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }]) }}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors">
                    <Plus size={13} /> Add sub-option
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Loading ---
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Loading dashboard</p>
          <p className="text-xs text-muted-foreground mt-0.5">Please wait...</p>
        </div>
      </div>
    </div>
  )

  const totalQuestions = qaPairs.length
  const mainMenuCount = rootQuestions.length
  const subOptionCount = totalQuestions - mainMenuCount
  const isLive = chatbot?.is_active
  const hasWhatsappCreds = !!(ownerData?.whatsapp_business_number?.trim() && ownerData?.whatsapp_api_token?.trim())
  const hasMenuItems = mainMenuCount > 0
  const readyToGoLive = hasWhatsappCreds && hasMenuItems

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity size={16} /> },
    { key: 'menu', label: 'Menu Builder', icon: <Workflow size={16} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="h-[52px] border-b border-border sticky top-0 z-50 backdrop-blur-xl bg-background/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-primary via-primary/80 to-secondary rounded-lg flex items-center justify-center shadow-lg shadow-primary/25">
              <Bot size={16} className="text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-sm hidden sm:inline">BotFlow</span>
            {chatbot && (
              <>
                <span className="text-border hidden sm:inline">/</span>
                <span className="text-foreground text-sm font-medium hidden sm:inline">{chatbot.chatbot_name}</span>
                {isLive ? (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" /> Draft
                  </span>
                )}
              </>
            )}
          </div>
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:bg-muted px-2 py-1.5 rounded-lg transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/25 to-secondary/25 flex items-center justify-center text-primary font-bold text-[11px] ring-1 ring-border">
                {ownerData?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <ChevronDown size={11} className="text-muted-foreground hidden sm:block" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs font-bold text-foreground truncate">{ownerData?.full_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{ownerData?.email}</p>
                </div>
                <div className="p-1">
                  <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-xl transition-colors" onClick={() => setShowUserMenu(false)}>
                    <User size={14} className="text-muted-foreground" /> Profile
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 rounded-xl transition-colors">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Dashboard */}
        {chatbot ? (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-2xl p-1 mb-6 overflow-x-auto">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-card text-foreground shadow-md shadow-black/10 border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="grid lg:grid-cols-[1fr,300px] gap-6">
                <div className="space-y-5 order-2 lg:order-1">
                  {/* Go live */}
                  {!isLive && (
                    <div className="relative overflow-hidden rounded-2xl border border-primary/20">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/5" />
                      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                            <Power size={20} className="text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-[15px]">{readyToGoLive ? 'Ready to go live?' : 'Almost there!'}</h3>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {readyToGoLive
                                ? 'Activate your chatbot to start receiving WhatsApp messages.'
                                : `Complete the checklist below: ${!hasMenuItems ? 'add menu items' : ''}${!hasMenuItems && !hasWhatsappCreds ? ' & ' : ''}${!hasWhatsappCreds ? 'add WhatsApp credentials' : ''}.`
                              }
                            </p>
                          </div>
                        </div>
                        <button onClick={handleGoLive} disabled={goLiveLoading}
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 whitespace-nowrap shrink-0">
                          {goLiveLoading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>
                            <Zap size={15} /> Go Live — ₹500/mo</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Status', value: isLive ? 'Live' : 'Draft', icon: <Activity size={18} />, accent: isLive, gradient: 'from-primary/15 to-primary/5' },
                      { label: 'Menu Items', value: mainMenuCount, icon: <MousePointerClick size={18} />, gradient: 'from-secondary/15 to-secondary/5' },
                      { label: 'Sub-Options', value: subOptionCount, icon: <GitBranch size={18} />, gradient: 'from-primary/10 to-secondary/5' },
                      { label: 'Total Flows', value: totalQuestions, icon: <Workflow size={18} />, gradient: 'from-secondary/10 to-primary/5' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-card border border-border rounded-2xl p-4 hover:border-primary/20 transition-all group/s hover:shadow-lg hover:shadow-black/5">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-muted-foreground group-hover/s:text-foreground transition-colors`}>
                            {stat.icon}
                          </div>
                          {stat.accent !== undefined && (
                            <span className={`w-2.5 h-2.5 rounded-full ring-2 ${stat.accent ? 'bg-primary ring-primary/20 animate-pulse' : 'bg-muted-foreground/25 ring-muted/40'}`} />
                          )}
                        </div>
                        <p className="text-2xl font-bold text-foreground font-display">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Messages */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-all hover:shadow-lg hover:shadow-black/5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                          <HandMetal size={15} className="text-primary" />
                        </div>
                        <p className="text-xs font-bold text-foreground">Greeting</p>
                      </div>
                      <p className="text-muted-foreground text-[13px] whitespace-pre-wrap leading-relaxed line-clamp-4">{chatbot.greeting_message}</p>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-all hover:shadow-lg hover:shadow-black/5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-secondary/15 to-secondary/5 flex items-center justify-center">
                          <MessageSquare size={15} className="text-secondary" />
                        </div>
                        <p className="text-xs font-bold text-foreground">Farewell</p>
                      </div>
                      <p className="text-muted-foreground text-[13px] whitespace-pre-wrap leading-relaxed line-clamp-4">{chatbot.farewell_message}</p>
                    </div>
                  </div>

                  {/* Go Live Checklist */}
                  {!isLive && (
                    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-lg hover:shadow-black/5 transition-all">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                          <Shield size={15} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Go Live Checklist</p>
                          <p className="text-[10px] text-muted-foreground">Complete these steps to activate your bot</p>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { done: true, label: 'Create chatbot', desc: 'Bot identity configured' },
                          { done: hasMenuItems, label: 'Add menu items', desc: mainMenuCount > 0 ? `${mainMenuCount} item${mainMenuCount !== 1 ? 's' : ''} added` : 'At least 1 required', action: () => setActiveTab('menu') },
                          { done: hasWhatsappCreds, label: 'WhatsApp credentials', desc: hasWhatsappCreds ? 'Phone number & token configured' : 'Required for messaging', action: () => setActiveTab('settings') },
                          { done: !!subscription && subscription.status === 'active', label: 'Activate subscription', desc: subscription?.status === 'active' ? 'Payment active' : '₹500/mo to go live', action: readyToGoLive ? handleGoLive : undefined },
                        ].map((step, i) => (
                          <button
                            key={i}
                            onClick={step.action}
                            disabled={!step.action || step.done}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all ${
                              step.done
                                ? 'bg-primary/5 border border-primary/10'
                                : step.action
                                  ? 'bg-muted/30 border border-border hover:border-primary/20 hover:bg-muted/50 cursor-pointer'
                                  : 'bg-muted/20 border border-border/50 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            {step.done
                              ? <CheckCircle2 size={18} className="text-primary shrink-0" />
                              : <Circle size={18} className="text-muted-foreground/40 shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${step.done ? 'text-primary' : 'text-foreground'}`}>{step.label}</p>
                              <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                            </div>
                            {!step.done && step.action && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab('menu')}
                      className="inline-flex items-center gap-2 bg-card border border-border text-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all">
                      <Workflow size={15} className="text-primary" /> Edit Menu
                    </button>
                    <button onClick={handleStartEditChatbot}
                      className="inline-flex items-center gap-2 bg-card border border-border text-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all">
                      <Settings size={15} className="text-muted-foreground" /> Settings
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div className="order-1 lg:order-2">
                  <WhatsAppPreview />
                </div>
              </div>
            )}

            {/* Menu Builder */}
            {activeTab === 'menu' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <Workflow size={18} className="text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-lg text-foreground">Menu Builder</h2>
                      <p className="text-xs text-muted-foreground">{mainMenuCount} item{mainMenuCount !== 1 ? 's' : ''} · {subOptionCount} sub-option{subOptionCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowAddQuestion(true); setMainQuestionForm({ question_text: '', answer_text: '' }); setMainButtonOptions([{ id: Date.now(), button_text: '', answer: '' }]) }}
                    className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/25 transition-all w-full sm:w-auto">
                    <Plus size={15} /> Add Item
                  </button>
                </div>

                {mainMenuCount >= 3 && (
                  <div className="bg-warning/10 border border-warning/20 text-warning rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2.5">
                    <AlertTriangle size={15} /> WhatsApp supports max 3 buttons per message. Only the first 3 will show.
                  </div>
                )}

                {/* Add form */}
                {showAddQuestion && (
                  <div className="bg-card border-2 border-primary/25 rounded-2xl overflow-hidden shadow-xl shadow-primary/5">
                    <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary/8 via-primary/3 to-transparent">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Plus size={15} className="text-primary" />
                          </div>
                          <h4 className="text-sm font-bold text-foreground">New Menu Item</h4>
                        </div>
                        <button onClick={() => setShowAddQuestion(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={15} /></button>
                      </div>
                    </div>
                    <form onSubmit={handleAddMainQuestion} className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className={labelCls}>Button Label</label>
                          <span className={`text-xs font-mono tabular-nums ${mainQuestionForm.question_text.length > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{mainQuestionForm.question_text.length}/20</span>
                        </div>
                        <input type="text" name="question_text" value={mainQuestionForm.question_text} onChange={handleMainQuestionChange} required maxLength={30} className={inputCls} placeholder="e.g., Services" />
                      </div>
                      <div>
                        <label className={labelCls}>Response Message</label>
                        <textarea name="answer_text" value={mainQuestionForm.answer_text} onChange={handleMainQuestionChange} required rows={3} className={textareaCls} placeholder="Message sent when tapped" />
                      </div>
                      <div className="pt-2 border-t border-border">
                        <label className={labelCls + ' mb-3'}>Sub-Options (optional)</label>
                        {mainButtonOptions.map(opt => <ButtonOptionInput key={opt.id} option={opt} onChange={handleMainButtonOptionChange} onRemove={removeMainButtonOptionField} canRemove={mainButtonOptions.length > 1} />)}
                        <button type="button" onClick={addMainButtonOptionField} className="text-primary text-xs font-bold hover:underline mt-1">+ Add another option</button>
                      </div>
                      {error && <p className="text-destructive text-sm">{error}</p>}
                      <div className="flex gap-2 pt-1">
                        <button type="submit" disabled={savingMainQuestion}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                          {savingMainQuestion ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                        </button>
                        <button type="button" onClick={() => setShowAddQuestion(false)}
                          className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* List */}
                {rootQuestions.length === 0 ? (
                  <div className="bg-card border border-dashed border-border rounded-2xl py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-5">
                      <Workflow size={28} className="text-muted-foreground/30" />
                    </div>
                    <p className="text-foreground text-sm font-semibold">No menu items yet</p>
                    <p className="text-muted-foreground text-xs mt-1.5 max-w-xs mx-auto">Click "Add Item" to create your first menu option and start building your chatbot flow.</p>
                  </div>
                ) : (
                  <div>{rootQuestions.map(q => <QuestionTree key={q.id} question={q} level={0} />)}</div>
                )}
              </div>
            )}

            {/* Settings */}
            {activeTab === 'settings' && (
              <div className="max-w-lg mx-auto sm:mx-0">
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
                  <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/8 via-primary/3 to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Settings size={18} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg text-foreground">Bot Settings</h3>
                        <p className="text-muted-foreground text-[11px] mt-0.5">Update your chatbot's name and messages</p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleSaveChatbotEdit} className="p-6 space-y-5">
                    <div>
                      <label className={labelCls}>Bot Name</label>
                      <input type="text" name="chatbot_name" value={editChatbotForm.chatbot_name || chatbot.chatbot_name}
                        onChange={(e) => { if (!editingChatbot) handleStartEditChatbot(); handleEditChatbotFormChange(e) }}
                        onFocus={() => { if (!editingChatbot) handleStartEditChatbot() }}
                        required className={inputCls} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls + ' !mb-0'}>Greeting Message</label>
                        <button type="button" onClick={() => { if (!editingChatbot) handleStartEditChatbot(); useTemplate('greeting', 'greeting_message') }}
                          className="text-[10px] text-primary font-bold hover:underline uppercase tracking-wider">Template</button>
                      </div>
                      <textarea name="greeting_message" value={editingChatbot ? editChatbotForm.greeting_message : chatbot.greeting_message}
                        onChange={(e) => { if (!editingChatbot) handleStartEditChatbot(); handleEditChatbotFormChange(e) }}
                        onFocus={() => { if (!editingChatbot) handleStartEditChatbot() }}
                        required rows={4} className={textareaCls} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls + ' !mb-0'}>Farewell Message</label>
                        <button type="button" onClick={() => { if (!editingChatbot) handleStartEditChatbot(); useTemplate('farewell', 'farewell_message') }}
                          className="text-[10px] text-primary font-bold hover:underline uppercase tracking-wider">Template</button>
                      </div>
                      <textarea name="farewell_message" value={editingChatbot ? editChatbotForm.farewell_message : chatbot.farewell_message}
                        onChange={(e) => { if (!editingChatbot) handleStartEditChatbot(); handleEditChatbotFormChange(e) }}
                        onFocus={() => { if (!editingChatbot) handleStartEditChatbot() }}
                        required rows={4} className={textareaCls} />
                    </div>
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    {editingChatbot && (
                      <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={savingEdit}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                          {savingEdit && <Loader2 size={16} className="animate-spin" />} Save Changes
                        </button>
                        <button type="button" onClick={() => setEditingChatbot(false)}
                          className="px-5 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                      </div>
                    )}
                  </form>

                  {/* Subscription */}
                  <div className="px-6 pb-6">
                    <div className="border-t border-border pt-5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-secondary/15 to-secondary/5 flex items-center justify-center">
                          <CreditCard size={15} className="text-secondary" />
                        </div>
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider">Subscription</p>
                      </div>
                      {subscription ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${subscription.status === 'active' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                            <span className={`w-2 h-2 rounded-full ${subscription.status === 'active' ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                            {subscription.status === 'active' ? 'Active' : subscription.status}
                          </span>
                          <span className="text-muted-foreground text-sm font-medium">{formatAmount(subscription.amount)}/month</span>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No active subscription</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* WhatsApp Configuration */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10 mt-6">
                  <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/8 via-primary/3 to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Link2 size={18} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg text-foreground">WhatsApp Configuration</h3>
                        <p className="text-muted-foreground text-[11px] mt-0.5">Connect your WhatsApp Business number to power your chatbot</p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleSaveWhatsapp} className="p-6 space-y-5">
                    <div>
                      <label className={labelCls}>WhatsApp Business Phone Number</label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                        <input
                          type="text"
                          name="whatsapp_business_number"
                          value={whatsappForm.whatsapp_business_number}
                          onChange={handleWhatsappFormChange}
                          className={inputCls + ' pl-10'}
                          placeholder="e.g., 919876543210"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">Enter your WhatsApp Business phone number with country code (no + or spaces)</p>
                    </div>
                    <div>
                      <label className={labelCls}>WhatsApp Access Token</label>
                      <div className="relative">
                        <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                        <input
                          type={showToken ? 'text' : 'password'}
                          name="whatsapp_api_token"
                          value={whatsappForm.whatsapp_api_token}
                          onChange={handleWhatsappFormChange}
                          className={inputCls + ' pl-10 pr-10'}
                          placeholder="Paste your access token here"
                        />
                        <button type="button" onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                          {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Get this from <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Meta Developer Portal</a> → WhatsApp → API Setup
                      </p>
                    </div>
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <button type="submit" disabled={savingWhatsapp}
                      className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                      {savingWhatsapp ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Check size={16} /> Save WhatsApp Config</>}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[65vh] text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10 mb-4">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Setting up your chatbot...</p>
            <p className="text-xs text-muted-foreground mt-1">This should only take a moment</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
