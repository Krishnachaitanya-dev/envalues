import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-input text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'

  return (
    <div className="min-h-[100dvh] bg-background bg-noise flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10 relative overflow-hidden safe-area-page">
      <div className="absolute bottom-0 left-0 w-72 h-72 sm:w-[400px] sm:h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 sm:space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <img src="/envalues-logo.png" alt="Envalues" className="h-12 w-auto mx-auto" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 space-y-6">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 size={48} className="text-primary mx-auto" />
              <h2 className="font-display font-bold text-2xl text-foreground">Check your email</h2>
              <p className="text-muted-foreground text-sm">
                We've sent a reset link to<br />
                <span className="text-primary font-medium">{email}</span>
              </p>
              <Link to="/login" className="text-primary hover:underline text-sm font-medium">← Back to Login</Link>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="font-display font-bold text-2xl text-foreground">Reset your password</h2>
                <p className="text-muted-foreground text-sm mt-1">Enter your email and we'll send a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} placeholder="you@example.com" />
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">{error}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold hover:scale-[1.03] hover:glow-green transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2">
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  Send Reset Link
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
