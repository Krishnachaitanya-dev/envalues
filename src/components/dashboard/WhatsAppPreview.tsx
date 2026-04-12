import { useState } from 'react'
import { ChevronDown, Video, Phone, MoreVertical, Mic, AlertTriangle, RotateCcw } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'
import { sanitizeText } from '@/hooks/useDashboardData'

export function WhatsAppPreview() {
  const { chatbot, rootQuestions, qaPairs, getChildren } = useDashboard()
  const [previewPath, setPreviewPath] = useState<any[]>([])
  const [currentView, setCurrentView] = useState<'greeting' | 'response'>('greeting')

  const resetPreview = () => { setPreviewPath([]); setCurrentView('greeting') }

  const handleButtonClick = (question: any) => {
    setPreviewPath(prev => [...prev, question])
    setCurrentView('response')
  }

  const currentQuestion = previewPath.length > 0 ? previewPath[previewPath.length - 1] : null
  const currentChildren = currentQuestion ? getChildren(currentQuestion.id) : rootQuestions

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-foreground">WhatsApp Preview</p>
          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase">Interactive</span>
        </div>
        {previewPath.length > 0 && (
          <button onClick={resetPreview} className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline">
            <RotateCcw size={10} /> Reset
          </button>
        )}
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
        <div className="bg-[hsl(var(--background))] min-h-[340px] max-h-[420px] overflow-y-auto p-3.5 space-y-3"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.012'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
          {/* User message */}
          <div className="flex justify-end">
            <div className="bg-[hsl(145,60%,16%)] text-white px-3.5 py-2 rounded-2xl rounded-tr-md max-w-[70%] shadow-sm">
              <p className="text-[13px]">{previewPath.length > 0 ? currentQuestion.question_text : 'hi'}</p>
              <p className="text-[9px] text-white/35 text-right mt-0.5">12:00</p>
            </div>
          </div>

          {/* Bot response */}
          <div className="flex justify-start">
            <div className="bg-card text-foreground px-3.5 py-2.5 rounded-2xl rounded-tl-md max-w-[82%] shadow-sm border border-border/40">
              <p className="text-[13px] whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeText(
                  previewPath.length > 0 ? currentQuestion.answer_text : (chatbot?.greeting_message || '')
                ) }}
              />
              <p className="text-[9px] text-muted-foreground/60 mt-1">12:00</p>
            </div>
          </div>

          {/* Buttons */}
          {currentChildren.length > 0 ? (
            <div className="flex justify-start">
              <div className="w-[82%] space-y-1.5">
                {currentChildren.slice(0, 3).map(q => (
                  <button key={q.id} onClick={() => handleButtonClick(q)}
                    className="w-full bg-card border border-border/40 rounded-xl py-2.5 text-center cursor-pointer hover:bg-muted/50 transition-colors shadow-sm">
                    <p className="text-primary text-[13px] font-medium">{q.question_text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : previewPath.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground/25 text-xs">Add menu items to see them here</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground/40 text-[11px]">End of flow</p>
            </div>
          )}

          {/* Breadcrumb path */}
          {previewPath.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-border/20">
              <span className="text-[9px] text-muted-foreground/40">Path:</span>
              <button onClick={resetPreview} className="text-[9px] text-primary/60 hover:text-primary">Start</button>
              {previewPath.map((p, i) => (
                <span key={i} className="text-[9px] text-muted-foreground/40">
                  → <span className="text-muted-foreground/60">{p.question_text}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="bg-[hsl(var(--surface))] border-t border-border/40 px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full px-4 py-2 border border-border/40">
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
}
