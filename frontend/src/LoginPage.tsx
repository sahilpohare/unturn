import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  onLogin: (token: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = mode === 'login'
        ? '/api/auth/sign-in/email'
        : '/api/auth/sign-up/email';

      const body = mode === 'login'
        ? { email, password }
        : { email, password, name };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Authentication failed');
        return;
      }

      const token = data.token ?? data.session?.token ?? data.data?.token;
      if (!token) {
        setError('No token in response');
        return;
      }

      onLogin(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(var(--border-mid) 1px, transparent 1px), linear-gradient(90deg, var(--border-mid) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        opacity: 0.3,
      }} />

      <div className="relative w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Unturn
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Flow automation platform
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)' }}>
          {/* Mode toggle */}
          <div className="flex rounded-lg p-0.5 mb-6" style={{ background: 'var(--bg-elevated)' }}>
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-1.5 text-sm font-medium rounded-md transition-all"
                style={{
                  background: mode === m ? 'var(--bg-card)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: mode === m ? '1px solid var(--border-mid)' : '1px solid transparent',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1.5">
              <Label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
              />
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#ef444412', border: '1px solid #ef444440', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-2" style={{ background: 'var(--text-primary)', color: 'var(--bg-void)' }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>

        <div className="text-center mt-5">
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            API Docs
          </a>
        </div>
      </div>
    </div>
  );
}
