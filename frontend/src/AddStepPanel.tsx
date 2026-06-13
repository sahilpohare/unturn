import { useState, useRef } from 'react';
import type { Flow, Step, StepType } from './types';
import * as api from './api';
import { ToolEditor, type ToolDef } from './ToolEditor';

export const STEP_CATALOGUE: { type: StepType; label: string; icon: string; color: string; defaultConfig: Record<string, unknown> }[] = [
  { type: 'trigger/manual',   label: 'Manual Trigger',   icon: '▶',  color: '#7c3aed', defaultConfig: {} },
  { type: 'trigger/webhook',  label: 'Webhook Trigger',  icon: '⚡', color: '#7c3aed', defaultConfig: { secret: '' } },
  { type: 'trigger/schedule', label: 'Schedule Trigger', icon: '🕐', color: '#7c3aed', defaultConfig: { cron: '0 9 * * 1' } },
  { type: 'agent',            label: 'AI Agent',         icon: '🤖', color: '#2563eb', defaultConfig: { agentName: '', promptTemplate: '', tools: [] } },
  { type: 'http',             label: 'HTTP Request',     icon: '🌐', color: '#0891b2', defaultConfig: { url: '', method: 'GET' } },
  { type: 'transform',        label: 'Transform',        icon: '🔄', color: '#059669', defaultConfig: { mapping: {} } },
  { type: 'condition',        label: 'Condition',        icon: '🔀', color: '#d97706', defaultConfig: { expression: '', onTrue: '', onFalse: '' } },
  { type: 'delay',            label: 'Delay',            icon: '⏱', color: '#6b7280', defaultConfig: { duration: '30s' } },
  { type: 'brand-research',   label: 'Brand Research',   icon: '🔍', color: '#db2777', defaultConfig: { websiteUrl: '' } },
  { type: 'meta-ads-search',  label: 'Meta Ads Search',  icon: '📢', color: '#ea580c', defaultConfig: { pageIdPath: '', countries: ['US'] } },
  { type: 'creator-vet',      label: 'Creator Vet',      icon: '✅', color: '#65a30d', defaultConfig: { handlesPath: '' } },
  { type: 'instagram-dm',     label: 'Instagram DM',     icon: '💬', color: '#c2410c', defaultConfig: { recipientIdPath: '', messagePath: '' } },
];

interface Props {
  flow: Flow;
  onClose: () => void;
  onSaved: (flow: Flow) => void;
  editStep?: Step;
}

