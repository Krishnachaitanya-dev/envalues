import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

type CallbackStatus = 'processing' | 'completed' | 'replace_required' | 'cancelled' | 'error'

const SUPABASE_FUNCTIONS_BASE = import.meta.env.VITE_SUPABASE_URL || 'https://tbfmturpclqponehhdjq.supabase.co'

export default function WhatsAppEmbeddedCallback() {
  const [status, setStatus] = useState<CallbackStatus>('processing')
  const [message, setMessage] = useState('Finalizing WhatsApp connection...')

  const params = useMemo(() => {
    const query = new URLSearchParams(window.location.search)
    return {
      state: query.get('state') ?? '',
      code: query.get('code') ?? '',
      error: query.get('error') ?? '',
      errorDescription: query.get('error_description') ?? '',
    }
  }, [])

  useEffect(() => {
    void finalizeConnect()
  }, [])

  const postToParent = (type: string, payload: Record<string, unknown> = {}) => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          source: 'whatsapp-embedded-signup',
          type,
          payload,
        }, window.location.origin)
      }
    } catch (error) {
      console.error('[whatsapp-embedded-callback] postMessage failed:', error)
    }
  }

  const closeSoon = () => {
    window.setTimeout(() => {
      window.close()
    }, 800)
  }

  const finalizeConnect = async () => {
    try {
      if (!params.state) {
        setStatus('error')
        setMessage('Missing connection state. Please restart from dashboard.')
        postToParent('error', { error: 'Missing state' })
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setStatus('error')
        setMessage('Session expired. Please login and reconnect.')
        postToParent('error', { error: 'Missing auth session' })
        return
      }

      const response = await fetch(`${SUPABASE_FUNCTIONS_BASE}/functions/v1/whatsapp-embedded-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          state: params.state,
          code: params.code,
          error: params.error || undefined,
          error_description: params.errorDescription || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (response.status === 409 && data?.error_code === 'replace_confirmation_required') {
        setStatus('replace_required')
        setMessage('Confirmation needed to replace existing WhatsApp credentials.')
        postToParent('replace_required', {
          state: data?.state || params.state,
          code: data?.code || params.code,
          message: data?.error || 'Confirmation required',
        })
        closeSoon()
        return
      }

      if (!response.ok) {
        setStatus('error')
        setMessage(data?.error || 'Failed to complete WhatsApp connection.')
        postToParent('error', { error: data?.error || `HTTP ${response.status}` })
        return
      }

      setStatus('completed')
      setMessage('WhatsApp connected successfully. Returning to dashboard...')
      postToParent('completed', data)
      closeSoon()
    } catch (error: any) {
      setStatus('error')
      setMessage(error?.message || 'Unexpected error while connecting WhatsApp.')
      postToParent('error', { error: error?.message || String(error) })
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/15 text-center">
        {status === 'processing' && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {status === 'completed' && <div className="text-4xl mb-3">OK</div>}
        {status === 'replace_required' && <div className="text-4xl mb-3">!</div>}
        {status === 'cancelled' && <div className="text-4xl mb-3">x</div>}
        {status === 'error' && <div className="text-4xl mb-3">x</div>}

        <h1 className="text-lg font-semibold text-foreground">WhatsApp Connect</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
