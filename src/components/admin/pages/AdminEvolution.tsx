import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, QrCode, RefreshCw, Trash2, Loader2, Copy, Zap, MessageSquare, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import AdminEvolutionInbox from './AdminEvolutionInbox'
import AdminEvolutionScheduler from './AdminEvolutionScheduler'

const EVOLUTION_URL = 'http://localhost:8081'
const EVOLUTION_KEY = 'alachat-evolution-dev-key'
const INSTANCE_NAME = 'alachat-admin'

const evo = async (path: string, method = 'GET', body?: object) => {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    method,
    headers: { 'apikey': EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

type ConnectionState = 'open' | 'close' | 'connecting' | 'unknown'
type Tab = 'connection' | 'inbox' | 'scheduler'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'connection', label: 'Connection',  icon: Zap },
  { id: 'inbox',      label: 'Inbox',       icon: MessageSquare },
  { id: 'scheduler',  label: 'Scheduler',   icon: Calendar },
]

export default function AdminEvolution() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('connection')
  const [status, setStatus] = useState<ConnectionState>('unknown')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const checkStatus = async () => {
    setChecking(true)
    try {
      const data = await evo(`/instance/connectionState/${INSTANCE_NAME}`)
      const state: ConnectionState = data?.instance?.state ?? 'unknown'
      setStatus(state)
      if (state === 'open') { setQrCode(null); stopPoll() }
    } catch {
      setStatus('unknown')
    } finally { setChecking(false) }
  }

  const startPoll = () => {
    stopPoll()
    pollRef.current = setInterval(checkStatus, 4000)
  }

  useEffect(() => {
    checkStatus()
    return () => stopPoll()
  }, [])

  const createAndConnect = async () => {
    setLoading(true)
    setQrCode(null)
    try {
      try {
        await evo('/instance/create', 'POST', {
          instanceName: INSTANCE_NAME,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        })
      } catch (e: any) {
        if (!e.message.includes('already')) throw e
      }
      const qr = await evo(`/instance/connect/${INSTANCE_NAME}`)
      if (qr?.base64) {
        setQrCode(qr.base64)
        setStatus('connecting')
        startPoll()
        toast({ title: 'QR Code ready', description: 'Scan with your WhatsApp' })
      } else {
        throw new Error('No QR code returned')
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  const disconnect = async () => {
    try {
      await evo(`/instance/logout/${INSTANCE_NAME}`, 'DELETE')
      setStatus('close')
      setQrCode(null)
      stopPoll()
      toast({ title: 'Disconnected' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(EVOLUTION_KEY)
    toast({ title: 'API key copied' })
  }

  const isConnected = status === 'open'

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Evolution API</h1>
        <p className="text-muted-foreground text-sm mt-1">WhatsApp inbox, reminders & connection management</p>
      </div>

      {/* Connection status bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-2xl">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isConnected ? 'bg-green-500 animate-pulse' :
          status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-muted-foreground/30'
        }`} />
        <div className="flex items-center gap-2">
          {isConnected
            ? <Wifi size={14} className="text-green-500" />
            : <WifiOff size={14} className="text-muted-foreground" />
          }
          <span className="text-sm font-medium text-foreground">
            {isConnected ? 'Connected' : status === 'connecting' ? 'Waiting for QR scan…' : status === 'close' ? 'Disconnected' : 'Unknown'}
          </span>
          <span className="text-xs text-muted-foreground">· {INSTANCE_NAME}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={checkStatus} disabled={checking} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
          </button>
          {!isConnected ? (
            <button onClick={createAndConnect} disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition disabled:opacity-50">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />}
              {loading ? 'Getting QR…' : 'Connect'}
            </button>
          ) : (
            <button onClick={disconnect}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-destructive/10 text-destructive font-semibold text-xs hover:bg-destructive/20 transition">
              <Trash2 size={13} /> Disconnect
            </button>
          )}
        </div>
      </div>

      {/* QR Code */}
      {qrCode && !isConnected && (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <QrCode size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Scan with WhatsApp</h2>
          </div>
          <p className="text-xs text-muted-foreground text-center">WhatsApp → Settings → Linked Devices → Link a device</p>
          <div className="bg-white p-3 rounded-2xl shadow-lg">
            <img src={qrCode} alt="QR Code" className="w-52 h-52" />
          </div>
          <div className="flex items-center gap-2 text-yellow-500 text-xs">
            <Loader2 size={13} className="animate-spin" /> Waiting for scan…
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'connection' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Config info */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground text-sm mb-4">Configuration</h2>
            <div className="space-y-3">
              {[
                { label: 'Server URL', value: EVOLUTION_URL },
                { label: 'Instance', value: INSTANCE_NAME },
                { label: 'Version', value: 'v2.3.7' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm font-mono text-foreground bg-muted/50 px-2.5 py-1.5 rounded-lg">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">API Key</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-foreground bg-muted/50 px-2.5 py-1.5 rounded-lg flex-1 truncate">{EVOLUTION_KEY}</p>
                  <button onClick={copyKey} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Webhook setup info */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground text-sm mb-4">Webhook Setup</h2>
            <div className="space-y-3 text-xs text-muted-foreground">
              <p>To receive messages in the Inbox, set the webhook URL in Evolution API:</p>
              <div className="bg-muted/50 rounded-lg px-3 py-2 font-mono text-[11px] text-foreground break-all">
                {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`}
              </div>
              <p className="text-[11px]">Add this to your Evolution API <code className="bg-muted px-1 rounded">.env</code>:</p>
              <pre className="bg-muted/50 rounded-lg px-3 py-2 text-[10px] text-foreground overflow-x-auto">{`WEBHOOK_GLOBAL_URL=<above URL>
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_EVENTS_MESSAGES_UPSERT=true`}</pre>
            </div>
          </div>
        </div>
      )}

      {tab === 'inbox' && <AdminEvolutionInbox />}
      {tab === 'scheduler' && <AdminEvolutionScheduler />}
    </div>
  )
}
