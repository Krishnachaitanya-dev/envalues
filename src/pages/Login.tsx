import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(f => ({ ...f, [field]: e.target.value }))

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
      if (error) throw error
      navigate('/dashboard')
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
      {/* green orb */}
      <div className="absolute top-0 right-0 w-72 h-72 sm:w-[500px] sm:h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 sm:space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <img src="/envalues-logo.png" alt="Envalues" className="h-12 w-auto mx-auto" />
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 space-y-6">
          <div className="text-center">
            <h2 className="font-display font-bold text-2xl text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1">Login to manage your chatbot</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
              <input type="email" value={formData.email} onChange={update('email')} required className={inputCls} placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={formData.password}
                  onChange={update('password')}
                  required
                  className={inputCls + ' pr-10'}
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold hover:scale-[1.03] hover:glow-green transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Login
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">Sign up</Link>
          </p>

          <p className="text-center text-xs text-muted-foreground/60">By continuing, you agree to our Terms</p>
        </div>
      </div>
    </div>
  )
}
