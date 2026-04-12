import { useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { Flow, FlowNode, NodeType } from '@/integrations/supabase/flow-types'

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1'

interface NodeConfigPanelProps {
  node: FlowNode | null
  flows: Flow[]
  allNodes: FlowNode[]
  onClose: () => void
  onUpdateConfig: (nodeId: string, params: Partial<Pick<FlowNode, 'label' | 'config'>>) => Promise<void>
  onDeleteNode: (nodeId: string) => Promise<void>
}

function fieldLabel(nodeType: NodeType) {
  return nodeType.charAt(0).toUpperCase() + nodeType.slice(1)
}

export default function NodeConfigPanel({
  node,
  flows,
  allNodes,
  onClose,
  onUpdateConfig,
  onDeleteNode,
}: NodeConfigPanelProps) {
  const [label, setLabel] = useState('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!node) return
    setLabel(node.label ?? '')
    setConfig(node.config ?? {})
  }, [node?.id])

  const setField = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!node) return
    setSaving(true)
    try {
      await onUpdateConfig(node.id, {
        label: label.trim() || null,
        config,
      })
    } finally {
      setSaving(false)
    }
  }

  if (!node) {
    return (
      <aside className="w-72 shrink-0 border-l border-border bg-surface-raised flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center px-6">
          Select a node to edit its label and configuration.
        </p>
      </aside>
    )
  }

  const nodeType = node.node_type

  return (
    <aside className="w-72 shrink-0 border-l border-border bg-surface-raised flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{fieldLabel(nodeType)} node</p>
          <h2 className="text-sm font-bold text-foreground">Configure node</h2>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <label className={labelCls}>Label</label>
          <input className={inputCls} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={`${fieldLabel(nodeType)} label`} />
        </div>

        {nodeType === 'start' && (
          <div>
            <label className={labelCls}>Greeting message</label>
            <textarea className={inputCls} rows={4} value={String(config.greeting_message ?? '')} onChange={(event) => setField('greeting_message', event.target.value)} placeholder="Optional welcome text" />
          </div>
        )}

        {nodeType === 'message' && (
          <>
            <div>
              <label className={labelCls}>Message text</label>
              <textarea className={inputCls} rows={5} value={String(config.text ?? '')} onChange={(event) => setField('text', event.target.value)} placeholder="Text to send" />
            </div>
            <div>
              <label className={labelCls}>Media URL</label>
              <input className={inputCls} value={String(config.media_url ?? '')} onChange={(event) => setField('media_url', event.target.value || undefined)} placeholder="https://..." />
            </div>
            <div>
              <label className={labelCls}>Media type</label>
              <select className={inputCls} value={String(config.media_type ?? '')} onChange={(event) => setField('media_type', event.target.value || undefined)}>
                <option value="">None</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
              </select>
            </div>
          </>
        )}

        {nodeType === 'input' && (
          <>
            <div>
              <label className={labelCls}>Prompt</label>
              <textarea className={inputCls} rows={4} value={String(config.prompt ?? '')} onChange={(event) => setField('prompt', event.target.value)} placeholder="Ask the customer a question" />
            </div>
            <div>
              <label className={labelCls}>Variable name</label>
              <input className={inputCls} value={String(config.store_as ?? '')} onChange={(event) => setField('store_as', event.target.value)} placeholder="customer_answer" />
            </div>
            <div>
              <label className={labelCls}>Timeout seconds</label>
              <input type="number" className={inputCls} min={0} value={Number(config.timeout_secs ?? 300)} onChange={(event) => setField('timeout_secs', Number(event.target.value))} />
            </div>
          </>
        )}

        {nodeType === 'condition' && (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Condition logic lives on outgoing edges. Select an edge from this node to configure matching rules.
              </p>
          </div>
        )}

        {nodeType === 'api' && (
          <>
            <div>
              <label className={labelCls}>URL</label>
              <input className={inputCls} value={String(config.url ?? '')} onChange={(event) => setField('url', event.target.value)} placeholder="https://api.example.com" />
            </div>
            <div>
              <label className={labelCls}>Method</label>
              <select className={inputCls} value={String(config.method ?? 'GET')} onChange={(event) => setField('method', event.target.value)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Body</label>
              <textarea className={inputCls} rows={4} value={String(config.body_template ?? '')} onChange={(event) => setField('body_template', event.target.value)} placeholder="JSON request body template" />
            </div>
            <div>
              <label className={labelCls}>Response variable</label>
              <input className={inputCls} value={String(config.response_variable ?? '')} onChange={(event) => setField('response_variable', event.target.value)} placeholder="api_response" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Timeout seconds</label>
                <input type="number" min={1} className={inputCls} value={Number(config.timeout_secs ?? 10)} onChange={(event) => setField('timeout_secs', Number(event.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Retry count</label>
                <input type="number" min={0} className={inputCls} value={Number(config.retry_count ?? 2)} onChange={(event) => setField('retry_count', Number(event.target.value))} />
              </div>
            </div>
          </>
        )}

        {nodeType === 'delay' && (
          <div>
            <label className={labelCls}>Seconds</label>
            <input type="number" min={0} className={inputCls} value={Number(config.delay_secs ?? 5)} onChange={(event) => setField('delay_secs', Number(event.target.value))} />
          </div>
        )}

        {nodeType === 'jump' && (
          <div>
            <label className={labelCls}>Target node</label>
            <select className={inputCls} value={String(config.target_node_id ?? '')} onChange={(event) => setField('target_node_id', event.target.value)}>
              <option value="">Choose a node</option>
              {allNodes.filter((item) => item.id !== node.id).map((item) => (
                <option key={item.id} value={item.id}>{item.label || fieldLabel(item.node_type)}</option>
              ))}
            </select>
          </div>
        )}

        {nodeType === 'subflow' && (
          <div>
            <label className={labelCls}>Target flow</label>
            <select className={inputCls} value={String(config.subflow_id ?? '')} onChange={(event) => setField('subflow_id', event.target.value)}>
              <option value="">Choose a flow</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>{flow.name}</option>
              ))}
            </select>
            <label className={`${labelCls} mt-3`}>Return mode</label>
            <select className={inputCls} value={String(config.return_mode ?? 'auto')} onChange={(event) => setField('return_mode', event.target.value)}>
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        )}

        {nodeType === 'handoff' && (
          <>
            <div>
              <label className={labelCls}>Department</label>
              <input className={inputCls} value={String(config.department ?? 'support')} onChange={(event) => setField('department', event.target.value)} placeholder="support" />
            </div>
            <div>
              <label className={labelCls}>Handoff message</label>
              <textarea className={inputCls} rows={4} value={String(config.message ?? '')} onChange={(event) => setField('message', event.target.value)} placeholder="A human will join shortly." />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={Boolean(config.allow_resume ?? false)} onChange={(event) => setField('allow_resume', event.target.checked)} />
              Allow resume after handoff
            </label>
            <div>
              <label className={labelCls}>Queue strategy</label>
              <input className={inputCls} value={String(config.queue_strategy ?? 'round_robin')} onChange={(event) => setField('queue_strategy', event.target.value)} placeholder="round_robin" />
            </div>
            <div>
              <label className={labelCls}>Timeout hours</label>
              <input type="number" min={1} className={inputCls} value={Number(config.handoff_timeout_hours ?? 24)} onChange={(event) => setField('handoff_timeout_hours', Number(event.target.value))} />
            </div>
          </>
        )}

        {nodeType === 'end' && (
          <div>
            <label className={labelCls}>Farewell message</label>
            <textarea className={inputCls} rows={4} value={String(config.farewell_message ?? '')} onChange={(event) => setField('farewell_message', event.target.value)} placeholder="Optional goodbye text" />
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-border flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save node'}
        </button>
        <button
          onClick={() => { if (confirm('Delete this node?')) void onDeleteNode(node.id) }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
        >
          <Trash2 size={13} />
          Delete node
        </button>
      </div>
    </aside>
  )
}
