import { useState, useEffect } from 'react';
import * as api from './api';
import type { CredentialKey } from './api';
import { CREDENTIAL_LABELS } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  tenantId: string;
  onClose: () => void;
}

const CREDENTIAL_KEYS: CredentialKey[] = [
  'openaiApiKey',
  'openaiModel',
  'metaAccessToken',
  'instagramAccessToken',
  'instagramUserId',
];

const CREDENTIAL_GROUPS: { label: string; icon: React.ReactNode; keys: CredentialKey[] }[] = [
  {
    label: 'AI Provider',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
    keys: ['openaiApiKey', 'openaiModel'],
  },
  {
    label: 'Meta / Instagram',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
    keys: ['metaAccessToken', 'instagramAccessToken', 'instagramUserId'],
  },
];

export function CredentialsPanel({ tenantId, onClose }: Props) {
  const [values, setValues] = useState<Partial<Record<CredentialKey, string>>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCredentials(tenantId)
      .then((data) => {
        setValues(data as Partial<Record<CredentialKey, string>>);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenantId]);

  async function save() {
    setError('');
    setSaved(false);
    try {
      await api.updateCredentials(tenantId, values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', boxShadow: '0 24px 64px #000c' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-mid)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                <circle cx="8" cy="15" r="4" />
                <path d="M10.85 12.15 19 4" />
                <path d="M18 5l2 2" />
                <path d="M15 8l2 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>API Credentials</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Per-tenant, encrypted at rest</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Credentials are stored per-tenant and passed securely to workflow executions.
            Values are masked after saving — enter a new value to update.
          </p>

          {loading && (
            <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          )}

          {!loading && (
            <div className="space-y-6">
              {CREDENTIAL_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ color: 'var(--text-muted)' }}>{group.icon}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      {group.label}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-mid)' }} />
                  </div>
                  <div className="space-y-3">
                    {group.keys.map((key) => (
                      <div key={key}>
                        <Label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                          {CREDENTIAL_LABELS[key]}
                        </Label>
                        <Input
                          type={key.toLowerCase().includes('key') || key.toLowerCase().includes('token') ? 'password' : 'text'}
                          value={values[key] ?? ''}
                          placeholder={values[key] ? '(saved — enter new value to update)' : 'Not set'}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                          className="h-8 text-xs font-mono"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: '#ef444412', border: '1px solid #ef444440', color: '#fca5a5' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--border-mid)' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            style={{ borderColor: 'var(--border-mid)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            style={saved ? { background: 'var(--success)', color: '#fff' } : { background: 'var(--text-primary)', color: 'var(--bg-void)' }}
          >
            {saved ? 'Saved' : 'Save credentials'}
          </Button>
        </div>
      </div>
    </div>
  );
}
