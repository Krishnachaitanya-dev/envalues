import { useState } from 'react'
import { Smartphone, ShieldCheck, TestTube, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { WhatsAppPreview } from './WhatsAppPreview'
import { useDashboard } from '@/contexts/DashboardContext'
import { useIsMobile } from '@/hooks/use-mobile'

export function RightPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'validation' | 'test'>('preview')
  const isMobile = useIsMobile()
  const { hasWhatsappCreds } = useDashboard()

  if (isMobile) return null

  const warnings: { message: string; severity: 'warning' | 'error' }[] = []
  if (!hasWhatsappCreds) warnings.push({ message: 'WhatsApp credentials not configured', severity: 'warning' })

  return (
    <AnimatePresence mode="wait">
      {collapsed ? (
        <motion.div
          key="collapsed"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 40, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-l border-border flex flex-col items-center pt-3 bg-surface-raised shrink-0"
        >
          <button onClick={() => setCollapsed(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Open panel">
            <PanelRightOpen size={16} />
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="expanded"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="border-l border-border flex flex-col bg-surface-raised shrink-0 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
              {[
                { key: 'preview' as const, label: 'Preview', icon: Smartphone },
                { key: 'validation' as const, label: 'Checks', icon: ShieldCheck, count: warnings.length },
                { key: 'test' as const, label: 'Test', icon: TestTube },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {activeTab === tab.key && (
                    <motion.div layoutId="activeTab" className="absolute inset-0 bg-card rounded-md shadow-sm" transition={{ duration: 0.2 }} />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <tab.icon size={12} />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="w-4 h-4 rounded-full bg-warning/20 text-warning text-[9px] font-bold flex items-center justify-center">{tab.count}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setCollapsed(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Close panel">
              <PanelRightClose size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === 'preview' && <WhatsAppPreview />}

                {activeTab === 'validation' && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground mb-3">Validation Checks</p>
                    {warnings.length === 0 ? (
                      <div className="text-center py-10">
                        <ShieldCheck size={28} className="text-primary/30 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-foreground">All checks passed</p>
                        <p className="text-xs text-muted-foreground mt-1">Your bot configuration looks good</p>
                      </div>
                    ) : (
                      warnings.map((w, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`px-3 py-2.5 rounded-xl text-[12px] font-medium border ${
                            w.severity === 'error' ? 'bg-destructive/5 text-destructive border-destructive/20' : 'bg-warning/5 text-warning border-warning/20'
                          }`}
                        >
                          {w.message}
                        </motion.div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'test' && (
                  <div className="text-center py-16">
                    <TestTube size={28} className="text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground">Conversation Tester</p>
                    <p className="text-xs text-muted-foreground mt-1">Coming soon - simulate full conversations</p>
                    <span className="inline-block mt-3 text-[9px] bg-muted px-2 py-1 rounded-full font-bold uppercase tracking-wider text-muted-foreground">Coming Soon</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
