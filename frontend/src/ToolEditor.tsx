import { useState } from 'react';

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
    <div>
      {tools.map((tool, i) => (
        <div key={i} style={{ border: '1px solid #2a2a3e', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
          {/* Row */}
          <div
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: expanded === i ? '#1e1e2e' : 'transparent' }}
          >
            <span style={{ fontSize: 14 }}>{tool.type === 'http' ? '🌐' : '🔧'}</span>
            <span style={{ color: tool.name ? '#e2e8f0' : '#475569', fontSize: 13, flex: 1 }}>
              {tool.name || 'Unnamed tool'}
            </span>
            <span style={{ color: '#475569', fontSize: 11 }}>{tool.type}</span>
            <button
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
            >×</button>
            <span style={{ color: '#475569', fontSize: 12 }}>{expanded === i ? '▲' : '▼'}</span>
          </div>

          {/* Expanded editor */}
          {expanded === i && (
            <div style={{ padding: '12px', borderTop: '1px solid #2a2a3e', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Name">
                <input value={tool.name} onChange={(e) => update(i, { name: e.target.value })} style={inp} placeholder="my_tool" />
              </Row>
              <Row label="Type">
                <select value={tool.type} onChange={(e) => update(i, { type: e.target.value as 'http' | 'builtin' })} style={inp}>
                  <option value="http">HTTP</option>
                  <option value="builtin">Builtin</option>
                </select>
              </Row>
              <Row label="Description">
                <input value={tool.description} onChange={(e) => update(i, { description: e.target.value })} style={inp} placeholder="What this tool does" />
              </Row>

              {tool.type === 'http' && (
                <>
                  <Row label="Method">
                    <select value={tool.http?.method ?? 'GET'} onChange={(e) => update(i, { http: { ...tool.http, url: tool.http?.url ?? '', method: e.target.value } })} style={inp}>
                      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Row>
                  <Row label="URL">
                    <input value={tool.http?.url ?? ''} onChange={(e) => update(i, { http: { ...tool.http, url: e.target.value, method: tool.http?.method ?? 'GET' } })} style={inp} placeholder="https://api.example.com/..." />
                  </Row>
                </>
              )}

              {tool.type === 'builtin' && (
                <Row label="Builtin ID">
                  <select value={tool.builtinId ?? ''} onChange={(e) => update(i, { builtinId: e.target.value })} style={inp}>
                    <option value="">— select —</option>
                    {BUILTIN_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                </Row>
              )}

              <Row label="Input schema (JSON)">
                <textarea
                  rows={4}
                  value={JSON.stringify(tool.inputSchema, null, 2)}
                  onChange={(e) => {
                    try { update(i, { inputSchema: JSON.parse(e.target.value) }); } catch {}
                  }}
                  style={{ ...inp, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                />
              </Row>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={add}
        style={{
          width: '100%', padding: '7px 0', background: 'transparent',
          border: '1px dashed #2a2a3e', borderRadius: 8, color: '#3b82f6',
          cursor: 'pointer', fontSize: 13, marginTop: 4,
        }}
      >
        + Add tool
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'start', gap: 8 }}>
      <div style={{ color: '#64748b', fontSize: 11, paddingTop: 8 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', background: '#13131f', border: '1px solid #2a2a3e', borderRadius: 6,
  padding: '6px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box',
};
