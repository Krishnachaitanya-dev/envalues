import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { getFlowTemplates } from '../services/getTemplates'
import { templateErrorMessage } from '../services/applyFlowTemplate'
import { trackTemplateEvent } from '../services/templateEvents'
import type { FlowTemplate } from '../domain/template.types'

interface TemplatePickerModalProps {
  ownerId: string | null
  open: boolean
  applying: boolean
  onClose: () => void
  onApply: (template: FlowTemplate) => Promise<void>
}

export default function TemplatePickerModal({
  ownerId,
  open,
  applying,
  onClose,
  onApply,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<FlowTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState('all')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void trackTemplateEvent(ownerId, 'flow_template_picker_opened')
    void load()
  }, [open])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const rows = await getFlowTemplates()
      setTemplates(rows)
      setSelectedId((prev) => prev ?? rows.find(template => template.featured)?.id ?? rows[0]?.id ?? null)
    } catch (error: any) {
      setLoadError(error?.message ?? 'Template catalog could not be loaded.')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const industries = useMemo(() => {
    return ['all', ...Array.from(new Set(templates.flatMap(template => template.industries))).sort()]
  }, [templates])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return templates.filter((template) => {
      const industryMatch = industry === 'all' || template.industries.includes(industry)
      const queryMatch = !normalizedQuery
        || template.name.toLowerCase().includes(normalizedQuery)
        || template.description.toLowerCase().includes(normalizedQuery)
        || template.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
      return industryMatch && queryMatch
    })
  }, [industry, query, templates])

  const selected = filtered.find(template => template.id === selectedId) ?? filtered[0] ?? null

  useEffect(() => {
    if (!open || !selected) return
    void trackTemplateEvent(ownerId, 'flow_template_preview_viewed', {
      templateId: selected.id,
      templateVersion: selected.version,
    })
  }, [open, ownerId, selected?.id, selected?.version])

  const handleApply = async () => {
    if (!selected) return
    setApplyError(null)
    try {
      await onApply(selected)
      onClose()
    } catch (error) {
      setApplyError(templateErrorMessage(error))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close templates" />

      <div className="relative w-full max-w-6xl max-h-[88vh] rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-base font-bold text-foreground">Stock Flow Templates</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Start from a WATI-inspired WhatsApp automation flow, then customise every node.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-0 flex-1">
          <aside className="border-r border-border min-h-0 flex flex-col">
            <div className="p-3 space-y-2 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground outline-none focus:border-primary"
                  placeholder="Search templates"
                />
              </div>
              <select
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm text-foreground outline-none focus:border-primary"
              >
                {industries.map(item => (
                  <option key={item} value={item}>{item === 'all' ? 'All industries' : item}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 size={18} className="mx-auto mb-2 animate-spin text-primary" />
                  Loading templates...
                </div>
              )}

              {!loading && loadError && (
                <div className="m-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center">
                  <AlertTriangle size={18} className="mx-auto mb-2 text-destructive" />
                  <p className="text-xs text-destructive">{loadError}</p>
                  <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary">
                    <RefreshCw size={12} />
                    Retry
                  </button>
                </div>
              )}

              {!loading && !loadError && filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-10">No templates match your filters.</p>
              )}

              {filtered.map((template) => (
                <button
                  key={`${template.id}@${template.version}`}
                  onClick={() => setSelectedId(template.id)}
                  className={[
                    'w-full text-left rounded-2xl border p-3 transition-all',
                    selected?.id === template.id ? 'border-primary/50 bg-primary/10' : 'border-transparent hover:border-border hover:bg-muted/40',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{template.name}</p>
                        {template.featured && <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Featured</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">v{template.version} - {template.industries.join(', ')}</p>
                    </div>
                    {selected?.id === template.id && <Check size={14} className="text-primary shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-5">
            {!selected && !loading && (
              <div className="h-full flex items-center justify-center text-center text-muted-foreground text-sm">
                Select a template to preview the generated flow.
              </div>
            )}

            {selected && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{selected.emoji}</span>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{selected.name}</h3>
                        <p className="text-sm text-muted-foreground">{selected.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selected.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <Metric label="Nodes" value={selected.nodes.length} />
                  <Metric label="Edges" value={selected.edges.length} />
                  <Metric label="Triggers" value={selected.triggers.length} />
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Trigger keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.triggers.map(trigger => (
                      <span key={trigger.id} className="px-2 py-1 rounded-lg bg-card border border-border text-xs text-foreground">
                        {trigger.type}: {trigger.value ?? 'default'}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Flow preview</p>
                  <div className="space-y-2">
                    {selected.nodes.map(node => (
                      <div key={node.id} className="rounded-2xl border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-foreground">{node.label}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{node.type}</p>
                          </div>
                          {node.messageMeta && (
                            <div className="flex gap-1.5">
                              <span className="px-2 py-0.5 rounded-full bg-muted text-[9px] font-bold uppercase text-muted-foreground">
                                {node.messageMeta.category}
                              </span>
                              {node.messageMeta.outboundApprovalRequired && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[9px] font-bold uppercase text-amber-600">
                                  Approval
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {'text' in node.data && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{String(node.data.text)}</p>
                        )}
                        {'message' in node.data && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{String(node.data.message)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {applyError && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {applyError}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Created flows stay draft and template triggers stay inactive until you publish/enable them.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selected || applying}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {applying ? 'Applying...' : 'Use Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}
