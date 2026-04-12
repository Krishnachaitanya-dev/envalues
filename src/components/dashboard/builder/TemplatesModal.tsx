import { useState } from 'react'
import { X, ChevronRight, Check, Loader2, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TEMPLATES, Template } from '@/data/templates'
import { useDashboard } from '@/contexts/DashboardContext'

type Props = { onClose: () => void }

export default function TemplatesModal({ onClose }: Props) {
  const { handleApplyTemplate, hasMenuItems } = useDashboard()
  const [selected, setSelected] = useState<Template | null>(null)
  const [applying, setApplying] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleApply = async () => {
    if (!selected) return
    if (hasMenuItems && !confirming) { setConfirming(true); return }
    setApplying(true)
    const ok = await handleApplyTemplate(selected)
    setApplying(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">Starter Templates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Choose a template to instantly populate your chatbot flow</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: template grid */}
          <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-3 space-y-1.5">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelected(t); setConfirming(false) }}
                className={`w-full text-left px-3.5 py-3 rounded-xl transition-all ${
                  selected?.id === t.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{t.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.industry}</p>
                  </div>
                  {selected?.id === t.id && <Check size={13} className="text-primary ml-auto shrink-0" />}
                </div>
              </button>
            ))}
          </div>

          {/* Right: preview */}
          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-center px-8">
                <div>
                  <p className="text-3xl mb-3">👈</p>
                  <p className="text-sm font-semibold text-foreground">Select a template</p>
                  <p className="text-xs text-muted-foreground mt-1">Choose an industry template from the left to preview its flow</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Template header */}
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selected.emoji}</span>
                  <div>
                    <h3 className="font-display font-bold text-base text-foreground">{selected.name}</h3>
                    <p className="text-xs text-muted-foreground">{selected.description}</p>
                  </div>
                </div>

                {/* Greeting */}
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Greeting Message</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{selected.greeting}</p>
                </div>

                {/* Flow preview */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Menu Flow</p>
                  <div className="space-y-2">
                    {selected.nodes.map((node, i) => (
                      <div key={i} className="border border-border rounded-xl overflow-hidden">
                        {/* Root node */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{node.question_text}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{node.answer_text.split('\n')[0]}</p>
                          </div>
                          {node.children && node.children.length > 0 && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                              {node.children.length} sub-options
                            </span>
                          )}
                        </div>
                        {/* Children */}
                        {node.children && node.children.length > 0 && (
                          <div className="px-4 py-2 space-y-1.5 bg-muted/10">
                            {node.children.map((child, j) => (
                              <div key={j} className="flex items-center gap-2">
                                <ChevronRight size={10} className="text-muted-foreground/50 shrink-0" />
                                <p className="text-[11px] text-muted-foreground">{child.question_text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Farewell */}
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Farewell Message</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{selected.farewell}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {selected && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-4">
            {/* Warning if has existing items */}
            <AnimatePresence>
              {confirming && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-amber-500"
                >
                  <AlertTriangle size={14} />
                  <p className="text-xs font-medium">This will replace your existing menu items. Continue?</p>
                </motion.div>
              )}
              {!confirming && hasMenuItems && (
                <p className="text-xs text-muted-foreground">⚠️ Your existing menu items will be replaced</p>
              )}
              {!confirming && !hasMenuItems && (
                <p className="text-xs text-muted-foreground">All text can be customised after applying</p>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {applying
                  ? <><Loader2 size={14} className="animate-spin" /> Applying…</>
                  : confirming
                  ? <><Check size={14} /> Yes, Replace</>
                  : <><span>{selected.emoji}</span> Use This Template</>
                }
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
