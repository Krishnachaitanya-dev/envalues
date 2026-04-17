import { useCallback, useState } from 'react'
import { Plus, Zap, ArrowRight, Workflow } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/contexts/DashboardContext'
import { useFlowBuilder } from '@/hooks/useFlowBuilder'

export default function SimpleBuilderPage() {
  const navigate = useNavigate()
  const { user } = useDashboard()
  const fb = useFlowBuilder(user?.id ?? null)
  const [creating, setCreating] = useState(false)

  const handleCreateFlow = useCallback(async () => {
    setCreating(true)
    try {
      // createFlow returns the new Flow object.
      await fb.createFlow('New Conversation')
      // Flow is auto-selected inside useFlowBuilder; reload page to show it.
      navigate('/dashboard/builder', { replace: true })
    } finally {
      setCreating(false)
    }
  }, [fb.createFlow, navigate])

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-52px)] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold font-syne">Conversation Builder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Build your WhatsApp chatbot step by step</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs gap-1.5"
            onClick={() => navigate('/dashboard/builder/advanced')}
          >
            <Workflow className="h-3.5 w-3.5" />
            Advanced Builder
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleCreateFlow}
            disabled={creating || fb.loading}
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        </div>
      </div>

      {/* Body - flow list placeholder (enhanced in Slice 2) */}
      <div className="flex-1 overflow-y-auto p-6">
        {fb.loading ? (
          <div className="text-muted-foreground text-sm">Loading flows...</div>
        ) : fb.flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first conversation to get started.</p>
            </div>
            <Button onClick={handleCreateFlow} disabled={creating} className="gap-2">
              <Plus className="h-4 w-4" />
              Create conversation
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 max-w-2xl">
            {fb.flows.map((flow) => (
              <div
                key={flow.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-raised hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/dashboard/builder?flow=${flow.id}`)}
              >
                <div>
                  <p className="font-medium text-sm">{flow.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{flow.status}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
