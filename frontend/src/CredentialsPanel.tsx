import { useState, useEffect } from 'react';
import * as api from './api';
import type { CredentialKey } from './api';
import { CREDENTIAL_LABELS } from './api';

interface Props { tenantId: string; onClose: () => void; }

const CREDENTIAL_GROUPS: { label: string; keys: CredentialKey[] }[] = [
  { label: 'AI PROVIDER', keys: ['openaiApiKey', 'openaiModel'] },
  { label: 'META / INSTAGRAM', keys: ['metaAccessToken', 'instagramAccessToken', 'instagramUserId'] },
];

const inp: React.CSSProperties = {
  width: '100%', background: '#040d1a', border: '1px solid #1a3a6e',
  padding: '8px 12px', color: '#c8deff', fontFamily: "'Share Tech Mono', monospace",
  fontSize: 12, outline: 'none', boxSizing: 'border-box',
};

export function CredentialsPanel({ tenantId, onClose }: Props) {
  const [values, setValues] = useState<Partial<Record<CredentialKey, string>>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCredentials(tenantId).then((data) => { setValues(data as any); setLoading(false); }).catch(() => setLoading(false));
  }, [tenantId]);

  async function save() {
    setError(''); setSaved(false);
    try { await api.updateCredentials(tenantId, values); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e: any) { setError(e.message ?? 'Failed to save'); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#040d1acc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#071428', border: '1px solid #2050a0', width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        {/* Corner marks */}
        {[0,1,2,3].map((i) => (
          <div key={i} style={{ position: 'absolute', width: 14, height: 14,
            ...(i===0?{top:-1,left:-1,borderTop:'2px solid #4da6ff',borderLeft:'2px solid #4da6ff'}:
               i===1?{top:-1,right:-1,borderTop:'2px solid #4da6ff',borderRight:'2px solid #4da6ff'}:
               i===2?{bottom:-1,left:-1,borderBottom:'2px solid #4da6ff',borderLeft:'2px solid #4da6ff'}:
                     {bottom:-1,right:-1,borderBottom:'2px solid #4da6ff',borderRight:'2px solid #4da6ff'}),
          }} />
        ))}

        {/* Header */}
        <div style={{ background: '#0a1f3d', borderBottom: '1px solid #1a3a6e', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="15" r="4" /><path d="M10.85 12.15 19 4" /><path d="M18 5l2 2" /><path d="M15 8l2 2" />
            </svg>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700, color: '#4da6ff', letterSpacing: '0.15em' }}>CREDENTIALS</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a6e', color: '#2050a0', cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Share Tech Mono', monospace", fontSize: 14 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ff4a6e'; (e.currentTarget as HTMLElement).style.color = '#ff4a6e'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; (e.currentTarget as HTMLElement).style.color = '#2050a0'; }}>
            ×
          </button>
        </div>

        <div style={{ padding: '20px 20px 0' }}>
          <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2a4a7a', marginBottom: 20, lineHeight: 1.7 }}>
            &gt; CREDENTIALS STORED PER-WORKSPACE. PASSED SECURELY TO WORKFLOW EXECUTIONS.<br />
            &gt; VALUES MASKED AFTER SAVE — ENTER NEW VALUE TO UPDATE.
          </p>

          {loading && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2050a0', padding: '12px 0' }}>LOADING...</div>}

          {!loading && CREDENTIAL_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#4da6ff', letterSpacing: '0.15em' }}>// {group.label}</span>
                <div style={{ flex: 1, height: 1, background: '#1a3a6e' }} />
              </div>
              {group.keys.map((key) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2050a0', letterSpacing: '0.1em', marginBottom: 6 }}>
                    {CREDENTIAL_LABELS[key]?.toUpperCase()}
                  </label>
                  <input
                    type={key.toLowerCase().includes('key') || key.toLowerCase().includes('token') ? 'password' : 'text'}
                    style={inp}
                    value={values[key] ?? ''}
                    placeholder={values[key] ? '(SAVED — ENTER NEW VALUE TO UPDATE)' : 'NOT SET'}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }}
                  />
                </div>
              ))}
            </div>
          ))}

          {error && (
            <div style={{ background: '#ff4a6e10', border: '1px solid #ff4a6e40', padding: '8px 12px', color: '#ff4a6e', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, marginBottom: 16 }}>
              ERR: {error}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #1a3a6e', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #1a3a6e', color: '#2050a0', fontFamily: "'Orbitron', monospace", fontSize: 9, letterSpacing: '0.12em', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#2050a0'; (e.currentTarget as HTMLElement).style.color = '#6a9fd8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; (e.currentTarget as HTMLElement).style.color = '#2050a0'; }}>
            CANCEL
          </button>
          <button onClick={save} style={{
            padding: '8px 24px', border: 'none',
            background: saved ? '#4affa0' : '#4da6ff',
            color: '#040d1a', fontFamily: "'Orbitron', monospace",
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer', transition: 'background 0.2s',
          }}>
            {saved ? 'SAVED ✓' : 'SAVE CREDENTIALS'}
          </button>
        </div>
      </div>
    </div>
  );
}
