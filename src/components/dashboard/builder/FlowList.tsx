import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, Workflow, X } from 'lucide-react'
import type { Flow } from '@/integrations/supabase/flow-types'
import { cn } from '@/lib/utils'

interface FlowListProps {
  flows: Flow[]
  selectedFlowId: string | null
  onSelectFlow: (id: string) => Promise<void>
  onCreateFlow: (name: string) => Promise<void>
  onRenameFlow: (id: string, name: string) => Promise<void>
  onDeleteFlow: (id: string) => Promise<void>
  className?: string
}

export default function FlowList({
  flows,
  selectedFlowId,
  onSelectFlow,
  onCreateFlow,
  onRenameFlow,
  onDeleteFlow,
  className,
}: FlowListProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    try {
      await onCreateFlow(name)
      setNewName('')
      setCreating(false)
    } finally {
      setSaving(false)
    }
  }

  const startRename = (flow: Flow) => {
    setEditingId(flow.id)
    setEditName(flow.name)
  }

  const handleRename = async (flowId: string) => {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    try {
      await onRenameFlow(flowId, name)
      setEditingId(null)
      setEditName('')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (flow: Flow) => {
    if (!confirm(`Delete "${flow.name}" and all its nodes?`)) return
    await onDeleteFlow(flow.id)
  }

  return (
    <aside className={cn('w-64 shrink-0 border-r border-border bg-surface-raised flex flex-col overflow-hidden', className)}>
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Flows</p>
          <h2 className="text-sm font-bold text-foreground">Builder</h2>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
          title="Create flow"
        >
          <Plus size={15} />
        </button>
      </div>

      {creating && (
        <div className="p-3 border-b border-border bg-card/50 space-y-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate()
              if (event.key === 'Escape') setCreating(false)
            }}
            placeholder="Flow name"
            className="w-full px-3 py-2 rounded-lg bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {flows.length === 0 && !creating && (
          <div className="p-4 text-center">
            <Workflow size={28} className="mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">No flows yet.</p>
            <button onClick={() => setCreating(true)} className="mt-2 text-xs text-primary hover:underline">
              Create your first flow
            </button>
          </div>
        )}

        {flows.map((flow) => {
          const selected = flow.id === selectedFlowId
          const editing = flow.id === editingId

          return (
            <div
              key={flow.id}
              className={[
                'group rounded-xl border transition-all',
                selected ? 'bg-primary/10 border-primary/40' : 'bg-card/60 border-transparent hover:border-border hover:bg-card',
              ].join(' ')}
            >
              {editing ? (
                <div className="p-2 space-y-2">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleRename(flow.id)
                      if (event.key === 'Escape') setEditingId(null)
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-background border border-input text-xs text-foreground outline-none"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRename(flow.id)}
                      disabled={saving || !editName.trim()}
                      className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectFlow(flow.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') void onSelectFlow(flow.id)
                  }}
                  className="w-full text-left p-3 flex items-start gap-2 cursor-pointer"
                >
                  <Workflow size={15} className={selected ? 'text-primary mt-0.5' : 'text-muted-foreground mt-0.5'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{flow.name}</p>
                      {flow.status === 'published' && (
                        <span className="text-[9px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground capitalize">v{flow.version} - {flow.status}</p>
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        startRename(flow)
                      }}
                      className="w-6 h-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDelete(flow)
                      }}
                      className="w-6 h-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
