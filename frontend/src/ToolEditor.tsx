import { useState } from 'react';

export interface ToolDef {
  name: string;
  type: 'http' | 'builtin';
  description: string;
  inputSchema: Record<string, unknown>;
  http?: { url: string; method: string; headers?: Record<string, string> };
  builtinId?: string;
}

interface Props { tools: ToolDef[]; onChange: (tools: ToolDef[]) => void; }

const BUILTIN_IDS = ['scrape-url', 'meta-ad-library', 'instagram-profile', 'send-instagram-dm', 'search-instagram-creators'];
const EMPTY_TOOL: ToolDef = { name: '', type: 'http', description: '', inputSchema: { properties: {} } };

const inp: React.CSSProperties = {
  background: '#040d1a', border: '1px solid #1a3a6e', padding: '5px 8px',
  color: '#c8deff', fontFamily: "'Share Tech Mono', monospace", fontSize: 11,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export function ToolEditor({ tools, onChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function add() { const next = [...tools, { ...EMPTY_TOOL }]; onChange(next); setExpanded(next.length - 1); }
  function remove(i: number) { onChange(tools.filter((_, j) => j !== i)); setExpanded(null); }
  function update(i: number, patch: Partial<ToolDef>) { onChange(tools.map((t, j) => j === i ? { ...t, ...patch } : t)); }

  return (
    <div style={{ marginTop: 4 }}>
      {tools.map((tool, i) => (
        <div key={i} style={{ border: '1px solid #1a3a6e', marginBottom: 4, overflow: 'hidden' }}>
          <div onClick={() => setExpanded(expanded === i ? null : i)} style={{
            padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: expanded === i ? '#0a1f3d' : 'transparent',
          }}
            onMouseEnter={(e) => { if (expanded !== i) (e.currentTarget as HTMLElement).style.background = '#0a1f3d40'; }}
            onMouseLeave={(e) => { if (expanded !== i) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: tool.type === 'builtin' ? '#a06aff' : '#4affd4', background: (tool.type === 'builtin' ? '#a06aff' : '#4affd4') + '18', padding: '1px 4px' }}>
              {tool.type === 'builtin' ? 'BI' : 'HT'}
            </span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, flex: 1, color: tool.name ? '#c8deff' : '#2a4a7a' }}>
              {tool.name || 'unnamed_tool'}
            </span>
            <button onClick={(e) => { e.stopPropagation(); remove(i); }} style={{ background: 'none', border: 'none', color: '#ff4a6e', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: 12, padding: '0 4px' }}>×</button>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2050a0' }}>{expanded === i ? '▲' : '▼'}</span>
          </div>

          {expanded === i && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid #1a3a6e', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="NAME"><input value={tool.name} onChange={(e) => update(i, { name: e.target.value })} style={inp} placeholder="tool_name" /></Row>
              <Row label="TYPE">
                <select value={tool.type} onChange={(e) => update(i, { type: e.target.value as any })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="http">HTTP</option>
                  <option value="builtin">BUILTIN</option>
                </select>
              </Row>
              <Row label="DESC"><input value={tool.description} onChange={(e) => update(i, { description: e.target.value })} style={inp} placeholder="what this tool does" /></Row>
              {tool.type === 'http' && (<>
                <Row label="METHOD">
                  <select value={tool.http?.method ?? 'GET'} onChange={(e) => update(i, { http: { ...tool.http, url: tool.http?.url ?? '', method: e.target.value } })} style={{ ...inp, cursor: 'pointer' }}>
                    {['GET','POST','PUT','PATCH','DELETE'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Row>
                <Row label="URL"><input value={tool.http?.url ?? ''} onChange={(e) => update(i, { http: { ...tool.http, url: e.target.value, method: tool.http?.method ?? 'GET' } })} style={inp} placeholder="https://api.example.com/..." /></Row>
              </>)}
              {tool.type === 'builtin' && (
                <Row label="ID">
                  <select value={tool.builtinId ?? ''} onChange={(e) => update(i, { builtinId: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">— SELECT —</option>
                    {BUILTIN_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                </Row>
              )}
              <Row label="SCHEMA">
                <textarea rows={4} value={JSON.stringify(tool.inputSchema, null, 2)} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
                  onChange={(e) => { try { update(i, { inputSchema: JSON.parse(e.target.value) }); } catch {} }} />
              </Row>
            </div>
          )}
        </div>
      ))}

      <button onClick={add} style={{ width: '100%', padding: '6px 0', background: 'transparent', border: '1px dashed #1a3a6e', color: '#2050a0', cursor: 'pointer', fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: '0.15em', marginTop: 4 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#2050a0'; (e.currentTarget as HTMLElement).style.color = '#4da6ff'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a3a6e'; (e.currentTarget as HTMLElement).style.color = '#2050a0'; }}>
        + ADD TOOL
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'start', gap: 8 }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2050a0', paddingTop: 6, letterSpacing: '0.08em' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
