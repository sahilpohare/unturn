import { useState, useRef } from 'react';
import type { Flow, Step, StepType } from './types';
import * as api from './api';
import { ToolEditor, type ToolDef } from './ToolEditor';

export const STEP_CATALOGUE: { type: StepType; label: string; badge: string; color: string; defaultConfig: Record<string, unknown> }[] = [
  { type: 'trigger/manual',   label: 'Manual Trigger',   badge: 'MN', color: '#4da6ff',  defaultConfig: {} },
  { type: 'trigger/webhook',  label: 'Webhook Trigger',  badge: 'WH', color: '#4da6ff',  defaultConfig: { secret: '' } },
  { type: 'trigger/schedule', label: 'Schedule Trigger', badge: 'SC', color: '#4da6ff',  defaultConfig: { cron: '0 9 * * 1' } },
  { type: 'agent',            label: 'AI Agent',         badge: 'AI', color: '#a06aff',  defaultConfig: { agentName: '', promptTemplate: '', tools: [] } },
  { type: 'http',             label: 'HTTP Request',     badge: 'HT', color: '#4affd4',  defaultConfig: { url: '', method: 'GET' } },
  { type: 'transform',        label: 'Transform',        badge: 'TX', color: '#ffda4a',  defaultConfig: { mapping: {} } },
  { type: 'condition',        label: 'Condition',        badge: 'IF', color: '#ff9a4a',  defaultConfig: { expression: '', onTrue: '', onFalse: '' } },
  { type: 'delay',            label: 'Delay',            badge: 'DL', color: '#6a9fd8',  defaultConfig: { duration: '30s' } },
  { type: 'brand-research',   label: 'Brand Research',   badge: 'BR', color: '#ff6af0',  defaultConfig: { websiteUrl: '' } },
  { type: 'meta-ads-search',  label: 'Meta Ads Search',  badge: 'MA', color: '#ffaa4a',  defaultConfig: { pageIdPath: '', countries: ['US'] } },
  { type: 'creator-vet',      label: 'Creator Vet',      badge: 'CV', color: '#4affaa',  defaultConfig: { handlesPath: '' } },
  { type: 'instagram-dm',     label: 'Instagram DM',     badge: 'DM', color: '#ff6a8a',  defaultConfig: { recipientIdPath: '', messagePath: '' } },
];

interface Props { flow: Flow; onClose: () => void; onSaved: (flow: Flow) => void; editStep?: Step; }

const inp: React.CSSProperties = {
  width: '100%', background: '#040d1a', border: '1px solid #1a3a6e',
  padding: '7px 10px', color: '#c8deff',
  fontFamily: "'Share Tech Mono', monospace", fontSize: 12,
  outline: 'none', boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  fontFamily: "'Share Tech Mono', monospace", fontSize: 9,
  color: '#2050a0', letterSpacing: '0.1em', marginBottom: 6, display: 'block', marginTop: 12,
};

