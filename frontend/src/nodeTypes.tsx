import { Handle, Position, type NodeProps } from '@xyflow/react';

export const typeColors: Record<string, string> = {
  'trigger/webhook':  '#4da6ff',
  'trigger/schedule': '#4da6ff',
  'trigger/manual':   '#4da6ff',
  agent:              '#a06aff',
  http:               '#4affd4',
  transform:          '#ffda4a',
  condition:          '#ff9a4a',
  delay:              '#6a9fd8',
  'brand-research':   '#ff6af0',
  'meta-ads-search':  '#ffaa4a',
  'creator-vet':      '#4affaa',
  'instagram-dm':     '#ff6a8a',
};

export const typeBadges: Record<string, string> = {
  'trigger/webhook':  'WH', 'trigger/schedule': 'SC', 'trigger/manual': 'MN',
  agent: 'AI', http: 'HT', transform: 'TX', condition: 'IF',
  delay: 'DL', 'brand-research': 'BR', 'meta-ads-search': 'MA',
  'creator-vet': 'CV', 'instagram-dm': 'DM',
};

export interface ToolInfo { name: string; type: 'http' | 'builtin'; description: string; }
export interface StepNodeData { label: string; type: string; ref: string; isTrigger?: boolean; tools?: ToolInfo[]; }

export function StepNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const color = typeColors[d.type] ?? '#6a9fd8';
  const badge = typeBadges[d.type] ?? '??';
  const isTrigger = d.isTrigger ?? d.type?.startsWith('trigger/');

  return (
    <div style={{
      background: '#071428',
      border: `1px solid ${selected ? color : '#1a3a6e'}`,
      minWidth: 160, position: 'relative', overflow: 'hidden',
      boxShadow: selected ? `0 0 12px ${color}40` : '0 2px 8px #000a',
      fontFamily: "'Rajdhani', system-ui, sans-serif",
    }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />

      <div style={{ padding: '8px 10px 8px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color, background: color + '18', padding: '1px 5px' }}>
            {badge}
          </span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: '#2050a0', letterSpacing: '0.05em' }}>{d.type}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#c8deff', letterSpacing: '0.02em' }}>{d.label}</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a', marginTop: 2 }}>#{d.ref}</div>
      </div>

      {!isTrigger && <Handle type="target" position={Position.Top} style={{ background: color, border: `2px solid #071428`, width: 8, height: 8, borderRadius: 0 }} />}
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: `2px solid #071428`, width: 8, height: 8, borderRadius: 0 }} id="success" />
      {d.type === 'condition' && (
        <Handle type="source" position={Position.Right} style={{ background: '#ff4a6e', border: `2px solid #071428`, top: '50%', width: 8, height: 8, borderRadius: 0 }} id="failure" />
      )}
    </div>
  );
}

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const color = '#a06aff';
  const tools = d.tools ?? [];

  return (
    <div style={{
      background: '#071428', border: `1px solid ${selected ? color : '#1a3a6e'}`,
      minWidth: 220, position: 'relative', overflow: 'visible',
      boxShadow: selected ? `0 0 12px ${color}40` : '0 2px 8px #000a',
      fontFamily: "'Rajdhani', system-ui, sans-serif",
    }}>
      {/* Left accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />

      <div style={{ padding: '8px 10px 6px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color, background: color + '18', padding: '1px 5px' }}>AI</span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: '#2050a0' }}>agent</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#c8deff' }}>{d.label}</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a', marginTop: 2 }}>#{d.ref}</div>
      </div>

      {tools.length > 0 && (
        <div style={{ borderTop: '1px solid #1a3a6e' }}>
          <div style={{ padding: '3px 10px 3px 14px', fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: '#2050a0', letterSpacing: '0.1em' }}>TOOLS</div>
          {tools.map((tool) => (
            <div key={tool.name} style={{ position: 'relative', padding: '4px 36px 4px 14px', borderTop: '1px solid #0a1f3d', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: tool.type === 'builtin' ? color : '#4affd4', background: (tool.type === 'builtin' ? color : '#4affd4') + '18', padding: '1px 4px' }}>
                {tool.type === 'builtin' ? 'BI' : 'HT'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#c8deff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.name}</div>
              </div>
              <Handle type="source" position={Position.Right} id={`tool-${tool.name}`}
                style={{ background: '#4affd4', border: '2px solid #071428', width: 8, height: 8, borderRadius: 0, right: -4, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          ))}
        </div>
      )}
      {tools.length === 0 && (
        <div style={{ padding: '4px 10px 10px 14px', fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#2a4a7a' }}>
          &gt; NO TOOLS — DBL CLICK
        </div>
      )}

      <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid #071428', width: 8, height: 8, borderRadius: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid #071428', width: 8, height: 8, borderRadius: 0 }} id="success" />
      <Handle type="source" position={Position.Left} style={{ background: '#ff4a6e', border: '2px solid #071428', width: 8, height: 8, borderRadius: 0 }} id="failure" />
    </div>
  );
}

export const nodeTypes = { step: StepNode, agent: AgentNode };
