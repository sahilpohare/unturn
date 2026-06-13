import { useState, useRef } from 'react';
import type { Flow, Step, StepType } from './types';
import * as api from './api';
import { ToolEditor, type ToolDef } from './ToolEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const STEP_CATALOGUE: { type: StepType; label: string; badge: string; color: string; defaultConfig: Record<string, unknown> }[] = [
  { type: 'trigger/manual',   label: 'Manual Trigger',   badge: 'MN', color: 'var(--c-trigger)',  defaultConfig: {} },
  { type: 'trigger/webhook',  label: 'Webhook Trigger',  badge: 'WH', color: 'var(--c-trigger)',  defaultConfig: { secret: '' } },
  { type: 'trigger/schedule', label: 'Schedule Trigger', badge: 'SC', color: 'var(--c-trigger)',  defaultConfig: { cron: '0 9 * * 1' } },
  { type: 'agent',            label: 'AI Agent',         badge: 'AI', color: 'var(--c-agent)',    defaultConfig: { agentName: '', promptTemplate: '', tools: [] } },
  { type: 'http',             label: 'HTTP Request',     badge: 'HT', color: 'var(--c-http)',     defaultConfig: { url: '', method: 'GET' } },
  { type: 'transform',        label: 'Transform',        badge: 'TX', color: 'var(--c-transform)',defaultConfig: { mapping: {} } },
  { type: 'condition',        label: 'Condition',        badge: 'IF', color: 'var(--c-condition)',defaultConfig: { expression: '', onTrue: '', onFalse: '' } },
  { type: 'delay',            label: 'Delay',            badge: 'DL', color: 'var(--c-delay)',    defaultConfig: { duration: '30s' } },
  { type: 'brand-research',   label: 'Brand Research',   badge: 'BR', color: 'var(--c-brand)',    defaultConfig: { websiteUrl: '' } },
  { type: 'meta-ads-search',  label: 'Meta Ads Search',  badge: 'MA', color: 'var(--c-meta)',     defaultConfig: { pageIdPath: '', countries: ['US'] } },
  { type: 'creator-vet',      label: 'Creator Vet',      badge: 'CV', color: 'var(--c-creator)',  defaultConfig: { handlesPath: '' } },
  { type: 'instagram-dm',     label: 'Instagram DM',     badge: 'DM', color: 'var(--c-dm)',       defaultConfig: { recipientIdPath: '', messagePath: '' } },
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
    if (!editStep) return '';
    const c = { ...(editStep.config as any) };
    if (editStep.type === 'agent') return '';
    return JSON.stringify(c, null, 2);
  });
  const [configError, setConfigError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    if (item.type === 'agent') { delete cfg.tools; setSystemPrompt(''); setConfigText(''); }
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
      return { agentName, systemPrompt: systemPrompt || undefined, promptTemplate, tools, threadIdPath: threadIdPath || undefined, resourceIdPath: resourceIdPath || undefined };
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
      const retryPolicy = { maximumAttempts: Math.max(1, parseInt(retryAttempts, 10) || 3), initialInterval: retryInterval || '1s' };
      let allSteps;
      if (isEdit) {
        allSteps = existing.map((s) =>
          s.id === editStep.id
            ? { ...s, name: name.trim(), config, onSuccess: onSuccess || null, onFailure: onFailure || null, retryPolicy }
            : s,
        );
      } else {
        const base = isTrigger ? existing.filter((s) => !s.type.startsWith('trigger/')) : existing;
        const newStep = {
          ref: ref.trim(), type: selected.type, name: name.trim(),
          position: isTrigger ? 0 : base.length, config,
          onSuccess: onSuccess || null, onFailure: onFailure || null,
          retryPolicy,
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
  const modalWidth = isAgentSelected || isAgent ? 700 : 580;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-mid)',
        borderRadius: 14,
        width: modalWidth,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 80px #000d',
        overflow: 'hidden',
        transition: 'width 0.15s',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-mid)', flexShrink: 0 }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Step' : 'Add Step'}
          </span>
          <div className="flex items-center gap-2">
            {isEdit && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
                className="h-7 text-xs"
              >
                Delete
              </Button>
            )}
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
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: type palette */}
          <div className="overflow-y-auto p-2" style={{ width: 192, borderRight: '1px solid var(--border-mid)', flexShrink: 0 }}>
            {STEP_CATALOGUE.map((item) => (
              <div
                key={item.type}
                onClick={() => pickType(item)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 transition-all"
                style={{
                  cursor: isEdit ? 'default' : 'pointer',
                  opacity: isEdit && item.type !== selected?.type ? 0.2 : 1,
                  background: selected?.type === item.type ? item.color + '18' : 'transparent',
                  border: `1px solid ${selected?.type === item.type ? item.color + '60' : 'transparent'}`,
                }}
                onMouseEnter={(e) => { if (!isEdit && selected?.type !== item.type) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { if (!isEdit && selected?.type !== item.type) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: 5, fontSize: 8, fontWeight: 700,
                  letterSpacing: 0.5, flexShrink: 0,
                  background: item.color + '22', color: item.color,
                }}>
                  {item.badge}
                </span>
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.type}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: form */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selected ? (
              <div className="text-sm text-center pt-12" style={{ color: 'var(--text-muted)' }}>
                Pick a step type from the list
              </div>
            ) : (
              <>
                {/* Type badge */}
                <div className="flex items-center gap-3 mb-5">
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                    background: selected.color + '22', color: selected.color,
                  }}>
                    {selected.badge}
                  </span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{selected.type}</div>
                  </div>
                </div>

                <FieldLabel>Name</FieldLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Step name" className="mb-3 h-8 text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />

                <FieldLabel>Ref <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(unique)</span></FieldLabel>
                <Input value={ref} onChange={(e) => setRef(e.target.value)} disabled={isEdit} className="mb-3 h-8 text-xs font-mono" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', opacity: isEdit ? 0.6 : 1 }} />

                {existingRefs.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-0">
                    <div>
                      <FieldLabel>On Success</FieldLabel>
                      <select
                        value={onSuccess ?? ''}
                        onChange={(e) => setOnSuccess(e.target.value)}
                        className="w-full h-8 text-xs rounded-lg px-2.5"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        <option value="">— end of flow —</option>
                        {existingRefs.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>On Failure</FieldLabel>
                      <select
                        value={onFailure ?? ''}
                        onChange={(e) => setOnFailure(e.target.value)}
                        className="w-full h-8 text-xs rounded-lg px-2.5"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        <option value="">— fail flow —</option>
                        {existingRefs.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Max Retries</FieldLabel>
                    <Input type="number" min={1} max={10} value={retryAttempts} onChange={(e) => setRetryAttempts(e.target.value)} className="h-8 text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <FieldLabel>Retry Interval</FieldLabel>
                    <Input value={retryInterval} onChange={(e) => setRetryInterval(e.target.value)} placeholder="1s / 30s / 2m" className="h-8 text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />
                  </div>
                </div>

                {/* Agent-specific fields */}
                {isAgentSelected && (
                  <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border-mid)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--c-agent)' }}>
                      Agent Configuration
                    </div>

                    <FieldLabel>Agent Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(label / persona)</span></FieldLabel>
                    <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. ugcResearchAgent" className="mb-3 h-8 text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />

                    <FieldLabel>System Prompt <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></FieldLabel>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={3}
                      placeholder="You are a UGC sourcing specialist. Return structured JSON."
                      className="mb-3 text-xs resize-y"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                    />

                    <div className="flex items-center justify-between mb-1.5">
                      <FieldLabel className="mb-0">Prompt Template</FieldLabel>
                      <button
                        onClick={() => setVarPickerOpen((o) => !o)}
                        className="text-[10px] px-2 py-0.5 rounded font-semibold transition-colors"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--c-agent)' }}
                      >
                        + inject var
                      </button>
                    </div>

                    {varPickerOpen && (
                      <div className="rounded-lg mb-2 overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                        <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-mid)' }}>
                          Click to insert at cursor
                        </div>
                        {injectionVars.map((v) => (
                          <div
                            key={v.value}
                            onClick={() => insertVar(v.value)}
                            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
                            style={{ borderBottom: '1px solid var(--bg-base)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <code className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--c-agent)', background: '#38bdf810', fontFamily: 'var(--font-mono)' }}>{`{{${v.value}}}`}</code>
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{v.label}</span>
                          </div>
                        ))}
                        {injectionVars.length === 0 && (
                          <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>No prior steps yet</div>
                        )}
                      </div>
                    )}

                    <Textarea
                      ref={promptRef}
                      value={promptTemplate}
                      onChange={(e) => setPromptTemplate(e.target.value)}
                      rows={6}
                      placeholder={'You are a helpful assistant.\n\nResearch this brand: {{$.input.brandName}}\n\nPrevious results: {{$.steps.research-step.text}}'}
                      className="mb-1 text-xs resize-y"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}
                    />
                    <div className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
                      Use <code style={{ color: 'var(--c-agent)', fontFamily: 'var(--font-mono)' }}>{'{{$.input.field}}'}</code> or <code style={{ color: 'var(--c-agent)', fontFamily: 'var(--font-mono)' }}>{'{{$.steps.ref.field}}'}</code>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <FieldLabel>Thread ID path <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></FieldLabel>
                        <Input value={threadIdPath} onChange={(e) => setThreadIdPath(e.target.value)} placeholder="$.input.threadId" className="h-8 text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />
                      </div>
                      <div>
                        <FieldLabel>Resource ID path <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></FieldLabel>
                        <Input value={resourceIdPath} onChange={(e) => setResourceIdPath(e.target.value)} placeholder="$.input.userId" className="h-8 text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />
                      </div>
                    </div>

                    <FieldLabel>Tools</FieldLabel>
                    <ToolEditor tools={tools} onChange={setTools} />
                  </div>
                )}

                {/* Generic JSON config */}
                {!isAgentSelected && (
                  <>
                    <FieldLabel>
                      Config (JSON)
                      {configError && <span className="ml-2 font-normal" style={{ color: 'var(--danger)' }}>{configError}</span>}
                    </FieldLabel>
                    <Textarea
                      value={configText}
                      onChange={(e) => { setConfigText(e.target.value); setConfigError(''); }}
                      onBlur={validateConfig}
                      rows={8}
                      className="text-xs resize-y"
                      style={{ background: 'var(--bg-elevated)', border: `1px solid ${configError ? 'var(--danger)' : 'var(--border-mid)'}`, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                    />
                  </>
                )}

                {error && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: '#ef444412', border: '1px solid #ef444440', color: '#fca5a5' }}>
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !ref.trim()}
                  className="w-full mt-4 h-9 text-sm font-semibold"
                  style={{ background: selected.color, color: '#fff', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Step'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 mt-3 ${className ?? ''}`} style={{ color: 'var(--text-secondary)' }}>
      {children}
    </div>
  );
}
