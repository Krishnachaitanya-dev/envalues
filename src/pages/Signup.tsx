import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

// Zod validation schema for signup
const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirm: z.string()
}).refine(data => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm']
});

function getStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const strengthColors = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-primary', 'bg-primary'];
const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const strength = getStrength(form.password);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    // Clear validation error for this field when user types
    setValidationErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    // Validate with Zod
    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName } },
      });
      if (error) throw error;
      toast({ title: 'Account created!', description: 'Check your email to verify.' });
      navigate('/login');
    } catch (err: any) {
      toast({ title: 'Signup failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-input text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all";
  const errorInputCls = "w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-destructive text-foreground focus:border-destructive focus:ring-2 focus:ring-destructive/20 outline-none transition-all";

  return (
    <div className="min-h-screen bg-background bg-noise flex items-center justify-center px-4 relative">
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 animate-fade-in-up">
        <div className="text-center space-y-2">
          <img src="/envalues-logo.png" alt="Envalues" className="h-12 w-auto mx-auto" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="font-display font-bold text-2xl text-foreground">Create your account</h2>
            <p className="text-muted-foreground text-sm mt-1">Free to sign up. Pay only when you go live.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
              <input 
                type="text" 
                value={form.fullName} 
                onChange={update('fullName')} 
                required 
                className={validationErrors.fullName ? errorInputCls : inputCls} 
                placeholder="John Doe" 
              />
              {validationErrors.fullName && (
                <p className="text-destructive text-xs mt-1">{validationErrors.fullName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
              <input 
                type="email" 
                value={form.email} 
                onChange={update('email')} 
                required 
                className={validationErrors.email ? errorInputCls : inputCls} 
                placeholder="you@example.com" 
              />
              {validationErrors.email && (
                <p className="text-destructive text-xs mt-1">{validationErrors.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Password</label>
              <input 
                type="password" 
                value={form.password} 
                onChange={update('password')} 
                required 
                minLength={12} 
                className={validationErrors.password ? errorInputCls : inputCls} 
                placeholder="Min 12 characters" 
              />
              {validationErrors.password && (
                <p className="text-destructive text-xs mt-1">{validationErrors.password}</p>
              )}
              {form.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColors[strength] : 'bg-muted'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{strengthLabels[strength]}</span>
                </div>
              )}
              <p className="text-muted-foreground text-xs mt-1">
                Must include: uppercase, lowercase, number, and special character
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Confirm Password</label>
              <input 
                type="password" 
                value={form.confirm} 
                onChange={update('confirm')} 
                required 
                className={validationErrors.confirm ? errorInputCls : inputCls} 
                placeholder="Re-enter password" 
              />
              {validationErrors.confirm && (
                <p className="text-destructive text-xs mt-1">{validationErrors.confirm}</p>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold hover:scale-[1.03] hover:glow-green transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2">
              {loading && <Loader2 size={18} className="animate-spin" />}
              Create Account
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
