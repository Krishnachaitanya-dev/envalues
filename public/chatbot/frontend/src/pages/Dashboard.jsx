import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import ButtonOptionInput from '../components/ButtonOptionInput'

// Example templates
const EXAMPLE_TEMPLATES = {
  greeting: "🎉 Welcome to [Your Business]!\n\nWe're here to help you 24/7! 😊\n\nPlease select an option below to get started.",
  farewell: "Thank you for contacting us! 🙏\n\nWe appreciate your time and look forward to serving you again.\n\nHave a wonderful day! ✨",
  businessHours: "🕐 Our Business Hours\n\nWe're open:\n📅 Monday - Friday: 9:00 AM - 6:00 PM\n📅 Saturday: 10:00 AM - 4:00 PM\n📅 Sunday: Closed\n\n📞 24/7 Emergency: +91-XXXXXXXXXX\n🌐 Online support: Always available\n\nVisit us anytime! 😊",
  services: "🏢 Our Services\n\nWe offer:\n✅ Premium Service 1\n✅ Professional Service 2\n✅ Expert Consultation\n✅ Custom Solutions\n\n💼 Contact us to learn more!\n📞 Call: +91-XXXXXXXXXX\n📧 Email: info@example.com"
}

// Emoji helper
const COMMON_EMOJIS = ['🏢', '📞', '✅', '🎉', '💼', '⚡', '🌟', '💬', '📧', '🕐', '📅', '🎯', '✨', '👋', '🙏', '😊', '🔔', '🌐']

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [ownerData, setOwnerData] = useState(null)
  const [chatbot, setChatbot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateChatbot, setShowCreateChatbot] = useState(false)

  // Q&A State
  const [qaPairs, setQaPairs] = useState([])
  const [showAddQuestion, setShowAddQuestion] = useState(false)

  // Edit States
  const [editingChatbot, setEditingChatbot] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)

  // Form state for creating chatbot
  const [chatbotForm, setChatbotForm] = useState({
    chatbot_name: '',
    greeting_message: 'Welcome! How can I help you today?',
    farewell_message: 'Thank you for contacting us! Have a great day!'
  })

  // Edit chatbot form
  const [editChatbotForm, setEditChatbotForm] = useState({
    chatbot_name: '',
    greeting_message: '',
    farewell_message: ''
  })

  // Edit question form
  const [editQuestionForm, setEditQuestionForm] = useState({
    question_text: '',
    answer_text: ''
  })

  // Form for adding main question
  const [mainQuestionForm, setMainQuestionForm] = useState({
    question_text: '',
    answer_text: ''
  })

  // Form for adding button options (ONLY for main question form)
  const [mainButtonOptions, setMainButtonOptions] = useState([
    { id: Date.now(), button_text: '', answer: '' }
  ])

  const [creatingChatbot, setCreatingChatbot] = useState(false)
  const [savingMainQuestion, setSavingMainQuestion] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [error, setError] = useState(null)
  const [showExamples, setShowExamples] = useState(false)

  // Subscription state
  const [subscription, setSubscription] = useState(null)
  const [goLiveLoading, setGoLiveLoading] = useState(false)

  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (chatbot) {
      fetchQAPairs()
    }
  }, [chatbot])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        navigate('/login')
        return
      }

      setUser(user)

      const { data: ownerData, error: ownerError } = await supabase
        .from('owners')
        .select('*')
        .eq('id', user.id)
        .single()

      if (ownerError) throw ownerError
      setOwnerData(ownerData)

      const { data: chatbotData, error: chatbotError } = await supabase
        .from('chatbots')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (chatbotData) {
        setChatbot(chatbotData)

        // Fetch subscription for this chatbot
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('chatbot_id', chatbotData.id)
          .single()

        if (subData) setSubscription(subData)
      }
      
    } catch (error) {
      console.error('Error fetching user:', error)
      if (error.message !== 'JSON object requested, multiple (or no) rows returned') {
        navigate('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchQAPairs = async () => {
    try {
      const { data, error } = await supabase
        .from('qa_pairs')
        .select('*')
        .eq('chatbot_id', chatbot.id)
        .order('display_order', { ascending: true })

      if (error) throw error
      setQaPairs(data || [])
    } catch (error) {
      console.error('Error fetching Q&A pairs:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleChatbotFormChange = (e) => {
    setChatbotForm({
      ...chatbotForm,
      [e.target.name]: e.target.value
    })
  }

  const handleEditChatbotFormChange = (e) => {
    setEditChatbotForm({
      ...editChatbotForm,
      [e.target.name]: e.target.value
    })
  }

  const handleEditQuestionFormChange = (e) => {
    setEditQuestionForm({
      ...editQuestionForm,
      [e.target.name]: e.target.value
    })
  }

  const handleMainQuestionChange = (e) => {
    setMainQuestionForm({
      ...mainQuestionForm,
      [e.target.name]: e.target.value
    })
  }

  const handleMainButtonOptionChange = (optionId, field, value) => {
    const newOptions = mainButtonOptions.map(opt => 
      opt.id === optionId ? { ...opt, [field]: value } : opt
    )
    setMainButtonOptions(newOptions)
  }

  const addMainButtonOptionField = () => {
    setMainButtonOptions([...mainButtonOptions, { id: Date.now() + Math.random(), button_text: '', answer: '' }])
  }

  const removeMainButtonOptionField = (optionId) => {
    const newOptions = mainButtonOptions.filter(opt => opt.id !== optionId)
    setMainButtonOptions(newOptions)
  }

  const useTemplate = (templateKey, formField) => {
    if (editingChatbot) {
      setEditChatbotForm({
        ...editChatbotForm,
        [formField]: EXAMPLE_TEMPLATES[templateKey]
      })
    } else {
      setChatbotForm({
        ...chatbotForm,
        [formField]: EXAMPLE_TEMPLATES[templateKey]
      })
    }
  }

  const copyEmoji = (emoji) => {
    navigator.clipboard.writeText(emoji)
    alert(`${emoji} copied!`)
  }

  const handleCreateChatbot = async (e) => {
    e.preventDefault()
    setCreatingChatbot(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('chatbots')
        .insert([
          {
            owner_id: user.id,
            chatbot_name: chatbotForm.chatbot_name,
            greeting_message: chatbotForm.greeting_message,
            farewell_message: chatbotForm.farewell_message,
            is_active: false
          }
        ])
        .select()
        .single()

      if (error) throw error

      setChatbot(data)
      setShowCreateChatbot(false)
      alert('Chatbot created successfully! 🎉')
    } catch (error) {
      setError(error.message)
    } finally {
      setCreatingChatbot(false)
    }
  }

  const handleStartEditChatbot = () => {
    setEditChatbotForm({
      chatbot_name: chatbot.chatbot_name,
      greeting_message: chatbot.greeting_message,
      farewell_message: chatbot.farewell_message
    })
    setEditingChatbot(true)
  }

  const handleSaveChatbotEdit = async (e) => {
    e.preventDefault()
    setSavingEdit(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('chatbots')
        .update({
          chatbot_name: editChatbotForm.chatbot_name,
          greeting_message: editChatbotForm.greeting_message,
          farewell_message: editChatbotForm.farewell_message
        })
        .eq('id', chatbot.id)
        .select()
        .single()

      if (error) throw error

      setChatbot(data)
      setEditingChatbot(false)
      alert('Chatbot updated! ✅')
    } catch (error) {
      setError(error.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleStartEditQuestion = (question) => {
    setEditQuestionForm({
      question_text: question.question_text,
      answer_text: question.answer_text
    })
    setEditingQuestion(question.id)
  }

  const handleSaveQuestionEdit = async (e, questionId) => {
    e.preventDefault()
    setSavingEdit(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('qa_pairs')
        .update({
          question_text: editQuestionForm.question_text,
          answer_text: editQuestionForm.answer_text
        })
        .eq('id', questionId)
        .select()
        .single()

      if (error) throw error

      setQaPairs(qaPairs.map(q => q.id === questionId ? data : q))
      setEditingQuestion(null)
      alert('Question updated! ✅')
    } catch (error) {
      setError(error.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleAddMainQuestion = async (e) => {
    e.preventDefault()
    setSavingMainQuestion(true)
    setError(null)

    try {
      const rootCount = qaPairs.filter(q => q.parent_question_id === null).length

      const { data: mainQ, error: mainError } = await supabase
        .from('qa_pairs')
        .insert([
          {
            chatbot_id: chatbot.id,
            question_text: mainQuestionForm.question_text,
            answer_text: mainQuestionForm.answer_text,
            is_main_question: true,
            parent_question_id: null,
            display_order: rootCount + 1,
            is_active: true
          }
        ])
        .select()
        .single()

      if (mainError) throw mainError

      const validOptions = mainButtonOptions.filter(opt => opt.button_text.trim() && opt.answer.trim())
      
      if (validOptions.length > 0) {
        const buttonInserts = validOptions.map((opt, index) => ({
          chatbot_id: chatbot.id,
          question_text: opt.button_text,
          answer_text: opt.answer,
          is_main_question: false,
          parent_question_id: mainQ.id,
          display_order: index + 1,
          is_active: true
        }))

        const { data: buttons, error: buttonsError } = await supabase
          .from('qa_pairs')
          .insert(buttonInserts)
          .select()

        if (buttonsError) throw buttonsError

        setQaPairs([...qaPairs, mainQ, ...buttons])
      } else {
        setQaPairs([...qaPairs, mainQ])
      }

      setMainQuestionForm({ question_text: '', answer_text: '' })
      setMainButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
      setShowAddQuestion(false)
      alert('Question and buttons added! ✅')
    } catch (error) {
      setError(error.message)
    } finally {
      setSavingMainQuestion(false)
    }
  }

  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('Delete this button and all its sub-buttons?')) return

    try {
      const { error } = await supabase
        .from('qa_pairs')
        .delete()
        .eq('id', questionId)

      if (error) throw error

      const removeQuestionAndChildren = (id) => {
        const children = qaPairs.filter(q => q.parent_question_id === id)
        children.forEach(child => removeQuestionAndChildren(child.id))
        setQaPairs(prev => prev.filter(q => q.id !== id))
      }
      removeQuestionAndChildren(questionId)

      alert('Deleted! 🗑️')
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const getChildren = (parentId) => qaPairs.filter(q => q.parent_question_id === parentId)
  const rootQuestions = qaPairs.filter(q => q.parent_question_id === null)

  // ============================================
  // GO LIVE — triggers Razorpay subscription
  // ============================================
  const handleGoLive = async () => {
    setGoLiveLoading(true)
    setError(null)

    try {
      // Step 1: Get session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      // Step 2: Call our Edge Function to create Razorpay subscription
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ chatbot_id: chatbot.id })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription')
      }

      // Step 3: Open Razorpay checkout popup
      const options = {
        key: data.razorpay_key_id,
        subscription_id: data.subscription_id,
        name: 'WhatsApp Chatbot Platform',
        description: `Activate: ${data.chatbot_name}`,
        currency: 'INR',
        prefill: {
          name: data.owner_name,
          email: data.owner_email,
        },
        theme: { color: '#3B82F6' },
        handler: function (response) {
          // Payment done — webhook will flip is_active
          // Refresh the page so dashboard shows updated status
          alert('🎉 Payment successful! Your chatbot is going live. Refreshing...')
          window.location.reload()
        },
        modal: {
          ondismiss: function () {
            setGoLiveLoading(false)
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        alert('Payment failed: ' + response.error.description)
        setGoLiveLoading(false)
      })
      rzp.open()

    } catch (err) {
      console.error('Go Live error:', err)
      setError(err.message)
      setGoLiveLoading(false)
    }
  }

  // Recursive component with LOCAL state
  const QuestionTree = ({ question, level = 0 }) => {
    const children = getChildren(question.id)
    const indent = level * 20

    // LOCAL STATE for this specific form
    const [showAddButtons, setShowAddButtons] = useState(false)
    const [localButtonOptions, setLocalButtonOptions] = useState([
      { id: Date.now(), button_text: '', answer: '' }
    ])
    const [savingButtons, setSavingButtons] = useState(false)
    const [localError, setLocalError] = useState(null)

    const handleLocalButtonChange = (optionId, field, value) => {
      const newOptions = localButtonOptions.map(opt => 
        opt.id === optionId ? { ...opt, [field]: value } : opt
      )
      setLocalButtonOptions(newOptions)
    }

    const addLocalButtonField = () => {
      setLocalButtonOptions([...localButtonOptions, { id: Date.now() + Math.random(), button_text: '', answer: '' }])
    }

    const removeLocalButtonField = (optionId) => {
      const newOptions = localButtonOptions.filter(opt => opt.id !== optionId)
      setLocalButtonOptions(newOptions)
    }

    const handleAddButtonsForThisQuestion = async (e) => {
      e.preventDefault()
      setSavingButtons(true)
      setLocalError(null)

      try {
        const validOptions = localButtonOptions.filter(opt => opt.button_text.trim() && opt.answer.trim())
        
        if (validOptions.length === 0) {
          alert('Please add at least one button option!')
          setSavingButtons(false)
          return
        }

        const existingCount = qaPairs.filter(q => q.parent_question_id === question.id).length

        const buttonInserts = validOptions.map((opt, index) => ({
          chatbot_id: chatbot.id,
          question_text: opt.button_text,
          answer_text: opt.answer,
          is_main_question: false,
          parent_question_id: question.id,
          display_order: existingCount + index + 1,
          is_active: true
        }))

        const { data: buttons, error: buttonsError } = await supabase
          .from('qa_pairs')
          .insert(buttonInserts)
          .select()

        if (buttonsError) throw buttonsError

        setQaPairs([...qaPairs, ...buttons])
        setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
        setShowAddButtons(false)
        alert(`${buttons.length} buttons added! ✅`)
      } catch (error) {
        setLocalError(error.message)
      } finally {
        setSavingButtons(false)
      }
    }

    const isEditing = editingQuestion === question.id

    return (
      <div className="mb-3" style={{ marginLeft: `${indent}px` }}>
        <div className={`border rounded-lg p-4 ${
          level === 0 ? 'border-blue-300 bg-blue-50' : 
          level === 1 ? 'border-purple-300 bg-purple-50' : 
          'border-green-300 bg-green-50'
        }`}>
          {isEditing ? (
            <form onSubmit={(e) => handleSaveQuestionEdit(e, question.id)} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    📱 Button Label (Short & Clear):
                  </label>
                  <span className={`text-xs font-mono ${
                    editQuestionForm.question_text.length > 20 ? 'text-red-600 font-bold' :
                    editQuestionForm.question_text.length >= 15 ? 'text-orange-600' :
                    'text-gray-500'
                  }`}>
                    {editQuestionForm.question_text.length}/20
                  </span>
                </div>
                <input
                  type="text"
                  name="question_text"
                  value={editQuestionForm.question_text}
                  onChange={handleEditQuestionFormChange}
                  required
                  maxLength={30}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    editQuestionForm.question_text.length > 20 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {editQuestionForm.question_text.length > 20 && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ WhatsApp limits buttons to 20 characters! Will be truncated.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  💬 Full Message (Rich & Detailed):
                </label>
                <textarea
                  name="answer_text"
                  value={editQuestionForm.answer_text}
                  onChange={handleEditQuestionFormChange}
                  required
                  rows="4"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm rounded-lg disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                      level === 0 ? 'bg-blue-600' : 
                      level === 1 ? 'bg-purple-600' : 
                      'bg-green-600'
                    }`}>
                      {question.is_main_question ? 'MAIN' : 'BUTTON'} #{question.display_order}
                    </span>
                    <span className="font-bold text-gray-800 bg-white px-3 py-1 rounded border-2 border-gray-400">
                      📱 {question.question_text}
                    </span>
                  </div>
                  <div className="ml-2 bg-white p-3 rounded border border-gray-300">
                    <p className="text-xs text-gray-600 font-semibold mb-1">Bot replies:</p>
                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{question.answer_text}</p>
                  </div>
                </div>
                <div className="flex gap-2 ml-2">
                  <button
                    onClick={() => handleStartEditQuestion(question)}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {children.length > 0 && (
                <div className="ml-2 mt-3 bg-yellow-50 p-3 rounded border border-yellow-300">
                  <p className="text-xs font-bold text-yellow-800 mb-2">
                    👇 Then these buttons appear:
                  </p>
                  <div className="space-y-2">
                    {children.map(child => (
                      <QuestionTree key={child.id} question={child} level={level + 1} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3">
                {showAddButtons ? (
                  <div className="p-4 border-2 border-orange-300 rounded-lg bg-orange-50">
                    <h5 className="text-sm font-bold text-gray-800 mb-3">
                      ➕ Add Button Options (appear after this answer)
                    </h5>
                    <form onSubmit={handleAddButtonsForThisQuestion} className="space-y-3">
                      {localButtonOptions.map((option) => (
                        <ButtonOptionInput
                          key={option.id}
                          option={option}
                          onChange={handleLocalButtonChange}
                          onRemove={removeLocalButtonField}
                          canRemove={localButtonOptions.length > 1}
                        />
                      ))}
                      
                      <button
                        type="button"
                        onClick={addLocalButtonField}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        + Add Another Button Option
                      </button>

                      {localError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                          {localError}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={savingButtons}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 text-sm rounded-lg disabled:opacity-50"
                        >
                          {savingButtons ? 'Saving...' : `Save ${localButtonOptions.filter(o => o.button_text.trim()).length} Button(s)`}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddButtons(false)
                            setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
                          }}
                          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowAddButtons(true)
                      setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
                    }}
                    className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                  >
                    ➕ Add Button Options ({children.length} existing)
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-blue-600">
              WhatsApp Chatbot Platform
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">{ownerData?.full_name}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {ownerData?.full_name}! 👋
          </h2>
          <p className="text-gray-600">
            {chatbot ? 'Build your button-based chatbot like Kotak811!' : 'Create your first chatbot!'}
          </p>
        </div>

        {chatbot && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-md p-6 mb-6 text-white">
            <h3 className="text-xl font-bold mb-2">💡 Pro Tip: Kotak811-Style UX</h3>
            <p className="text-sm">
              <strong>Button Label:</strong> Keep it short (≤20 chars) - e.g., "Business Hours"<br />
              <strong>Full Message:</strong> Add rich details with emojis and formatting!
            </p>
          </div>
        )}

        {chatbot && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h4 className="text-sm font-bold text-gray-700 mb-2">✨ Quick Emoji Helper</h4>
            <div className="flex flex-wrap gap-2">
              {COMMON_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => copyEmoji(emoji)}
                  className="text-2xl hover:bg-gray-100 p-2 rounded transition"
                  title="Click to copy"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {!chatbot && !showCreateChatbot && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-yellow-800 mb-2">No Chatbot Found</h3>
            <p className="text-yellow-700 mb-4">Create your chatbot to get started!</p>
            <button
              onClick={() => setShowCreateChatbot(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Create My Chatbot
            </button>
          </div>
        )}

        {showCreateChatbot && !chatbot && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-800">Create Your Chatbot</h3>
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {showExamples ? '🙈 Hide Examples' : '💡 Show Examples'}
              </button>
            </div>

            {showExamples && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-sm text-blue-800 mb-2">📝 Example Templates (Click to Use)</h4>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => useTemplate('greeting', 'greeting_message')}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      Use Greeting Template
                    </button>
                    <button
                      onClick={() => useTemplate('farewell', 'farewell_message')}
                      className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded"
                    >
                      Use Farewell Template
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateChatbot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chatbot Name</label>
                <input
                  type="text"
                  name="chatbot_name"
                  value={chatbotForm.chatbot_name}
                  onChange={handleChatbotFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Real Estate Bot"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Greeting (when customer says "hi")
                </label>
                <textarea
                  name="greeting_message"
                  value={chatbotForm.greeting_message}
                  onChange={handleChatbotFormChange}
                  required
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Farewell (when customer says "thank you")
                </label>
                <textarea
                  name="farewell_message"
                  value={chatbotForm.farewell_message}
                  onChange={handleChatbotFormChange}
                  required
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creatingChatbot}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
                >
                  {creatingChatbot ? 'Creating...' : 'Create Chatbot'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateChatbot(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {chatbot && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              {editingChatbot ? (
                <form onSubmit={handleSaveChatbotEdit} className="space-y-4">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Edit Chatbot Settings</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chatbot Name</label>
                    <input
                      type="text"
                      name="chatbot_name"
                      value={editChatbotForm.chatbot_name}
                      onChange={handleEditChatbotFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
                    <textarea
                      name="greeting_message"
                      value={editChatbotForm.greeting_message}
                      onChange={handleEditChatbotFormChange}
                      required
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Farewell Message</label>
                    <textarea
                      name="farewell_message"
                      value={editChatbotForm.farewell_message}
                      onChange={handleEditChatbotFormChange}
                      required
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                    >
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingChatbot(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">{chatbot.chatbot_name}</h3>
                    <div className="flex items-center gap-3">

                      {/* Status Badge */}
                      {chatbot.is_active ? (
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 flex items-center gap-1">
                          🟢 Live
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-600 flex items-center gap-1">
                          🔴 Offline
                        </span>
                      )}

                      {/* Go Live Button — only show if chatbot is not active */}
                      {!chatbot.is_active && (
                        <button
                          onClick={handleGoLive}
                          disabled={goLiveLoading}
                          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                        >
                          {goLiveLoading ? (
                            <>
                              <span className="animate-spin">⏳</span> Processing...
                            </>
                          ) : (
                            <>🚀 Go Live — ₹500/month</>
                          )}
                        </button>
                      )}

                      <button
                        onClick={handleStartEditChatbot}
                        className="text-blue-500 hover:text-blue-700 font-semibold"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <span className="text-gray-600 font-medium">Greeting:</span>
                      <p className="text-gray-800 mt-1 whitespace-pre-wrap">{chatbot.greeting_message}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Farewell:</span>
                      <p className="text-gray-800 mt-1 whitespace-pre-wrap">{chatbot.farewell_message}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Chatbot Menu</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Add questions with multiple button options
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddQuestion(true)
                    setMainQuestionForm({ question_text: '', answer_text: '' })
                    setMainButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  ➕ Add Main Question
                </button>
              </div>

              {showAddQuestion && (
                <div className="mb-6 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                  <h4 className="font-bold text-gray-800 mb-4">Add Main Menu Question</h4>
                  <form onSubmit={handleAddMainQuestion} className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                          📱 Button Label (Short & Clear)
                        </label>
                        <span className={`text-xs font-mono ${
                          mainQuestionForm.question_text.length > 20 ? 'text-red-600 font-bold' :
                          mainQuestionForm.question_text.length >= 15 ? 'text-orange-600' :
                          'text-gray-500'
                        }`}>
                          {mainQuestionForm.question_text.length}/20
                        </span>
                      </div>
                      <input
                        type="text"
                        name="question_text"
                        value={mainQuestionForm.question_text}
                        onChange={handleMainQuestionChange}
                        required
                        maxLength={30}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          mainQuestionForm.question_text.length > 20 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., 'Services'"
                      />
                      {mainQuestionForm.question_text.length > 20 && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ WhatsApp limits buttons to 20 characters! Will be truncated.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        💬 Full Message (Rich & Detailed)
                      </label>
                      <textarea
                        name="answer_text"
                        value={mainQuestionForm.answer_text}
                        onChange={handleMainQuestionChange}
                        required
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="🏢 Our Services

We provide:
✅ Service 1
✅ Service 2
✅ Service 3"
                      />
                    </div>

                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Button Options (shown after the answer above)
                      </label>
                      
                      {mainButtonOptions.map((option) => (
                        <ButtonOptionInput
                          key={option.id}
                          option={option}
                          onChange={handleMainButtonOptionChange}
                          onRemove={removeMainButtonOptionField}
                          canRemove={mainButtonOptions.length > 1}
                        />
                      ))}
                      
                      <button
                        type="button"
                        onClick={addMainButtonOptionField}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
                      >
                        + Add Another Button Option
                      </button>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingMainQuestion}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg disabled:opacity-50"
                      >
                        {savingMainQuestion ? 'Saving...' : 'Save Question'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddQuestion(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {rootQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No questions yet. Add your first question!
                </div>
              ) : (
                <div className="space-y-3">
                  {rootQuestions.map(question => (
                    <QuestionTree key={question.id} question={question} level={0} />
                  ))}
                </div>
              )}
            </div>

            {rootQuestions.length > 0 && (
              <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-lg shadow-md p-6 text-white">
                <h3 className="text-2xl font-bold mb-4">Preview 👀</h3>
                <div className="bg-white rounded-lg p-4 text-gray-800">
                  <p className="font-semibold mb-3">When customer says "hi":</p>
                  <div className="bg-gray-100 p-3 rounded mb-3">
                    <p className="text-sm whitespace-pre-wrap">{chatbot.greeting_message}</p>
                  </div>
                  <p className="text-sm font-semibold mb-2">Main Menu Buttons:</p>
                  <div className="space-y-2">
                    {rootQuestions.slice(0, 3).map(q => (
                      <div key={q.id} className="bg-blue-500 text-white py-2 px-4 rounded text-center text-sm">
                        📱 {q.question_text}
                      </div>
                    ))}
                  </div>
                  {rootQuestions.length > 3 && (
                    <p className="text-xs text-orange-600 mt-2">
                      ⚠️ Only first 3 buttons shown (WhatsApp limit)
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard