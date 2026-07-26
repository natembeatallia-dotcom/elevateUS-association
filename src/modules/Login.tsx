import { useState } from 'react';
import { Crown, Mail, Lock, ArrowRight, Eye, EyeOff, UserPlus, ArrowLeft } from 'lucide-react';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

export function Login() {
  const { signIn, refresh } = useApp();
  const { push } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      if (!email.trim() || !password) {
        push({ kind: 'error', message: 'Enter email and password' });
        return;
      }
      setLoading(true);
      const { error } = await signIn(email.trim(), password);
      setLoading(false);
      if (error) {
        push({ kind: 'error', message: 'Sign in failed', description: error });
      } else {
        push({ kind: 'success', message: 'Welcome back' });
      }
    } else {
      // Sign up
      if (!fullName.trim() || !email.trim() || password.length < 6) {
        push({ kind: 'error', message: 'Fill all fields (password min 6 chars)' });
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        // Create a profile row linked to the new auth user (role = Member, pending admin assignment)
        if (data.user) {
          await supabase.from('profiles').insert({
            user_id: data.user.id,
            full_name: fullName.trim(),
            email: email.trim(),
            role_id: 6, // Member
            join_date: new Date().toISOString().slice(0, 10),
            credit_score: 500,
            status: 'Active',
            is_system: false,
          });
        }
        push({
          kind: 'success',
          message: 'Account created',
          description: 'You are registered as a Member. An admin can assign your role later.',
        });
        await refresh();
        setMode('signin');
      } catch (err) {
        push({ kind: 'error', message: 'Sign up failed', description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50 p-4">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-success-100/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <Crown size={30} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">ElevateUS</h1>
          <p className="mt-1 text-sm text-ink-500">Association Management System</p>
        </div>

        <div className="card animate-scale-in p-7 shadow-pop">
          {mode === 'signin' ? (
            <>
              <h2 className="text-lg font-semibold text-ink-900">Sign in to your account</h2>
              <p className="mt-1 text-sm text-ink-500">Enter your credentials to continue</p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-500 transition hover:text-ink-800"
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
              <h2 className="text-lg font-semibold text-ink-900">Create your account</h2>
              <p className="mt-1 text-sm text-ink-500">
                Register as a member. An admin will assign your role.
              </p>
            </>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Full name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            )}
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder="you@elevateus.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus={mode === 'signin'}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input px-9"
                  placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition hover:text-ink-700"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : mode === 'signin' ? (
                <>Sign in <ArrowRight size={16} /></>
              ) : (
                <><UserPlus size={16} /> Create account</>
              )}
            </button>
          </form>

          {mode === 'signin' && (
            <button
              onClick={() => { setMode('signup'); setEmail(''); setPassword(''); setFullName(''); }}
              className="mt-4 w-full text-center text-xs font-medium text-brand-600 transition hover:text-brand-700"
            >
              Don't have an account? Create one
            </button>
          )}

</div>

        <p className="mt-6 text-center text-xs text-ink-400">
          © {new Date().getFullYear()} ElevateUS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
