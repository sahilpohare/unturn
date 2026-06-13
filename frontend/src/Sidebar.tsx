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
}

export function Sidebar({ flows, selectedFlow, onSelectFlow, onRefresh, selectedStep, onLogout, onAddStep }: Props) {
  const [currentTenantId, setCurrentTenantId] = useState('');
  const [newFlowName, setNewFlowName] = useState('');
  const [executing, setExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<string | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runArgs, setRunArgs] = useState<Record<string, string>>({});

  function handleTenantSwitch(id: string) {
    setCurrentTenantId(id);
    onRefresh();
  }

  async function handleCreate() {
    if (!newFlowName.trim()) return;
    await api.createFlow({
      name: newFlowName,
      steps: [{ ref: 'trigger', type: 'trigger/manual', name: 'Manual Trigger', position: 0, config: {} }],
    });
    setNewFlowName('');
    onRefresh();
  }

  function openRunModal() {
    if (!selectedFlow) return;
    // Seed args from trigger inputSchema
    const trigger = selectedFlow.steps?.find((s) => s.type.startsWith('trigger/'));
    const props = (trigger?.config as any)?.inputSchema?.properties ?? {};
    const defaults: Record<string, string> = {};
    for (const key of Object.keys(props)) defaults[key] = '';
    setRunArgs(defaults);
    setRunModalOpen(true);
  }

  async function handleExecute() {
    if (!selectedFlow) return;
    setExecuting(true);
    setRunModalOpen(false);
    try {
      const res = await api.executeFlow(selectedFlow.id, runArgs);
      setLastExecution(res.workflowId);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setExecuting(false);
    }
  }

  async function handleDelete() {
    if (!selectedFlow) return;
    if (!confirm(`Delete "${selectedFlow.name}"?`)) return;
    await api.deleteFlow(selectedFlow.id);
    onRefresh();
  }

  const step = selectedFlow?.steps.find((s) => s.ref === selectedStep);

  return (
    <div style={{
      width: 280, background: '#13131f', display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #2a2a3e', fontFamily: 'sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2a3e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Unturn</span>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
          Sign out
        </button>
      </div>

      {/* Tenant switcher */}
      <div style={{ padding: 16, borderBottom: '1px solid #2a2a3e' }}>
        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Tenant
        </div>
        <TenantSwitcher currentTenantId={currentTenantId} onSwitch={handleTenantSwitch} />
      </div>

      {/* Flow list */}
      <div style={{ padding: 16, borderBottom: '1px solid #2a2a3e', flex: 0 }}>
        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Flows
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            placeholder="New flow name"
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            style={{ ...inputStyle, flex: 1, margin: 0 }}
          />
          <button onClick={handleCreate} style={{ ...btnStyle('#059669'), padding: '6px 10px', margin: 0, flex: 'none' }}>+</button>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {flows.length === 0 && (
            <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
              Enter a tenant ID to load flows.
            </div>
          )}
          {flows.map((f) => (
            <div
              key={f.id}
              onClick={() => onSelectFlow(f)}
              style={{
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                background: selectedFlow?.id === f.id ? '#2563eb22' : '#1e1e2e',
                border: `1px solid ${selectedFlow?.id === f.id ? '#2563eb' : 'transparent'}`,
              }}
            >
              <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{f.name}</div>
              <div style={{ color: statusColor(f.status), fontSize: 11, marginTop: 2 }}>{f.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected flow actions */}
      {selectedFlow && (
        <div style={{ padding: 16, borderBottom: '1px solid #2a2a3e' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {selectedFlow.name}
          </div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
            {selectedFlow.steps?.length ?? 0} steps · {selectedFlow.status}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button onClick={onAddStep} style={btnStyle('#2563eb')}>+ Step</button>
            <button onClick={openRunModal} disabled={executing || selectedFlow.status !== 'active'} style={btnStyle('#059669')}>
              {executing ? '...' : '▶ Run'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleDelete} style={btnStyle('#dc2626')}>Delete flow</button>
          </div>
          {lastExecution && (
            <div style={{ color: '#22c55e', fontSize: 10, marginTop: 8, wordBreak: 'break-all' }}>
              Started: {lastExecution}
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
          <div style={{
            position: 'fixed', inset: 0, background: '#0009', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setRunModalOpen(false)}>
            <div style={{
              background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12,
              padding: 24, width: 400, display: 'flex', flexDirection: 'column', gap: 14,
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>
                Run: {selectedFlow.name}
              </div>
              {keys.length === 0 && (
                <div style={{ color: '#64748b', fontSize: 13 }}>No input args defined on trigger.</div>
              )}
              {keys.map((key) => (
                <div key={key}>
                  <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
                    {key}
                    {props[key].description && (
                      <span style={{ color: '#475569', marginLeft: 6 }}>— {props[key].description}</span>
                    )}
                  </div>
                  <input
                    value={runArgs[key] ?? ''}
                    onChange={(e) => setRunArgs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={props[key].description ?? key}
                    style={inputStyle}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setRunModalOpen(false)} style={{ ...btnStyle('#1e1e2e'), border: '1px solid #2a2a3e' }}>
                  Cancel
                </button>
                <button onClick={handleExecute} disabled={executing} style={btnStyle('#059669')}>
                  {executing ? 'Starting…' : '▶ Run'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Step inspector */}
      {step && (
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Step Inspector
          </div>
          <Field label="Name" value={step.name} />
          <Field label="Type" value={step.type} />
          <Field label="Ref" value={step.ref} />
          <Field label="Position" value={String(step.position)} />
          {step.onSuccess && <Field label="On Success" value={step.onSuccess} color="#22c55e" />}
          {step.onFailure && <Field label="On Failure" value={step.onFailure} color="#ef4444" />}
          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 10, marginBottom: 4 }}>Config</div>
          <pre style={{
            background: '#1e1e2e', borderRadius: 6, padding: 10, fontSize: 11,
            color: '#94a3b8', overflow: 'auto', maxHeight: 200, margin: 0,
          }}>
            {JSON.stringify(step.config, null, 2)}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: 12, borderTop: '1px solid #2a2a3e', marginTop: 'auto' }}>
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#3b82f6', fontSize: 12, textDecoration: 'none' }}
        >
          📖 API Docs (Swagger) ↗
        </a>
      </div>
    </div>
  );
}

function Field({ label, value, color = '#e2e8f0' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: '#64748b', fontSize: 11 }}>{label}: </span>
      <span style={{ color, fontSize: 12 }}>{value}</span>
    </div>
  );
}

function statusColor(s: string) {
  if (s === 'active') return '#22c55e';
  if (s === 'disabled') return '#ef4444';
  return '#94a3b8';
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1e1e2e', border: '1px solid #2a2a3e',
  borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff', border: 'none', borderRadius: 6,
    padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    flex: 1,
  };
}
