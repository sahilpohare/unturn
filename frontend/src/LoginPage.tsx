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
      const url = mode === 'login' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? 'Authentication failed'); return; }
      const token = data.token ?? data.session?.token ?? data.data?.token;
      if (!token) { setError('No token in response'); return; }
      onLogin(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#040d1a', fontFamily: "'Rajdhani', system-ui, sans-serif", position: 'relative', overflow: 'hidden',
    }}>
      {/* Blueprint grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(#1a3a6e55 1px, transparent 1px), linear-gradient(90deg, #1a3a6e55 1px, transparent 1px)',
        backgroundSize: '40px 40px' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(#1a3a6e30 1px, transparent 1px), linear-gradient(90deg, #1a3a6e30 1px, transparent 1px)',
        backgroundSize: '200px 200px' }} />

      {/* Center glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, #4da6ff08 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: 380 }}>
        {/* Corner marks */}
        {[['0,0','top:0;left:0','borderTop','borderLeft'],['0,0','top:0;right:0','borderTop','borderRight'],
          ['0,0','bottom:0;left:0','borderBottom','borderLeft'],['0,0','bottom:0;right:0','borderBottom','borderRight']].map((_,i) => (
          <div key={i} style={{
            position: 'absolute', width: 16, height: 16, zIndex: 10,
            ...(i===0 ? {top:-1,left:-1,borderTop:'2px solid #4da6ff',borderLeft:'2px solid #4da6ff'} :
               i===1 ? {top:-1,right:-1,borderTop:'2px solid #4da6ff',borderRight:'2px solid #4da6ff'} :
               i===2 ? {bottom:-1,left:-1,borderBottom:'2px solid #4da6ff',borderLeft:'2px solid #4da6ff'} :
                       {bottom:-1,right:-1,borderBottom:'2px solid #4da6ff',borderRight:'2px solid #4da6ff'}),
          }} />
        ))}

        {/* Header bar */}
        <div style={{ background: '#0a1f3d', border: '1px solid #1a3a6e', borderBottom: 'none', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 12, fontWeight: 600, color: '#4da6ff', letterSpacing: '0.15em' }}>
              UNTURN
            </span>
          </div>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2a4a7a' }}>
            AUTH_v2.1
          </span>
        </div>

        {/* Main card */}
        <div style={{ background: '#071428', border: '1px solid #1a3a6e', padding: '24px 24px 20px' }}>

          {/* Mode toggle */}
          <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #1a3a6e' }}>
            {(['login', 'signup'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} style={{
                flex: 1, padding: '8px 0', background: 'none', border: 'none',
                borderBottom: `2px solid ${mode === m ? '#4da6ff' : 'transparent'}`,
                color: mode === m ? '#4da6ff' : '#2a4a7a',
                fontFamily: "'Rajdhani', system-ui, sans-serif",
                fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', cursor: 'pointer', marginBottom: -1,
                transition: 'all 0.15s',
              }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>// NAME</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="your name" required style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; e.target.style.background = '#0a1f3d'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; e.target.style.background = '#040d1a'; }} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>// EMAIL</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@domain.com" required style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; e.target.style.background = '#0a1f3d'; }}
                onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; e.target.style.background = '#040d1a'; }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>// PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" required style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; e.target.style.background = '#0a1f3d'; }}
                onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; e.target.style.background = '#040d1a'; }} />
            </div>

            {error && (
              <div style={{ background: '#ff4a6e10', border: '1px solid #ff4a6e40', padding: '8px 12px', color: '#ff4a6e',
                fontFamily: "'Share Tech Mono', monospace", fontSize: 12, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ff4a6e' }}>ERR</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px 0',
              background: loading ? '#0a1f3d' : '#4da6ff',
              color: loading ? '#2a4a7a' : '#040d1a',
              border: '1px solid ' + (loading ? '#1a3a6e' : '#4da6ff'),
              fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#6abfff'; } }}
              onMouseLeave={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#4da6ff'; } }}
            >
              {loading ? 'AUTHENTICATING...' : mode === 'login' ? 'AUTHENTICATE' : 'CREATE ACCOUNT'}
            </button>
          </form>
        </div>

        {/* Footer bar */}
        <div style={{ background: '#040d1a', border: '1px solid #1a3a6e', borderTop: 'none',
          padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a' }}>
            SYS.READY
          </span>
          <a href="/api/docs" target="_blank" rel="noreferrer"
            style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#4da6ff'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#2a4a7a'; }}>
            API.DOCS →
          </a>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: "'Share Tech Mono', monospace",
  fontSize: 10, color: '#2050a0', letterSpacing: '0.1em', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#040d1a', border: '1px solid #1a3a6e',
  padding: '9px 12px', color: '#c8deff',
  fontFamily: "'Share Tech Mono', monospace", fontSize: 13,
  outline: 'none', boxSizing: 'border-box', transition: 'all 0.15s',
};
