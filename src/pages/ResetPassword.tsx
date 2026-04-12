import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Loader2 } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) setError('Invalid or expired reset link. Please request a new one.')
      setSessionChecked(true)
    }
    check()
  }, [])

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); setLoading(false); return }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
    try {
      const { error } = await supabase.auth.updateUser({ password: formData.password })
      if (error) throw error
      navigate('/login')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-input text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background bg-noise flex items-center justify-center px-4 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <img src="/envalues-logo.png" alt="Envalues" className="h-12 w-auto mx-auto" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 space-y-6">{children}</div>
      </div>
    </div>
  )

  if (!sessionChecked) return shell(
    <div className="text-center space-y-4">
      <Loader2 size={32} className="animate-spin text-primary mx-auto" />
      <h2 className="font-display font-bold text-xl text-foreground">Verifying reset link…</h2>
    </div>
  )

  if (error && !formData.password) return shell(
    <div className="text-center space-y-4">
      <div className="text-4xl">❌</div>
      <h2 className="font-display font-bold text-xl text-destructive">Invalid Reset Link</h2>
      <p className="text-muted-foreground text-sm">{error}</p>
      <button onClick={() => navigate('/forgot-password')}
        className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold hover:scale-[1.03] hover:glow-green transition-all">
        Request New Reset Link
      </button>
    </div>
  )

  return shell(
    <>
      <div className="text-center">
        <h2 className="font-display font-bold text-2xl text-foreground">Set new password</h2>
        <p className="text-muted-foreground text-sm mt-1">Choose a strong new password</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">New Password</label>
          <input type="password" value={formData.password} onChange={update('password')} required minLength={6} className={inputCls} placeholder="Min 6 characters" />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Confirm Password</label>
          <input type="password" value={formData.confirmPassword} onChange={update('confirmPassword')} required className={inputCls} placeholder="Re-enter password" />
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold hover:scale-[1.03] hover:glow-green transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}
          Update Password
        </button>
      </form>
    </>
  )
}
