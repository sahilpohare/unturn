import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export interface ToolDef {
  name: string;
  type: 'http' | 'builtin';
  description: string;
  inputSchema: Record<string, unknown>;
  http?: { url: string; method: string; headers?: Record<string, string> };
  builtinId?: string;
}

interface Props {
  tools: ToolDef[];
  onChange: (tools: ToolDef[]) => void;
}

const BUILTIN_IDS = ['scrape-url', 'meta-ad-library', 'instagram-profile', 'send-instagram-dm', 'search-instagram-creators'];

const EMPTY_TOOL: ToolDef = {
  name: '',
  type: 'http',
  description: '',
  inputSchema: { properties: {} },
};

export function ToolEditor({ tools, onChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function add() {
    const next = [...tools, { ...EMPTY_TOOL }];
    onChange(next);
    setExpanded(next.length - 1);
  }

  function remove(i: number) {
    onChange(tools.filter((_, j) => j !== i));
    setExpanded(null);
  }

  function update(i: number, patch: Partial<ToolDef>) {
    onChange(tools.map((t, j) => j === i ? { ...t, ...patch } : t));
  }

  return (
    <div className="space-y-1.5">
      {tools.map((tool, i) => (
        <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-mid)' }}>
          {/* Row */}
          <div
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
            style={{ background: expanded === i ? 'var(--bg-elevated)' : 'transparent' }}
            onMouseEnter={(e) => { if (expanded !== i) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            onMouseLeave={(e) => { if (expanded !== i) e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: tool.type === 'builtin' ? '#38bdf820' : '#34d39920', color: tool.type === 'builtin' ? 'var(--c-agent)' : 'var(--c-http)' }}>
              {tool.type === 'builtin' ? 'B' : 'H'}
            </span>
            <span className="text-xs flex-1" style={{ color: tool.name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {tool.name || 'Unnamed tool'}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{tool.type}</span>
            <button
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              className="w-5 h-5 flex items-center justify-center rounded transition-colors"
              style={{ color: 'var(--danger)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l8 8M9 1L1 9" />
              </svg>
            </button>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ color: 'var(--text-muted)', transform: expanded === i ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s', flexShrink: 0 }}>
              <path d="M5 7L1 3h8L5 7z" />
            </svg>
          </div>

          {/* Expanded editor */}
          {expanded === i && (
            <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-mid)' }}>
              <Row label="Name">
                <Input value={tool.name} onChange={(e) => update(i, { name: e.target.value })} className="h-7 text-xs font-mono" placeholder="my_tool" style={{ background: 'var(--bg-void)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />
              </Row>
              <Row label="Type">
                <select value={tool.type} onChange={(e) => update(i, { type: e.target.value as 'http' | 'builtin' })} className="w-full h-7 text-xs rounded-lg px-2" style={{ background: 'var(--bg-void)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}>
                  <option value="http">HTTP</option>
                  <option value="builtin">Builtin</option>
                </select>
              </Row>
              <Row label="Description">
                <Input value={tool.description} onChange={(e) => update(i, { description: e.target.value })} className="h-7 text-xs" placeholder="What this tool does" style={{ background: 'var(--bg-void)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />
              </Row>

              {tool.type === 'http' && (
                <>
                  <Row label="Method">
                    <select value={tool.http?.method ?? 'GET'} onChange={(e) => update(i, { http: { ...tool.http, url: tool.http?.url ?? '', method: e.target.value } })} className="w-full h-7 text-xs rounded-lg px-2" style={{ background: 'var(--bg-void)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}>
                      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Row>
                  <Row label="URL">
                    <Input value={tool.http?.url ?? ''} onChange={(e) => update(i, { http: { ...tool.http, url: e.target.value, method: tool.http?.method ?? 'GET' } })} className="h-7 text-xs font-mono" placeholder="https://api.example.com/..." style={{ background: 'var(--bg-void)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }} />
                  </Row>
                </>
              )}

              {tool.type === 'builtin' && (
                <Row label="Builtin ID">
                  <select value={tool.builtinId ?? ''} onChange={(e) => update(i, { builtinId: e.target.value })} className="w-full h-7 text-xs rounded-lg px-2" style={{ background: 'var(--bg-void)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}>
                    <option value="">— select —</option>
                    {BUILTIN_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                </Row>
              )}

              <Row label="Input schema">
                <Textarea
                  rows={4}
                  value={JSON.stringify(tool.inputSchema, null, 2)}
                  onChange={(e) => {
                    try { update(i, { inputSchema: JSON.parse(e.target.value) }); } catch {}
                  }}
                  className="text-[11px] resize-y"
                  style={{ background: 'var(--bg-void)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                />
              </Row>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={add}
        className="w-full py-2 text-xs rounded-lg transition-colors"
        style={{ background: 'transparent', border: '1px dashed var(--border-mid)', color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        + Add tool
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: '90px 1fr', alignItems: 'start' }}>
      <div className="text-[10px] pt-1.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