export function AddStepPanel({ flow, onClose, onSaved, editStep }: Props) {
  const isEdit = !!editStep;
  const isAgent = (editStep?.type ?? '') === 'agent';

  const initCatalogue = editStep ? (STEP_CATALOGUE.find((c) => c.type === editStep.type) ?? null) : null;
  const initConfig = editStep ? { ...(editStep.config as any) } : null;

  const [selected, setSelected] = useState(initCatalogue);
  const [name, setName] = useState(editStep?.name ?? '');
  const [ref, setRef] = useState(editStep?.ref ?? '');
  const [onSuccess, setOnSuccess] = useState(editStep?.onSuccess ?? '');
  const [onFailure, setOnFailure] = useState(editStep?.onFailure ?? '');

  // Agent-specific fields
  const [agentName, setAgentName] = useState(initConfig?.agentName ?? '');
  const [promptTemplate, setPromptTemplate] = useState(initConfig?.promptTemplate ?? '');
  const [threadIdPath, setThreadIdPath] = useState(initConfig?.threadIdPath ?? '');
  const [resourceIdPath, setResourceIdPath] = useState(initConfig?.resourceIdPath ?? '');
  const [tools, setTools] = useState<ToolDef[]>(initConfig?.tools ?? []);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [varPickerOpen, setVarPickerOpen] = useState(false);

  // Generic config (non-agent)
  const [configText, setConfigText] = useState(() => {
    if (!editStep) return '';
    const c = { ...(editStep.config as any) };
    if (editStep.type === 'agent') return ''; // agent uses structured fields
    return JSON.stringify(c, null, 2);
  });
  const [configError, setConfigError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Available injection variables from prior steps
  const priorSteps = (flow.steps ?? []).filter((s) => s.ref !== editStep?.ref);
  const injectionVars: { label: string; value: string }[] = [
    { label: '$.input (flow input)', value: '$.input' },
    { label: '$.tenantId', value: '$.tenantId' },
    ...priorSteps.flatMap((s) => [
      { label: `$.steps.${s.ref} (${s.name})`, value: `$.steps.${s.ref}` },
    ]),
  ];

  function insertVar(v: string) {
    const ta = promptRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? promptTemplate.length;
    const next = promptTemplate.slice(0, start) + `{{${v}}}` + promptTemplate.slice(ta.selectionEnd ?? start);
    setPromptTemplate(next);
    setVarPickerOpen(false);
    setTimeout(() => {
      ta.focus();
      const pos = start + v.length + 4;
      ta.setSelectionRange(pos, pos);
    }, 10);
  }

  function pickType(item: typeof STEP_CATALOGUE[0]) {
    if (isEdit) return;
    setSelected(item);
    setName(item.label);
    setRef(item.type.replace('/', '-') + '-' + Date.now().toString(36));
    setTools([]);
    setAgentName('');
    setPromptTemplate('');
    setThreadIdPath('');
    setResourceIdPath('');
    const cfg = { ...item.defaultConfig } as any;
    if (item.type === 'agent') { delete cfg.tools; setConfigText(''); }
    else setConfigText(JSON.stringify(cfg, null, 2));
    setConfigError('');
    setError('');
  }

  function validateConfig() {
    if (selected?.type === 'agent') return true;
    try { JSON.parse(configText); setConfigError(''); return true; }
    catch { setConfigError('Invalid JSON'); return false; }
  }

  function buildConfig() {
    if (selected?.type === 'agent') {
      return { agentName, promptTemplate, tools, threadIdPath: threadIdPath || undefined, resourceIdPath: resourceIdPath || undefined };
    }
    return JSON.parse(configText);
  }

  async function handleSave() {
    if (!selected || !name.trim() || !ref.trim()) return;
    if (!validateConfig()) return;
    setSaving(true);
    setError('');
    try {
      const existing = flow.steps ?? [];
      const isTrigger = selected.type.startsWith('trigger/');
      const config = buildConfig();
      let allSteps;
      if (isEdit) {
        allSteps = existing.map((s) =>
          s.id === editStep.id
            ? { ...s, name: name.trim(), config, onSuccess: onSuccess || null, onFailure: onFailure || null }
            : s,
        );
      } else {
        const base = isTrigger ? existing.filter((s) => !s.type.startsWith('trigger/')) : existing;
        const newStep = {
          ref: ref.trim(), type: selected.type, name: name.trim(),
          position: isTrigger ? 0 : base.length, config,
          onSuccess: onSuccess || null, onFailure: onFailure || null,
          retryPolicy: { maximumAttempts: 3, initialInterval: '1s' },
        };
        allSteps = isTrigger
          ? [newStep, ...base.map((s, i) => ({ ...s, position: i + 1 }))]
          : [...base, newStep];
      }
      const saved = await api.upsertSteps(flow.id, allSteps);
      onSaved({ ...flow, steps: saved as any });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editStep || !confirm(`Delete step "${editStep.name}"?`)) return;
    setSaving(true);
    try {
      await api.deleteStep(flow.id, editStep.id);
      onSaved({ ...flow, steps: (flow.steps ?? []).filter((s) => s.id !== editStep.id) });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const existingRefs = (flow.steps ?? []).filter((s) => !editStep || s.id !== editStep.id).map((s) => s.ref);
  const isAgentSelected = selected?.type === 'agent';
  const modalWidth = isAgentSelected || isAgent ? 680 : 560;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0009', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 12,
        width: modalWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px #000a', fontFamily: 'sans-serif', overflow: 'hidden',
        transition: 'width 0.15s',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2a3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{isEdit ? 'Edit Step' : 'Add Step'}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isEdit && (
              <button onClick={handleDelete} disabled={saving} style={{ background: 'none', border: '1px solid #dc2626', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                Delete
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: type palette */}
          <div style={{ width: 190, borderRight: '1px solid #2a2a3e', overflowY: 'auto', padding: 8, flexShrink: 0 }}>
            {STEP_CATALOGUE.map((item) => (
              <div key={item.type} onClick={() => pickType(item)} style={{
                padding: '7px 10px', borderRadius: 8, marginBottom: 2,
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: isEdit ? 'default' : 'pointer',
                opacity: isEdit && item.type !== selected?.type ? 0.25 : 1,
                background: selected?.type === item.type ? item.color + '22' : 'transparent',
                border: `1px solid ${selected?.type === item.type ? item.color : 'transparent'}`,
              }}>
                <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{item.label}</div>
                  <div style={{ color: '#475569', fontSize: 10 }}>{item.type}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: form */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            {!selected ? (
              <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>← Pick a step type</div>
            ) : (
              <>
                {/* Type badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <div style={{ background: selected.color, borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{selected.icon}</div>
                  <div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{selected.label}</div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>{selected.type}</div>
                  </div>
                </div>

                <Label>Name</Label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Step name" />

                <Label>Ref <span style={{ color: '#475569', fontWeight: 400 }}>(unique within flow)</span></Label>
                <input value={ref} onChange={(e) => setRef(e.target.value)} style={inputStyle} disabled={isEdit} />

                {existingRefs.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <Label>On Success</Label>
                      <select value={onSuccess ?? ''} onChange={(e) => setOnSuccess(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">— end of flow —</option>
                        {existingRefs.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>On Failure</Label>
                      <select value={onFailure ?? ''} onChange={(e) => setOnFailure(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">— fail flow —</option>
                        {existingRefs.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* ── Agent-specific fields ── */}
                {isAgentSelected && (
                  <>
                    <div style={{ borderTop: '1px solid #2a2a3e', margin: '16px 0 0', paddingTop: 16 }}>
                      <div style={{ color: '#2563eb', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                        🤖 Agent Configuration
                      </div>

                      <Label>Agent Name <span style={{ color: '#475569', fontWeight: 400 }}>(Mastra agent ID)</span></Label>
                      <input value={agentName} onChange={(e) => setAgentName(e.target.value)} style={inputStyle} placeholder="e.g. outreach-agent" />

                      <Label>
                        Prompt Template
                        <button
                          onClick={() => setVarPickerOpen((o) => !o)}
                          style={{ marginLeft: 8, background: '#1e1e2e', border: '1px solid #2a2a3e', color: '#3b82f6', borderRadius: 4, padding: '1px 7px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                        >
                          + inject var
                        </button>
                      </Label>

                      {varPickerOpen && (
                        <div style={{ background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                          <div style={{ padding: '6px 10px', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #2a2a3e' }}>
                            Click to insert at cursor
                          </div>
                          {injectionVars.map((v) => (
                            <div
                              key={v.value}
                              onClick={() => insertVar(v.value)}
                              style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1a1a2e' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a3e')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                            >
                              <code style={{ color: '#60a5fa', fontSize: 11, background: '#0f172a', padding: '1px 5px', borderRadius: 3 }}>{`{{${v.value}}}`}</code>
                              <span style={{ color: '#64748b', fontSize: 11 }}>{v.label}</span>
                            </div>
                          ))}
                          {injectionVars.length === 0 && (
                            <div style={{ padding: '8px 12px', color: '#475569', fontSize: 12 }}>No prior steps yet</div>
                          )}
                        </div>
                      )}

                      <textarea
                        ref={promptRef}
                        value={promptTemplate}
                        onChange={(e) => setPromptTemplate(e.target.value)}
                        rows={6}
                        placeholder={'You are a helpful assistant.\n\nResearch this brand: {{$.input.brandName}}\n\nPrevious results: {{$.steps.research-step.text}}'}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
                      />
                      <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>
                        Use <code style={{ color: '#60a5fa' }}>{'{{$.input.field}}'}</code>, <code style={{ color: '#60a5fa' }}>{'{{$.steps.ref.field}}'}</code>, or <code style={{ color: '#60a5fa' }}>{'{{$.tenantId}}'}</code>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                        <div>
                          <Label>Thread ID path <span style={{ color: '#475569', fontWeight: 400 }}>(optional)</span></Label>
                          <input value={threadIdPath} onChange={(e) => setThreadIdPath(e.target.value)} style={inputStyle} placeholder="$.input.threadId" />
                        </div>
                        <div>
                          <Label>Resource ID path <span style={{ color: '#475569', fontWeight: 400 }}>(optional)</span></Label>
                          <input value={resourceIdPath} onChange={(e) => setResourceIdPath(e.target.value)} style={inputStyle} placeholder="$.input.userId" />
                        </div>
                      </div>

                      <Label>Tools</Label>
                      <ToolEditor tools={tools} onChange={setTools} />
                    </div>
                  </>
                )}

                {/* ── Generic JSON config (non-agent) ── */}
                {!isAgentSelected && (
                  <>
                    <Label>
                      Config (JSON)
                      {configError && <span style={{ color: '#ef4444', fontWeight: 400, marginLeft: 8 }}>{configError}</span>}
                    </Label>
                    <textarea
                      value={configText}
                      onChange={(e) => { setConfigText(e.target.value); setConfigError(''); }}
                      onBlur={validateConfig}
                      rows={8}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </>
                )}

                {error && (
                  <div style={{ background: '#dc262622', border: '1px solid #dc2626', borderRadius: 6, padding: '8px 12px', color: '#fca5a5', fontSize: 12, marginTop: 8 }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !ref.trim()}
                  style={{
                    marginTop: 16, width: '100%', padding: '10px 0', background: selected.color,
                    color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Step'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, marginTop: 14 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 8,
  padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
