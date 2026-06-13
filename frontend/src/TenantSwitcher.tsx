import { useState, useEffect, useRef } from 'react';
import { listTenants, createTenant, setTenantId, type Tenant } from './api';

interface Props {
  onSwitch: (tenantId: string) => void;
  currentTenantId: string;
}

export function TenantSwitcher({ onSwitch, currentTenantId }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listTenants().then(setTenants).catch(() => setTenants([]));
  }, []);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = tenants.find((t) => t.id === currentTenantId);

  function select(t: Tenant) {
    setTenantId(t.id);
    onSwitch(t.id);
    setOpen(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const t = await createTenant(newName, newSlug);
      setTenants((prev) => [...prev, t]);
      setNewName('');
      setNewSlug('');
      setCreating(false);
      select(t);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 8,
          padding: '8px 12px', cursor: 'pointer', color: '#e2e8f0',
        }}
      >
        <span style={{ fontSize: 16 }}>🏢</span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.name ?? (currentTenantId ? currentTenantId.slice(0, 8) + '…' : 'Select tenant')}
        </span>
        <span style={{ color: '#64748b', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
          background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 8,
          boxShadow: '0 8px 24px #0009', overflow: 'hidden',
        }}>
          {tenants.length === 0 && !creating && (
            <div style={{ padding: '12px 14px', color: '#64748b', fontSize: 12 }}>No tenants yet.</div>
          )}

          {tenants.map((t) => (
            <div
              key={t.id}
              onClick={() => select(t)}
              style={{
                padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: t.id === currentTenantId ? '#2563eb22' : 'transparent',
                borderLeft: t.id === currentTenantId ? '3px solid #2563eb' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 14 }}>🏢</span>
              <div>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>{t.slug}</div>
              </div>
              {t.id === currentTenantId && (
                <span style={{ marginLeft: 'auto', color: '#2563eb', fontSize: 12 }}>✓</span>
              )}
            </div>
          ))}

          <div style={{ borderTop: '1px solid #2a2a3e' }}>
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                style={{
                  width: '100%', padding: '9px 14px', background: 'none', border: 'none',
                  color: '#3b82f6', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                }}
              >
                + New tenant
              </button>
            ) : (
              <form onSubmit={handleCreate} style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  autoFocus
                  required
                  style={inputStyle}
                />
                <input
                  placeholder="Slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  required
                  style={inputStyle}
                />
                {error && <div style={{ color: '#fca5a5', fontSize: 11 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="submit" style={{ ...btnStyle('#2563eb'), flex: 1 }}>Create</button>
                  <button type="button" onClick={() => { setCreating(false); setError(''); }} style={{ ...btnStyle('#374151'), flex: 1 }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 6,
  padding: '6px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%',
  boxSizing: 'border-box',
};

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 500 };
}
