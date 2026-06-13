import { useState, useEffect, useRef } from 'react';
import { listTenants, createTenant, setTenantId, type Tenant } from './api';

interface Props {
  onSwitch: (tenantId: string) => void;
  currentTenantId: string;
}

const inp: React.CSSProperties = {
  background: '#040d1a', border: '1px solid #1a3a6e', padding: '6px 10px',
  color: '#c8deff', fontFamily: "'Share Tech Mono', monospace", fontSize: 11,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export function TenantSwitcher({ onSwitch, currentTenantId }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { listTenants().then(setTenants).catch(() => setTenants([])); }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = tenants.find((t) => t.id === currentTenantId);

  function select(t: Tenant) { setTenantId(t.id); onSwitch(t.id); setOpen(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      const t = await createTenant(newName, newSlug);
      setTenants((prev) => [...prev, t]);
      setNewName(''); setNewSlug(''); setCreating(false); select(t);
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: '#040d1a', border: '1px solid #1a3a6e', padding: '7px 10px',
        cursor: 'pointer', color: '#c8deff', fontFamily: "'Rajdhani', system-ui, sans-serif",
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#2050a0'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; }}
      >
        <div style={{ width: 18, height: 18, background: '#0a1f3d', border: '1px solid #2050a0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="0" /><path d="M9 3v18M3 9h6M3 15h6" />
          </svg>
        </div>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: current ? '#c8deff' : '#2a4a7a' }}>
          {current?.name ?? (currentTenantId ? currentTenantId.slice(0, 12) + '…' : 'SELECT WORKSPACE')}
        </span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2050a0' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 100, background: '#071428', border: '1px solid #2050a0', boxShadow: '0 8px 32px #000c' }}>
          {tenants.length === 0 && !creating && (
            <div style={{ padding: '10px 12px', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2a4a7a' }}>&gt; NO WORKSPACES</div>
          )}
          {tenants.map((t) => (
            <div key={t.id} onClick={() => select(t)} style={{
              padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              background: t.id === currentTenantId ? '#0a1f3d' : 'transparent',
              borderLeft: `2px solid ${t.id === currentTenantId ? '#4da6ff' : 'transparent'}`,
            }}
              onMouseEnter={(e) => { if (t.id !== currentTenantId) (e.currentTarget as HTMLElement).style.background = '#0a1f3d40'; }}
              onMouseLeave={(e) => { if (t.id !== currentTenantId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.id === currentTenantId ? '#4da6ff' : '#c8deff' }}>{t.name}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a' }}>{t.slug}</div>
              </div>
              {t.id === currentTenantId && <span style={{ marginLeft: 'auto', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#4da6ff' }}>✓</span>}
            </div>
          ))}

          <div style={{ borderTop: '1px solid #1a3a6e' }}>
            {!creating ? (
              <button onClick={() => setCreating(true)} style={{
                width: '100%', padding: '8px 12px', background: 'none', border: 'none',
                color: '#2050a0', fontFamily: "'Orbitron', monospace", fontSize: 9,
                cursor: 'pointer', textAlign: 'left', letterSpacing: '0.1em',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#4da6ff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#2050a0'; }}
              >
                + NEW WORKSPACE
              </button>
            ) : (
              <form onSubmit={handleCreate} style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input placeholder="name" value={newName} autoFocus required style={inp}
                  onChange={(e) => { setNewName(e.target.value); if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }}
                  onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }}
                />
                <input placeholder="slug" value={newSlug} required style={inp}
                  onChange={(e) => setNewSlug(e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }}
                />
                {error && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#ff4a6e' }}>ERR: {error}</div>}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="submit" style={{ flex: 1, padding: '5px 0', background: '#4da6ff', border: 'none', color: '#040d1a', fontFamily: "'Orbitron', monospace", fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em' }}>CREATE</button>
                  <button type="button" onClick={() => { setCreating(false); setError(''); }} style={{ flex: 1, padding: '5px 0', background: 'transparent', border: '1px solid #1a3a6e', color: '#2050a0', fontFamily: "'Orbitron', monospace", fontSize: 9, cursor: 'pointer', letterSpacing: '0.1em' }}>CANCEL</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
