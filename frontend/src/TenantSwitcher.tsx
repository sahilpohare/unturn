import { useState, useEffect, useRef } from 'react';
import { listTenants, createTenant, setTenantId, type Tenant } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-mid)',
          color: 'var(--text-primary)',
        }}
      >
        <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
          {(current?.name ?? 'T')[0].toUpperCase()}
        </span>
        <span className="flex-1 text-left truncate" style={{ color: current ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {current?.name ?? (currentTenantId ? currentTenantId.slice(0, 8) + '…' : 'Select tenant')}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}>
          <path d="M5 7L1 3h8L5 7z" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 rounded-lg overflow-hidden z-50"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', boxShadow: '0 8px 32px #0009' }}>
          {tenants.length === 0 && !creating && (
            <div className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No tenants yet.</div>
          )}

          {tenants.map((t) => (
            <div
              key={t.id}
              onClick={() => select(t)}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors"
              style={{
                background: t.id === currentTenantId ? 'var(--bg-hover)' : 'transparent',
                borderLeft: `2px solid ${t.id === currentTenantId ? 'var(--accent)' : 'transparent'}`,
              }}
              onMouseEnter={(e) => { if (t.id !== currentTenantId) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (t.id !== currentTenantId) e.currentTarget.style.background = 'transparent'; }}
            >
              <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {t.name[0].toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.slug}</div>
              </div>
              {t.id === currentTenantId && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border-mid)' }}>
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="w-full px-3 py-2 text-xs text-left transition-colors"
                style={{ color: 'var(--text-secondary)', background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                + New tenant
              </button>
            ) : (
              <form onSubmit={handleCreate} className="p-3 flex flex-col gap-2">
                <Input
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  autoFocus
                  required
                  className="h-7 text-xs"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
                />
                <Input
                  placeholder="Slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  required
                  className="h-7 text-xs"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
                />
                {error && <div className="text-xs" style={{ color: '#fca5a5' }}>{error}</div>}
                <div className="flex gap-2">
                  <Button type="submit" size="xs" className="flex-1" style={{ background: 'var(--text-primary)', color: 'var(--bg-void)' }}>Create</Button>
                  <Button type="button" size="xs" variant="outline" className="flex-1" onClick={() => { setCreating(false); setError(''); }}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
