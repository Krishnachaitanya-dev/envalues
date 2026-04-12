import { useState } from 'react'
import { Send, FileText, Plus, Trash2, Loader2, Play, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'
import { useBroadcastData, templateSchema, campaignSchema, BroadcastTemplate, BroadcastCampaign } from '@/hooks/useBroadcastData'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { z } from 'zod'

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BroadcastCampaign['status'] }) {
  const map = {
    draft:      { label: 'Draft',      icon: Clock,         cls: 'bg-muted text-muted-foreground' },
    processing: { label: 'Sending…',   icon: Loader2,       cls: 'bg-amber-500/10 text-amber-400' },
    completed:  { label: 'Completed',  icon: CheckCircle2,  cls: 'bg-green-500/10 text-green-400' },
    partial:    { label: 'Partial',    icon: AlertTriangle, cls: 'bg-amber-500/10 text-amber-400' },
    failed:     { label: 'Failed',     icon: XCircle,       cls: 'bg-destructive/10 text-destructive' },
  }
  const { label, icon: Icon, cls } = map[status] ?? map.draft
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon size={11} className={status === 'processing' ? 'animate-spin' : ''} />
      {label}
    </span>
  )
}

// ── Add Template Form ─────────────────────────────────────────────────────────

type TemplateForm = z.infer<typeof templateSchema>
const EMPTY_TEMPLATE: TemplateForm = { template_name: '', display_name: '', language_code: 'en', body_preview: '', parameter_count: 0, category: 'marketing' }

