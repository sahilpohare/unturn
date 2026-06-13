import { useState } from 'react';

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
    <div style={{
      display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
      background: '#0f0f1a', fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12,
        padding: 40, width: 360,
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚡</div>
          <div style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700 }}>Unturn</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Flow automation platform</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#1e1e2e', borderRadius: 8, padding: 4, marginBottom: 24 }}>
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: mode === m ? '#2563eb' : 'transparent',
                color: mode === m ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: '#dc262622', border: '1px solid #dc2626', borderRadius: 6,
              padding: '8px 12px', color: '#fca5a5', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px 0', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#3b82f6', fontSize: 12, textDecoration: 'none' }}
          >
            📖 API Docs ↗
          </a>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1e1e2e', border: '1px solid #2a2a3e',
  borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};
