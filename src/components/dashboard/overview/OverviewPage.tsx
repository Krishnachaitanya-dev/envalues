import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'

export default function OverviewPage() {
  const navigate = useNavigate()
  const { ownerData, hasWhatsappCreds, subscription } = useDashboard()

  const checks = [hasWhatsappCreds, !!subscription]
  const completedChecks = checks.filter(Boolean).length

  const checklist = [
    {
      label: 'Connect WhatsApp',
      desc: 'Add phone number & access token',
      done: hasWhatsappCreds,
      action: () => navigate('/dashboard/settings'),
    },
    {
      label: 'Build your first flow',
      desc: 'Create nodes and publish a flow',
      done: false,
      action: () => navigate('/dashboard/builder'),
    },
    {
      label: 'Activate subscription',
      desc: subscription ? 'Active' : 'Rs.500/month',
      done: !!subscription && subscription.status === 'active',
      action: undefined as (() => void) | undefined,
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {ownerData?.full_name ? `Welcome back, ${ownerData.full_name}` : 'Welcome back'}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-foreground">Setup checklist</h2>
          <span className="text-xs text-muted-foreground">{completedChecks}/{checklist.length} done</span>
        </div>
        {checklist.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? 'border-primary bg-primary/10' : 'border-border'}`}>
              {item.done && <Check size={11} className="text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            {!item.done && item.action && (
              <button onClick={item.action} className="text-xs text-primary hover:underline shrink-0">Set up</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
