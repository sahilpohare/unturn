import { useState } from 'react';
import type { Flow } from './types';
import * as api from './api';
import { TenantSwitcher } from './TenantSwitcher';

interface Props {
  flows: Flow[];
  selectedFlow: Flow | null;
  onSelectFlow: (flow: Flow) => void;
  onRefresh: () => void;
  selectedStep: string | null;
  onLogout: () => void;
  onAddStep: () => void;
  onOpenCredentials: () => void;
}

const S = {
  sidebar: {
    width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' as const,
    background: '#071428', borderRight: '1px solid #1a3a6e',
    fontFamily: "'Rajdhani', system-ui, sans-serif", overflow: 'hidden', height: '100%',
  },
  section: { borderBottom: '1px solid #1a3a6e' },
  sectionLabel: {
    fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2050a0',
    letterSpacing: '0.15em', textTransform: 'uppercase' as const,
  },
  input: {
    background: '#040d1a', border: '1px solid #1a3a6e', padding: '6px 10px',
    color: '#c8deff', fontFamily: "'Share Tech Mono', monospace", fontSize: 12,
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  },
};

export function Sidebar({ flows, selectedFlow, onSelectFlow, onRefresh, selectedStep, onLogout, onAddStep, onOpenCredentials }: Props) {
  const [currentTenantId, setCurrentTenantId] = useState('');
  const [newFlowName, setNewFlowName] = useState('');
  const [executing, setExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<string | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runArgs, setRunArgs] = useState<Record<string, string>>({});

  function handleTenantSwitch(id: string) { setCurrentTenantId(id); onRefresh(); }

  async function handleCreate() {
    if (!newFlowName.trim()) return;
    await api.createFlow({ name: newFlowName, steps: [{ ref: 'trigger', type: 'trigger/manual', name: 'Manual Trigger', position: 0, config: {} }] });
    setNewFlowName(''); onRefresh();
  }

  function openRunModal() {
    if (!selectedFlow) return;
    const trigger = selectedFlow.steps?.find((s) => s.type.startsWith('trigger/'));
    const props = (trigger?.config as any)?.inputSchema?.properties ?? {};
    const defaults: Record<string, string> = {};
    for (const key of Object.keys(props)) defaults[key] = '';
    setRunArgs(defaults); setRunModalOpen(true);
  }

  async function handleExecute() {
    if (!selectedFlow) return;
    setExecuting(true); setRunModalOpen(false);
    try {
      const res = await api.executeFlow(selectedFlow.id, runArgs);
      setLastExecution(res.workflowId);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setExecuting(false); }
  }

  async function handleDelete() {
    if (!selectedFlow || !confirm(`Delete "${selectedFlow.name}"?`)) return;
    await api.deleteFlow(selectedFlow.id); onRefresh();
  }

  const step = selectedFlow?.steps.find((s) => s.ref === selectedStep);

  return (
    <div style={S.sidebar}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a3a6e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a1f3d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700, color: '#4da6ff', letterSpacing: '0.15em' }}>UNTURN</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <IconBtn onClick={currentTenantId ? onOpenCredentials : () => {}} title={currentTenantId ? 'Credentials' : 'Select a workspace first'}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="15" r="4" /><path d="M10.85 12.15 19 4" /><path d="M18 5l2 2" /><path d="M15 8l2 2" />
            </svg>
          </IconBtn>
          <button onClick={onLogout} style={{ background: 'none', border: '1px solid #1a3a6e', color: '#2050a0', cursor: 'pointer', fontSize: 10, padding: '3px 8px', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.08em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#4da6ff'; (e.currentTarget as HTMLElement).style.borderColor = '#4da6ff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#2050a0'; (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; }}>
            EXIT
          </button>
        </div>
      </div>

      {/* Tenant */}
      <div style={{ padding: '10px 14px', ...S.section }}>
        <div style={{ ...S.sectionLabel, marginBottom: 8 }}>// WORKSPACE</div>
        <TenantSwitcher currentTenantId={currentTenantId} onSwitch={handleTenantSwitch} />
      </div>

      {/* Flows */}
      <div style={{ padding: '10px 14px', ...S.section }}>
        <div style={{ ...S.sectionLabel, marginBottom: 8 }}>// FLOWS</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input
            placeholder="new_flow_name"
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            style={{ ...S.input, flex: 1 }}
            onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }}
            onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }}
          />
          <button onClick={handleCreate} style={{ background: '#4da6ff', border: 'none', color: '#040d1a', padding: '6px 12px', cursor: 'pointer', fontFamily: "'Orbitron', monospace", fontSize: 10, fontWeight: 700 }}>+</button>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {flows.length === 0 ? (
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2a4a7a', padding: '8px 0' }}>
              &gt; SELECT WORKSPACE TO LOAD
            </div>
          ) : flows.map((f) => (
            <div key={f.id} onClick={() => onSelectFlow(f)} style={{
              padding: '7px 10px', cursor: 'pointer', marginBottom: 2,
              background: selectedFlow?.id === f.id ? '#0a1f3d' : 'transparent',
              border: `1px solid ${selectedFlow?.id === f.id ? '#4da6ff' : '#1a3a6e'}`,
              transition: 'all 0.1s',
            }}
              onMouseEnter={(e) => { if (selectedFlow?.id !== f.id) (e.currentTarget as HTMLElement).style.borderColor = '#2050a0'; }}
              onMouseLeave={(e) => { if (selectedFlow?.id !== f.id) (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: selectedFlow?.id === f.id ? '#4da6ff' : '#c8deff', letterSpacing: '0.03em' }}>{f.name}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: statusColor(f.status), marginTop: 2 }}>STATUS: {f.status?.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Flow actions */}
      {selectedFlow && (
        <div style={{ padding: '10px 14px', ...S.section }}>
          <div style={{ ...S.sectionLabel, marginBottom: 4 }}>// {selectedFlow.name.toUpperCase()}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a', marginBottom: 10 }}>
            STEPS: {selectedFlow.steps?.length ?? 0} &nbsp;|&nbsp; {selectedFlow.status?.toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <Btn onClick={onAddStep} color="#4da6ff">+ STEP</Btn>
            <Btn onClick={openRunModal} color="#4affa0" disabled={executing}>
              {executing ? '...' : '▶ RUN'}
            </Btn>
          </div>
          <Btn onClick={handleDelete} color="#ff4a6e" full>DELETE FLOW</Btn>
          {lastExecution && (
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#4affa0', marginTop: 8, wordBreak: 'break-all' }}>
              WF: {lastExecution}
            </div>
          )}
        </div>
      )}

      {/* Run modal */}
      {runModalOpen && selectedFlow && (() => {
        const trigger = selectedFlow.steps?.find((s) => s.type.startsWith('trigger/'));
        const props = (trigger?.config as any)?.inputSchema?.properties ?? {};
        const keys = Object.keys(props);
        return (
          <div style={{ position: 'fixed', inset: 0, background: '#040d1acc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setRunModalOpen(false)}>
            <div style={{ background: '#071428', border: '1px solid #2050a0', width: 400, padding: 24, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              {/* Corner marks */}
              <div style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: '2px solid #4da6ff', borderLeft: '2px solid #4da6ff' }} />
              <div style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTop: '2px solid #4da6ff', borderRight: '2px solid #4da6ff' }} />
              <div style={{ position: 'absolute', bottom: -1, left: -1, width: 12, height: 12, borderBottom: '2px solid #4da6ff', borderLeft: '2px solid #4da6ff' }} />
              <div style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottom: '2px solid #4da6ff', borderRight: '2px solid #4da6ff' }} />

              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#4da6ff', letterSpacing: '0.12em', marginBottom: 16 }}>
                EXECUTE: {selectedFlow.name.toUpperCase()}
              </div>
              {keys.length === 0 && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: '#2a4a7a', marginBottom: 12 }}>&gt; NO INPUT PARAMS</div>}
              {keys.map((key) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ ...S.sectionLabel, marginBottom: 6 }}>// {key.toUpperCase()}</div>
                  <input
                    value={runArgs[key] ?? ''}
                    onChange={(e) => setRunArgs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={props[key].description ?? key}
                    style={S.input}
                    onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Btn onClick={() => setRunModalOpen(false)} color="#2050a0" full>CANCEL</Btn>
                <Btn onClick={handleExecute} color="#4affa0" disabled={executing} full>
                  {executing ? 'STARTING...' : '▶ EXECUTE'}
                </Btn>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Step inspector */}
      {step && (
        <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto' }}>
          <div style={{ ...S.sectionLabel, marginBottom: 10 }}>// STEP INSPECTOR</div>
          <Field label="NAME" value={step.name} />
          <Field label="TYPE" value={step.type} mono />
          <Field label="REF" value={step.ref} mono />
          <Field label="POS" value={String(step.position)} mono />
          {step.onSuccess && <Field label="ON_SUCCESS" value={step.onSuccess} color="#4affa0" mono />}
          {step.onFailure && <Field label="ON_FAILURE" value={step.onFailure} color="#ff4a6e" mono />}
          <Field label="RETRIES" value={`${step.retryPolicy?.maximumAttempts ?? 3}x ${step.retryPolicy?.initialInterval ?? '1s'}`} color="#ffda4a" mono />
          <div style={{ ...S.sectionLabel, marginTop: 10, marginBottom: 6 }}>// CONFIG</div>
          <pre style={{ background: '#040d1a', border: '1px solid #1a3a6e', padding: 10, fontSize: 10, color: '#6a9fd8', overflow: 'auto', maxHeight: 180, fontFamily: "'Share Tech Mono', monospace" }}>
            {JSON.stringify(step.config, null, 2)}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid #1a3a6e', marginTop: 'auto', background: '#040d1a' }}>
        <a href="/api/docs" target="_blank" rel="noreferrer"
          style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a', textDecoration: 'none', letterSpacing: '0.1em' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#4da6ff'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#2a4a7a'; }}>
          SYS.DOCS →
        </a>
      </div>
    </div>
  );
}

function Field({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2050a0', minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: mono ? 11 : 12, color: color ?? '#c8deff', fontFamily: mono ? "'Share Tech Mono', monospace" : 'inherit', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function statusColor(s: string) {
  if (s === 'active') return '#4affa0';
  if (s === 'disabled') return '#ff4a6e';
  return '#2a4a7a';
}

function Btn({ onClick, color, disabled, full, children }: { onClick: () => void; color: string; disabled?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: full ? undefined : 1, width: full ? '100%' : undefined,
      padding: '6px 0', background: disabled ? '#0a1f3d' : 'transparent',
      border: `1px solid ${disabled ? '#1a3a6e' : color}`,
      color: disabled ? '#2a4a7a' : color,
      fontFamily: "'Orbitron', monospace", fontSize: 9, fontWeight: 700,
      letterSpacing: '0.12em', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.1s',
    }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = color + '20'; }}
      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{ background: 'none', border: '1px solid #1a3a6e', color: '#2050a0', cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#4da6ff'; (e.currentTarget as HTMLElement).style.borderColor = '#4da6ff'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#2050a0'; (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; }}>
      {children}
    </button>
  );
}
