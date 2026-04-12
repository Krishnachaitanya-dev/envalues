import { useState } from 'react'
import {
  CreditCard, Zap, CheckCircle2, XCircle, Clock, AlertTriangle,
  Loader2, ChevronRight, CalendarDays, Hash, RefreshCw,
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboard } from '@/contexts/DashboardContext'

// ─── Plan features list ────────────────────────────────────────────────────

const PLAN_FEATURES = [
  'Unlimited WhatsApp messages',
  'Visual flow builder',
  'Interactive button menus',
  'Real-time chat preview',
  'WhatsApp Business API integration',
  'Auto-greeting & farewell messages',
  '24/7 bot uptime',
  'Dashboard analytics',
]

// ─── Status config ─────────────────────────────────────────────────────────

type SubStatus = 'active' | 'inactive' | 'paused' | 'cancelled' | 'none'

function getStatusConfig(status: SubStatus) {
  const map = {
    active:    { label: 'Active',     color: 'text-primary',    bg: 'bg-primary/10',     border: 'border-primary/20',    icon: CheckCircle2, dot: 'bg-primary animate-pulse' },
    inactive:  { label: 'Inactive',   color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border',          icon: Clock,        dot: 'bg-muted-foreground/40' },
    paused:    { label: 'Paused',     color: 'text-yellow-400', bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20', icon: Clock,        dot: 'bg-yellow-400' },
    cancelled: { label: 'Cancelled',  color: 'text-red-400',    bg: 'bg-red-500/10',     border: 'border-red-500/20',    icon: XCircle,      dot: 'bg-red-400' },
    none:      { label: 'No Plan',    color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border',          icon: AlertTriangle, dot: 'bg-muted-foreground/40' },
  }
  return map[status] ?? map.none
}

// ─── Billing period progress bar ──────────────────────────────────────────

function BillingPeriodBar({ start, end }: { start: string; end: string }) {
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  const today = new Date()
  const totalDays = differenceInDays(endDate, startDate)
  const elapsed = differenceInDays(today, startDate)
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)))
  const remaining = Math.max(0, differenceInDays(endDate, today))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{format(startDate, 'd MMM yyyy')}</span>
        <span className="font-medium text-foreground">{remaining} days remaining</span>
        <span>{format(endDate, 'd MMM yyyy')}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground text-right">{pct}% of billing period elapsed</p>
    </div>
  )
}

// ─── Cancel confirmation ───────────────────────────────────────────────────

function CancelConfirm({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Cancel your subscription?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your bot will stay live until the end of your current billing period. After that, it will stop responding to customers.
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Yes, cancel plan
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
        >
          Keep plan
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function BillingPage() {
  const {
    subscription,
    chatbot,
    handleGoLive,
    handleCancelSubscription,
    formatAmount,
    goLiveLoading,
  } = useDashboard()

  const [showCancel, setShowCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const status: SubStatus = subscription?.status ?? 'none'
  const cfg = getStatusConfig(status)
  const StatusIcon = cfg.icon
  const isActive = status === 'active'
  const canActivate = status === 'none' || status === 'inactive' || status === 'cancelled'

  const handleCancel = async () => {
    setCancelling(true)
    await handleCancelSubscription()
    setCancelling(false)
    setShowCancel(false)
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your plan and payment details</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-secondary/8 via-secondary/3 to-transparent">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
                <CreditCard size={18} className="text-secondary" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-foreground">WhatsApp Bot Plan</h2>
                <p className="text-muted-foreground text-[11px] mt-0.5">₹500 / month · Billed monthly via Razorpay</p>
              </div>
            </div>
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Billing period */}
          {isActive && subscription?.current_period_start && subscription?.current_period_end && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Billing Period</p>
              <BillingPeriodBar
                start={subscription.current_period_start}
                end={subscription.current_period_end}
              />
            </div>
          )}

          {/* Next billing */}
          {isActive && subscription?.current_period_end && (
            <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border border-border">
              <CalendarDays size={16} className="text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Next billing date</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {format(parseISO(subscription.current_period_end), 'd MMMM yyyy')}
                  <span className="text-muted-foreground font-normal ml-2 text-xs">· {formatAmount(subscription.amount)}</span>
                </p>
              </div>
            </div>
          )}

          {/* Subscription ID */}
          {subscription?.razorpay_subscription_id && (
            <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border border-border">
              <Hash size={16} className="text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Subscription ID</p>
                <code className="text-xs font-mono text-foreground mt-0.5 block truncate">
                  {subscription.razorpay_subscription_id}
                </code>
              </div>
            </div>
          )}

          {/* Paused notice */}
          {status === 'paused' && (
            <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <Clock size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-400">Subscription Paused</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your last payment failed. Razorpay will retry automatically. Your bot is paused until payment succeeds.
                </p>
              </div>
            </div>
          )}

          {/* Cancelled notice */}
          {status === 'cancelled' && subscription?.current_period_end && (
            <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
              <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">Subscription Cancelled</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your bot was active until {format(parseISO(subscription.current_period_end), 'd MMMM yyyy')}. Reactivate below to go live again.
                </p>
              </div>
            </div>
          )}

          {/* No subscription */}
          {status === 'none' && (
            <div className="flex items-start gap-3 p-4 bg-muted/40 border border-border rounded-xl">
              <AlertTriangle size={16} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                You don't have an active subscription. Activate your plan to start receiving WhatsApp messages.
              </p>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 pt-1">
            {canActivate && (
              <button
                onClick={handleGoLive}
                disabled={goLiveLoading}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {goLiveLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : (
                  <><Zap size={16} /> Activate Plan — ₹500/month</>
                )}
              </button>
            )}

            {status === 'paused' && (
              <button
                onClick={handleGoLive}
                disabled={goLiveLoading}
                className="w-full inline-flex items-center justify-center gap-2 bg-yellow-500 text-black px-4 py-3 rounded-xl text-sm font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {goLiveLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : (
                  <><RefreshCw size={16} /> Retry Payment</>
                )}
              </button>
            )}

            <AnimatePresence>
              {isActive && !showCancel && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCancel(true)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/5 border border-border hover:border-red-500/20 transition-all"
                >
                  Cancel subscription
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showCancel && (
                <CancelConfirm
                  onConfirm={handleCancel}
                  onClose={() => setShowCancel(false)}
                  loading={cancelling}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* What's included */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="font-display font-bold text-base text-foreground">What's included</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLAN_FEATURES.map(feature => (
            <div key={feature} className="flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-primary shrink-0" />
              <span className="text-sm text-foreground">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Support */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Need help with billing?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Contact us and we'll sort it out quickly.</p>
        </div>
        <a
          href="mailto:support@envalues.in"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Contact Support <ChevronRight size={13} />
        </a>
      </div>
    </div>
  )
}