function TemplatesTab({ ownerId }: { ownerId: string }) {
  const { templates, loadingTemplates, addTemplate, deleteTemplate, saving, refreshTemplates } = useBroadcastData(ownerId, null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TemplateForm>(EMPTY_TEMPLATE)

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all'
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await addTemplate(form)
    if (ok) { setForm(EMPTY_TEMPLATE); setShowForm(false) }
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300 leading-relaxed">
        <strong>Before adding a template:</strong> Create and get it approved in{' '}
        <strong>Meta Business Manager → WhatsApp → Message Templates</strong>.
        Once approved, register it here using the exact template name.
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={refreshTemplates} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
            <Plus size={13} /> Add Template
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h4 className="font-semibold text-sm text-foreground">Register Approved Template</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Template Name (exact Meta name) *</label>
              <input className={inputCls} placeholder="e.g. order_confirmation" value={form.template_name}
                onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Display Name *</label>
              <input className={inputCls} placeholder="e.g. Order Confirmation" value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Language Code *</label>
              <select className={inputCls} value={form.language_code} onChange={e => setForm(f => ({ ...f, language_code: e.target.value }))}>
                <option value="en">en</option>
                <option value="en_US">en_US</option>
                <option value="hi">hi (Hindi)</option>
                <option value="te">te (Telugu)</option>
                <option value="ta">ta (Tamil)</option>
                <option value="kn">kn (Kannada)</option>
                <option value="mr">mr (Marathi)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}>
                <option value="marketing">Marketing</option>
                <option value="utility">Utility</option>
                <option value="authentication">Authentication</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Number of Parameters (&#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;…)</label>
              <input type="number" min={0} max={20} className={inputCls} value={form.parameter_count}
                onChange={e => setForm(f => ({ ...f, parameter_count: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Body Preview (paste template body text)</label>
            <textarea rows={3} className={inputCls} placeholder="Hi {{1}}, your order {{2}} has been confirmed!"
              value={form.body_preview} onChange={e => setForm(f => ({ ...f, body_preview: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Template
            </button>
          </div>
        </form>
      )}

      {/* Templates list */}
      {loadingTemplates ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-border">
          <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No templates yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your Meta-approved templates above</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Display Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Template Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Lang</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Params</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr key={t.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{t.display_name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{t.template_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.language_code}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{t.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.parameter_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Campaigns Tab ─────────────────────────────────────────────────────────────

type CampaignForm = z.infer<typeof campaignSchema>
const EMPTY_CAMPAIGN: CampaignForm = { template_id: '', recipient_source: 'contacts', manual_phones: '', template_params: [] }

function CampaignsTab({ ownerId, chatbotId }: { ownerId: string; chatbotId: string | null }) {
  const { templates, campaigns, loadingCampaigns, createCampaign, launchCampaign, saving, launching, refreshCampaigns } = useBroadcastData(ownerId, chatbotId)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CampaignForm>(EMPTY_CAMPAIGN)

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all'
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

  const selectedTemplate = templates.find(t => t.id === form.template_id)

  // Live preview: replace {{N}} with param values
  const livePreview = selectedTemplate?.body_preview?.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const val = form.template_params?.[parseInt(n) - 1]
    return val ? `[${val}]` : `{{${n}}}`
  }) ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const campaign = await createCampaign(form)
    if (campaign) { setForm(EMPTY_CAMPAIGN); setShowForm(false) }
  }

  const setParam = (index: number, value: string) => {
    setForm(f => {
      const params = [...(f.template_params ?? [])]
      params[index] = value
      return { ...f, template_params: params }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={refreshCampaigns} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
            <Plus size={13} /> New Campaign
          </button>
        </div>
      </div>

      {templates.length === 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          You need at least one template before creating a campaign. Go to the <strong>Templates</strong> tab first.
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h4 className="font-semibold text-sm text-foreground">New Broadcast Campaign</h4>

          <div>
            <label className={labelCls}>Template *</label>
            <select className={inputCls} value={form.template_id}
              onChange={e => setForm(f => ({ ...f, template_id: e.target.value, template_params: [] }))} required>
              <option value="">Select a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.display_name} ({t.template_name})</option>)}
            </select>
          </div>

          {/* Live preview */}
          {selectedTemplate?.body_preview && (
            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Preview</p>
              <p className="text-sm text-foreground">{livePreview}</p>
            </div>
          )}

          {/* Parameter inputs */}
          {selectedTemplate && selectedTemplate.parameter_count > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Template Parameters</p>
              {Array.from({ length: selectedTemplate.parameter_count }).map((_, i) => (
                <div key={i}>
                  <label className={labelCls}>&#123;&#123;{i + 1}&#125;&#125;</label>
                  <input className={inputCls} placeholder={`Value for {{${i + 1}}}`}
                    value={form.template_params?.[i] ?? ''}
                    onChange={e => setParam(i, e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {/* Recipients */}
          <div>
            <label className={labelCls}>Recipients</label>
            <div className="flex gap-3">
              {(['contacts', 'manual'] as const).map(src => (
                <label key={src} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="recipient_source" value={src}
                    checked={form.recipient_source === src}
                    onChange={() => setForm(f => ({ ...f, recipient_source: src }))}
                    className="accent-primary" />
                  <span className="text-sm text-foreground capitalize">
                    {src === 'contacts' ? 'All contacts' : 'Manual list'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {form.recipient_source === 'manual' && (
            <div>
              <label className={labelCls}>Phone Numbers (one per line or comma-separated, with country code)</label>
              <textarea rows={5} className={inputCls} placeholder="919876543210&#10;918765432109&#10;917654321098"
                value={form.manual_phones}
                onChange={e => setForm(f => ({ ...f, manual_phones: e.target.value }))} />
            </div>
          )}

          {form.recipient_source === 'contacts' && !chatbotId && (
            <p className="text-xs text-amber-400">No active chatbot found — contacts cannot be loaded.</p>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || templates.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create Campaign
            </button>
          </div>
        </form>
      )}

      {/* Campaign list */}
      {loadingCampaigns ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-border">
          <Send size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No campaigns yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first broadcast campaign above</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Sent / Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Failed</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={c.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{c.display_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.template_name}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-foreground">{c.sent_count} / {c.total_count || '—'}</td>
                  <td className="px-4 py-3 text-destructive">{c.failed_count > 0 ? c.failed_count : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === 'draft' && (
                      <button
                        onClick={() => launchCampaign(c.id)}
                        disabled={launching === c.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all ml-auto">
                        {launching === c.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Send Now
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BroadcastPage() {
  const { ownerData, chatbot } = useDashboard()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Broadcast</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Send WhatsApp template messages to your contacts outside the 24-hour window
        </p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <FileText size={13} /> Templates
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-1.5">
            <Send size={13} /> Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {ownerData?.id ? (
            <TemplatesTab ownerId={ownerData.id} />
          ) : (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          {ownerData?.id ? (
            <CampaignsTab ownerId={ownerData.id} chatbotId={chatbot?.id ?? null} />
          ) : (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
