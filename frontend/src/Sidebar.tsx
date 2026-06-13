import { useState } from 'react';
import type { Flow } from './types';
import * as api from './api';
import { TenantSwitcher } from './TenantSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export function Sidebar({ flows, selectedFlow, onSelectFlow, onRefresh, selectedStep, onLogout, onAddStep, onOpenCredentials }: Props) {
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
    <div className="flex flex-col h-full w-[272px] flex-shrink-0" style={{ background: 'var(--bg-base)', borderRight: '1px solid var(--border-mid)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-mid)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--accent-glow)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Unturn</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenCredentials}
            title="API Credentials"
            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="15" r="4" />
              <path d="M10.85 12.15 19 4" />
              <path d="M18 5l2 2" />
              <path d="M15 8l2 2" />
            </svg>
          </button>
          <button
            onClick={onLogout}
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tenant switcher */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-mid)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Workspace</div>
        <TenantSwitcher currentTenantId={currentTenantId} onSwitch={handleTenantSwitch} />
      </div>

      {/* Flow list */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-mid)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Flows</div>
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="New flow name"
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="h-7 text-xs flex-1"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
          />
          <Button onClick={handleCreate} size="icon-sm" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </Button>
        </div>

        <ScrollArea className="max-h-48">
          {flows.length === 0 ? (
            <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
              Select a workspace to load flows.
            </div>
          ) : (
            <div className="space-y-0.5">
              {flows.map((f) => (
                <div
                  key={f.id}
                  onClick={() => onSelectFlow(f)}
                  className="px-2.5 py-2 rounded-lg cursor-pointer transition-all group"
                  style={{
                    background: selectedFlow?.id === f.id ? 'var(--bg-hover)' : 'transparent',
                    border: `1px solid ${selectedFlow?.id === f.id ? 'var(--border-hi)' : 'transparent'}`,
                  }}
                  onMouseEnter={(e) => { if (selectedFlow?.id !== f.id) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e) => { if (selectedFlow?.id !== f.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{f.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: statusColor(f.status) }}>{f.status}</div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Selected flow actions */}
      {selectedFlow && (
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-mid)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
            {selectedFlow.name}
          </div>
          <div className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
            {selectedFlow.steps?.length ?? 0} steps · {selectedFlow.status}
          </div>
          <div className="flex gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onAddStep}
              className="flex-1 h-7 text-xs"
              style={{ borderColor: 'var(--border-mid)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
            >
              + Step
            </Button>
            <Button
              size="sm"
              onClick={openRunModal}
              disabled={executing || selectedFlow.status !== 'active'}
              className="flex-1 h-7 text-xs"
              style={{ background: 'var(--success)', color: '#fff', opacity: selectedFlow.status !== 'active' ? 0.4 : 1 }}
            >
              {executing ? '…' : 'Run'}
            </Button>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            className="w-full h-7 text-xs"
          >
            Delete flow
          </Button>
          {lastExecution && (
            <div className="text-[10px] mt-2 break-all" style={{ color: 'var(--success)' }}>
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setRunModalOpen(false)}
          >
            <div
              className="rounded-xl w-[400px] flex flex-col gap-4 p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', boxShadow: '0 24px 64px #000c' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Run: {selectedFlow.name}
              </div>
              {keys.length === 0 && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No input args defined on trigger.</div>
              )}
              {keys.map((key) => (
                <div key={key}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {key}
                    {props[key].description && (
                      <span className="ml-2 font-normal lowercase normal-case" style={{ color: 'var(--text-muted)' }}>— {props[key].description}</span>
                    )}
                  </div>
                  <Input
                    value={runArgs[key] ?? ''}
                    onChange={(e) => setRunArgs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={props[key].description ?? key}
                    className="text-xs h-8"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <Button
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setRunModalOpen(false)}
                  style={{ borderColor: 'var(--border-mid)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-8 text-xs"
                  onClick={handleExecute}
                  disabled={executing}
                  style={{ background: 'var(--success)', color: '#fff' }}
                >
                  {executing ? 'Starting…' : 'Run'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Step inspector */}
      {step && (
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            Step Inspector
          </div>
          <div className="space-y-2">
            <Field label="Name" value={step.name} />
            <Field label="Type" value={step.type} />
            <Field label="Ref" value={step.ref} />
            <Field label="Position" value={String(step.position)} />
            {step.onSuccess && <Field label="On Success" value={step.onSuccess} color="var(--success)" />}
            {step.onFailure && <Field label="On Failure" value={step.onFailure} color="var(--danger)" />}
            <Field
              label="Retries"
              value={`${step.retryPolicy?.maximumAttempts ?? 3} × ${step.retryPolicy?.initialInterval ?? '1s'}`}
              color="var(--warning)"
            />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide mt-4 mb-1.5" style={{ color: 'var(--text-muted)' }}>Config</div>
          <pre className="rounded-lg p-3 text-[10px] overflow-auto max-h-48" style={{ background: 'var(--bg-void)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {JSON.stringify(step.config, null, 2)}
          </pre>
        </ScrollArea>
      )}

      {/* Footer */}
      <div className="px-3 py-3 mt-auto" style={{ borderTop: '1px solid var(--border-mid)' }}>
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="text-xs hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          API Docs (Swagger)
        </a>
      </div>
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-xs font-mono truncate" style={{ color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function statusColor(s: string) {
  if (s === 'active') return 'var(--success)';
  if (s === 'disabled') return 'var(--danger)';
  return 'var(--text-muted)';
}