export function AddStepPanel({ flow, onClose, onSaved, editStep }: Props) {
  const isEdit = !!editStep;
  const initCatalogue = editStep ? (STEP_CATALOGUE.find((c) => c.type === editStep.type) ?? null) : null;
  const initConfig = editStep ? { ...(editStep.config as any) } : null;

  const [selected, setSelected] = useState(initCatalogue);
  const [name, setName] = useState(editStep?.name ?? '');
  const [ref, setRef] = useState(editStep?.ref ?? '');
  const [onSuccess, setOnSuccess] = useState(editStep?.onSuccess ?? '');
  const [onFailure, setOnFailure] = useState(editStep?.onFailure ?? '');
  const [retryAttempts, setRetryAttempts] = useState(String(editStep?.retryPolicy?.maximumAttempts ?? 3));
  const [retryInterval, setRetryInterval] = useState(editStep?.retryPolicy?.initialInterval ?? '1s');
  const [agentName, setAgentName] = useState(initConfig?.agentName ?? '');
  const [systemPrompt, setSystemPrompt] = useState(initConfig?.systemPrompt ?? '');
  const [promptTemplate, setPromptTemplate] = useState(initConfig?.promptTemplate ?? '');
  const [threadIdPath, setThreadIdPath] = useState(initConfig?.threadIdPath ?? '');
  const [resourceIdPath, setResourceIdPath] = useState(initConfig?.resourceIdPath ?? '');
  const [tools, setTools] = useState<ToolDef[]>(initConfig?.tools ?? []);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const [configText, setConfigText] = useState(() => {
    if (!editStep || editStep.type === 'agent') return '';
    return JSON.stringify({ ...(editStep.config as any) }, null, 2);
  });
  const [configError, setConfigError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const priorSteps = (flow.steps ?? []).filter((s) => s.ref !== editStep?.ref);
  const injectionVars = [
    { label: '$.input', value: '$.input' },
    { label: '$.tenantId', value: '$.tenantId' },
    ...priorSteps.map((s) => ({ label: `$.steps.${s.ref}`, value: `$.steps.${s.ref}` })),
  ];

  function insertVar(v: string) {
    const ta = promptRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? promptTemplate.length;
    setPromptTemplate(promptTemplate.slice(0, start) + `{{${v}}}` + promptTemplate.slice(ta.selectionEnd ?? start));
    setVarPickerOpen(false);
    setTimeout(() => { ta.focus(); const pos = start + v.length + 4; ta.setSelectionRange(pos, pos); }, 10);
  }

  function pickType(item: typeof STEP_CATALOGUE[0]) {
    if (isEdit) return;
    setSelected(item); setName(item.label);
    setRef(item.type.replace('/', '-') + '-' + Date.now().toString(36));
    setTools([]); setAgentName(''); setPromptTemplate(''); setThreadIdPath(''); setResourceIdPath('');
    const cfg = { ...item.defaultConfig } as any;
    if (item.type === 'agent') { delete cfg.tools; setSystemPrompt(''); setConfigText(''); }
    else setConfigText(JSON.stringify(cfg, null, 2));
    setConfigError(''); setError('');
  }

  function validateConfig() {
    if (selected?.type === 'agent') return true;
    try { JSON.parse(configText); setConfigError(''); return true; } catch { setConfigError('INVALID JSON'); return false; }
  }

  function buildConfig() {
    if (selected?.type === 'agent') {
      return { agentName, systemPrompt: systemPrompt || undefined, promptTemplate, tools, threadIdPath: threadIdPath || undefined, resourceIdPath: resourceIdPath || undefined };
    }
    return JSON.parse(configText);
  }

  async function handleSave() {
    if (!selected || !name.trim() || !ref.trim()) return;
    if (!validateConfig()) return;
    setSaving(true); setError('');
    try {
      const existing = flow.steps ?? [];
      const isTrigger = selected.type.startsWith('trigger/');
      const config = buildConfig();
      const retryPolicy = { maximumAttempts: Math.max(1, parseInt(retryAttempts, 10) || 3), initialInterval: retryInterval || '1s' };
      let allSteps;
      if (isEdit) {
        allSteps = existing.map((s) => s.id === editStep.id ? { ...s, name: name.trim(), config, onSuccess: onSuccess || null, onFailure: onFailure || null, retryPolicy } : s);
      } else {
        const newStep = { ref: ref.trim(), type: selected.type, name: name.trim(), position: existing.length, config, onSuccess: onSuccess || null, onFailure: onFailure || null, retryPolicy };
        allSteps = [...existing, newStep];
      }
      const saved = await api.upsertSteps(flow.id, allSteps);
      onSaved({ ...flow, steps: saved as any }); onClose();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!editStep || !confirm(`Delete step "${editStep.name}"?`)) return;
    setSaving(true);
    try {
      await api.deleteStep(flow.id, editStep.id);
      onSaved({ ...flow, steps: (flow.steps ?? []).filter((s) => s.id !== editStep.id) }); onClose();
    } catch (e) { setError((e as Error).message); setSaving(false); }
  }

  const existingRefs = (flow.steps ?? []).filter((s) => !editStep || s.id !== editStep.id).map((s) => s.ref);
  const isAgentSelected = selected?.type === 'agent';
  const modalWidth = isAgentSelected ? 720 : 600;

  const selStyle: React.CSSProperties = { ...inp, cursor: 'pointer' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#040d1acc', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#071428', border: '1px solid #2050a0', width: modalWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px #000e', overflow: 'hidden', position: 'relative' }}>
        {/* Corner marks */}
        {[0,1,2,3].map((i) => (
          <div key={i} style={{ position: 'absolute', width: 14, height: 14, zIndex: 10,
            ...(i===0?{top:-1,left:-1,borderTop:'2px solid #4da6ff',borderLeft:'2px solid #4da6ff'}:
               i===1?{top:-1,right:-1,borderTop:'2px solid #4da6ff',borderRight:'2px solid #4da6ff'}:
               i===2?{bottom:-1,left:-1,borderBottom:'2px solid #4da6ff',borderLeft:'2px solid #4da6ff'}:
                     {bottom:-1,right:-1,borderBottom:'2px solid #4da6ff',borderRight:'2px solid #4da6ff'}),
          }} />
        ))}

        {/* Header */}
        <div style={{ background: '#0a1f3d', borderBottom: '1px solid #1a3a6e', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#4da6ff', letterSpacing: '0.15em' }}>
            {isEdit ? 'EDIT_STEP' : 'ADD_STEP'}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isEdit && (
              <button onClick={handleDelete} disabled={saving} style={{ background: 'transparent', border: '1px solid #ff4a6e', color: '#ff4a6e', padding: '4px 12px', cursor: 'pointer', fontFamily: "'Orbitron', monospace", fontSize: 9, letterSpacing: '0.1em' }}>DELETE</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a6e', color: '#2050a0', cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Share Tech Mono', monospace", fontSize: 14 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ff4a6e'; (e.currentTarget as HTMLElement).style.color = '#ff4a6e'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; (e.currentTarget as HTMLElement).style.color = '#2050a0'; }}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left palette */}
          <div style={{ width: 196, borderRight: '1px solid #1a3a6e', overflowY: 'auto', padding: 8, flexShrink: 0 }}>
            {STEP_CATALOGUE.map((item) => (
              <div key={item.type} onClick={() => pickType(item)} style={{
                padding: '7px 10px', marginBottom: 2, cursor: isEdit ? 'default' : 'pointer',
                opacity: isEdit && item.type !== selected?.type ? 0.15 : 1,
                background: selected?.type === item.type ? item.color + '14' : 'transparent',
                borderLeft: `2px solid ${selected?.type === item.type ? item.color : 'transparent'}`,
                transition: 'all 0.1s',
              }}
                onMouseEnter={(e) => { if (!isEdit && selected?.type !== item.type) (e.currentTarget as HTMLElement).style.background = '#0a1f3d'; }}
                onMouseLeave={(e) => { if (!isEdit && selected?.type !== item.type) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, fontWeight: 700, color: item.color, background: item.color + '18', padding: '1px 5px', flexShrink: 0 }}>
                    {item.badge}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#c8deff' }}>{item.label}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: '#2a4a7a' }}>{item.type}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right form */}
          <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
            {!selected ? (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: '#2a4a7a', textAlign: 'center', paddingTop: 40 }}>
                &gt; SELECT STEP TYPE
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #1a3a6e' }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, fontWeight: 700, color: selected.color, background: selected.color + '18', padding: '4px 10px' }}>
                    {selected.badge}
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#c8deff', letterSpacing: '0.03em' }}>{selected.label}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a' }}>{selected.type}</div>
                  </div>
                </div>

                <label style={lbl}>// NAME</label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="step_name"
                  onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }} onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }} />

                <label style={lbl}>// REF <span style={{ color: '#1a3a6e' }}>(unique)</span></label>
                <input value={ref} onChange={(e) => setRef(e.target.value)} style={{ ...inp, opacity: isEdit ? 0.5 : 1 }} disabled={isEdit}
                  onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }} onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }} />

                {existingRefs.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={lbl}>// ON_SUCCESS</label>
                      <select value={onSuccess ?? ''} onChange={(e) => setOnSuccess(e.target.value)} style={selStyle}>
                        <option value="">— END —</option>
                        {existingRefs.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>// ON_FAILURE</label>
                      <select value={onFailure ?? ''} onChange={(e) => setOnFailure(e.target.value)} style={selStyle}>
                        <option value="">— FAIL —</option>
                        {existingRefs.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={lbl}>// MAX_RETRIES</label>
                    <input type="number" min={1} max={10} value={retryAttempts} onChange={(e) => setRetryAttempts(e.target.value)} style={inp}
                      onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }} onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }} />
                  </div>
                  <div>
                    <label style={lbl}>// RETRY_INTERVAL</label>
                    <input value={retryInterval} onChange={(e) => setRetryInterval(e.target.value)} placeholder="1s / 30s" style={inp}
                      onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }} onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }} />
                  </div>
                </div>

                {isAgentSelected && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #1a3a6e' }}>
                    <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, color: '#a06aff', letterSpacing: '0.15em', marginBottom: 14 }}>// AGENT CONFIG</div>

                    <label style={lbl}>// AGENT_NAME</label>
                    <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="ugcResearchAgent" style={inp}
                      onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }} onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }} />

                    <label style={lbl}>// SYSTEM_PROMPT <span style={{ color: '#1a3a6e' }}>(optional)</span></label>
                    <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={3}
                      placeholder="You are a UGC sourcing specialist. Return structured JSON."
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 }}>
                      <label style={{ ...lbl, marginTop: 0, marginBottom: 0 }}>// PROMPT_TEMPLATE</label>
                      <button onClick={() => setVarPickerOpen((o) => !o)} style={{ background: 'transparent', border: '1px solid #2050a0', color: '#4da6ff', padding: '2px 8px', fontFamily: "'Orbitron', monospace", fontSize: 8, cursor: 'pointer', letterSpacing: '0.1em' }}>
                        + VAR
                      </button>
                    </div>

                    {varPickerOpen && (
                      <div style={{ background: '#040d1a', border: '1px solid #1a3a6e', marginBottom: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '4px 10px', fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: '#2050a0', borderBottom: '1px solid #1a3a6e', letterSpacing: '0.1em' }}>INSERT AT CURSOR</div>
                        {injectionVars.map((v) => (
                          <div key={v.value} onClick={() => insertVar(v.value)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #071428', display: 'flex', alignItems: 'center', gap: 8 }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#0a1f3d'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                            <code style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#4da6ff', background: '#4da6ff12', padding: '1px 6px' }}>{`{{${v.value}}}`}</code>
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a' }}>{v.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <textarea ref={promptRef} value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} rows={6}
                      placeholder={'Research this brand: {{$.input.brandName}}'}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 2 }}>
                      <div>
                        <label style={lbl}>// THREAD_ID_PATH</label>
                        <input value={threadIdPath} onChange={(e) => setThreadIdPath(e.target.value)} placeholder="$.input.threadId" style={inp}
                          onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }} onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }} />
                      </div>
                      <div>
                        <label style={lbl}>// RESOURCE_ID_PATH</label>
                        <input value={resourceIdPath} onChange={(e) => setResourceIdPath(e.target.value)} placeholder="$.input.userId" style={inp}
                          onFocus={(e) => { e.target.style.borderColor = '#4da6ff'; }} onBlur={(e) => { e.target.style.borderColor = '#1a3a6e'; }} />
                      </div>
                    </div>

                    <label style={lbl}>// TOOLS</label>
                    <ToolEditor tools={tools} onChange={setTools} />
                  </div>
                )}

                {!isAgentSelected && (
                  <>
                    <label style={lbl}>
                      // CONFIG_JSON
                      {configError && <span style={{ color: '#ff4a6e', marginLeft: 8 }}>{configError}</span>}
                    </label>
                    <textarea value={configText} onChange={(e) => { setConfigText(e.target.value); setConfigError(''); }}
                      onBlur={validateConfig} rows={8}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.6, border: configError ? '1px solid #ff4a6e' : '1px solid #1a3a6e' }} />
                  </>
                )}

                {error && (
                  <div style={{ background: '#ff4a6e10', border: '1px solid #ff4a6e40', padding: '8px 12px', color: '#ff4a6e', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, marginTop: 12 }}>
                    ERR: {error}
                  </div>
                )}

                <button onClick={handleSave} disabled={saving || !name.trim() || !ref.trim()} style={{
                  marginTop: 16, width: '100%', padding: '11px 0',
                  background: saving || !name.trim() || !ref.trim() ? '#0a1f3d' : selected.color,
                  color: saving || !name.trim() || !ref.trim() ? '#2a4a7a' : '#040d1a',
                  border: 'none', fontFamily: "'Orbitron', monospace", fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.2em', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}>
                  {saving ? 'SAVING...' : isEdit ? 'COMMIT CHANGES' : 'ADD STEP'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
