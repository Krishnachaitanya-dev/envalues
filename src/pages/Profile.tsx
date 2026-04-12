import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, ArrowLeft, LogOut } from 'lucide-react'
import { z } from 'zod'

// Zod validation schemas
const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  whatsapp_business_number: z.string().min(10, 'Phone number must be at least 10 digits').max(20, 'Phone number too long')
});

const passwordSchema = z.object({
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({ full_name: '', whatsapp_business_number: '', email: '' })
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUser(user)
      const { data, error } = await supabase.from('owners').select('id, email, full_name, whatsapp_business_number, created_at, updated_at').eq('id', user.id).single()
      if (error) throw error
      setFormData({ full_name: data.full_name || '', whatsapp_business_number: data.whatsapp_business_number || '', email: data.email || '' })
    } catch (err: any) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors({})
    setError(null)
    setSuccess(null)
    
    // Validate with Zod
    const result = profileSchema.safeParse({ full_name: formData.full_name, whatsapp_business_number: formData.whatsapp_business_number })
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message
      })
      setValidationErrors(errors)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('owners').update({ full_name: formData.full_name, whatsapp_business_number: formData.whatsapp_business_number }).eq('id', user.id)
      if (error) throw error
      setSuccess('Profile updated successfully!')
    } catch (err: any) { setError(err.message) } finally { setSaving(false) }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors({})
    setError(null)
    setSuccess(null)
    
    // Validate with Zod
    const result = passwordSchema.safeParse(passwordForm)
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message
      })
      setValidationErrors(errors)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
      if (error) throw error
      setSuccess('Password updated successfully!')
      setPasswordForm({ newPassword: '', confirmPassword: '' })
    } catch (err: any) { setError(err.message) } finally { setSaving(false) }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login') }

  const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-input text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'
  const errorInputCls = 'w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-destructive text-foreground focus:border-destructive focus:ring-2 focus:ring-destructive/20 outline-none transition-all'
  const disabledInputCls = 'w-full px-4 py-2.5 rounded-xl bg-muted border border-input text-muted-foreground cursor-not-allowed outline-none'

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background bg-noise">
      {/* Navbar */}
      <nav className="h-16 bg-surface-raised border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-primary hover:underline text-sm font-medium">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 text-destructive hover:text-destructive/80 text-sm font-medium transition-colors">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <h1 className="font-display font-bold text-2xl text-foreground">Account Settings</h1>

        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">{error}</div>}
        {success && <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-xl text-sm">{success}</div>}

        {/* Profile Info */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-display font-bold text-lg text-foreground">Profile Information</h2>
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display font-bold text-2xl">
            {formData.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Email (cannot change)</label>
              <input type="email" value={formData.email} disabled className={disabledInputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
              <input 
                type="text" 
                value={formData.full_name} 
                onChange={e => setFormData({ ...formData, full_name: e.target.value })} 
                required 
                className={validationErrors.full_name ? errorInputCls : inputCls} 
              />
              {validationErrors.full_name && (
                <p className="text-destructive text-xs mt-1">{validationErrors.full_name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">WhatsApp Business Number</label>
              <input 
                type="text" 
                value={formData.whatsapp_business_number} 
                onChange={e => setFormData({ ...formData, whatsapp_business_number: e.target.value })} 
                required 
                className={validationErrors.whatsapp_business_number ? errorInputCls : inputCls} 
                placeholder="+91 98765 43210" 
              />
              {validationErrors.whatsapp_business_number && (
                <p className="text-destructive text-xs mt-1">{validationErrors.whatsapp_business_number}</p>
              )}
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold hover:scale-[1.03] hover:glow-green transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-display font-bold text-lg text-foreground">Change Password</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">New Password</label>
              <input 
                type="password" 
                value={passwordForm.newPassword} 
                onChange={e => { setPasswordForm({ ...passwordForm, newPassword: e.target.value }); setValidationErrors(prev => ({ ...prev, newPassword: '' })) }} 
                required 
                minLength={12} 
                className={validationErrors.newPassword ? errorInputCls : inputCls} 
                placeholder="Min 12 characters" 
              />
              {validationErrors.newPassword && (
                <p className="text-destructive text-xs mt-1">{validationErrors.newPassword}</p>
              )}
              <p className="text-muted-foreground text-xs mt-1">
                Must include: uppercase, lowercase, number, and special character
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Confirm Password</label>
              <input 
                type="password" 
                value={passwordForm.confirmPassword} 
                onChange={e => { setPasswordForm({ ...passwordForm, confirmPassword: e.target.value }); setValidationErrors(prev => ({ ...prev, confirmPassword: '' })) }} 
                required 
                className={validationErrors.confirmPassword ? errorInputCls : inputCls} 
                placeholder="Re-enter password" 
              />
              {validationErrors.confirmPassword && (
                <p className="text-destructive text-xs mt-1">{validationErrors.confirmPassword}</p>
              )}
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold hover:scale-[1.03] hover:glow-green transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Update Password
            </button>
          </form>
        </div>

        {/* Account ID */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display font-bold text-lg text-foreground mb-2">Account ID</h2>
          <p className="text-muted-foreground text-xs font-mono">{user?.id}</p>
        </div>

        {/* Danger Zone */}
        <div className="border border-destructive/30 rounded-2xl p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-destructive">Danger Zone</h2>
          <p className="text-muted-foreground text-sm">Once you delete your account, there is no going back.</p>
          <button className="px-6 py-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-bold hover:bg-destructive/20 transition-all text-sm">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}
