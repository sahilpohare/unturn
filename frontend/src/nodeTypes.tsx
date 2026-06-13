import { Handle, Position, type NodeProps } from '@xyflow/react';

export const typeColors: Record<string, string> = {
  'trigger/webhook':  'var(--c-trigger)',
  'trigger/schedule': 'var(--c-trigger)',
  'trigger/manual':   'var(--c-trigger)',
  agent:              'var(--c-agent)',
  http:               'var(--c-http)',
  transform:          'var(--c-transform)',
  condition:          'var(--c-condition)',
  delay:              'var(--c-delay)',
  'brand-research':   'var(--c-brand)',
  'meta-ads-search':  'var(--c-meta)',
  'creator-vet':      'var(--c-creator)',
  'instagram-dm':     'var(--c-dm)',
};

export const typeIcons: Record<string, string> = {
  'trigger/webhook':  'WH',
  'trigger/schedule': 'SC',
  'trigger/manual':   'MN',
  agent:              'AI',
  http:               'HT',
  transform:          'TX',
  condition:          'IF',
  delay:              'DL',
  'brand-research':   'BR',
  'meta-ads-search':  'MA',
  'creator-vet':      'CV',
  'instagram-dm':     'DM',
};

export interface ToolInfo {
  name: string;
  type: 'http' | 'builtin';
  description: string;
}

export interface StepNodeData {
  label: string;
  type: string;
  ref: string;
  isTrigger?: boolean;
  tools?: ToolInfo[];
}

// ── Generic step node ──────────────────────────────────────────────────────

export function StepNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const color = typeColors[d.type] ?? '#374151';
  const badge = typeIcons[d.type] ?? '?';
  const isTrigger = d.isTrigger ?? d.type?.startsWith('trigger/');

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1.5px solid ${selected ? color : 'var(--border-mid)'}`,
      borderRadius: 10,
      minWidth: 168,
      boxShadow: selected ? `0 0 0 3px ${color}30, 0 4px 16px #0009` : '0 2px 8px #0006',
      overflow: 'hidden',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Top accent line */}
      <div style={{ height: 2, background: color }} />

      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 5, fontSize: 9, fontWeight: 700,
            letterSpacing: 0.5, background: color + '22', color,
          }}>
            {badge}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
            {d.type}
          </span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{d.label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>#{d.ref}</div>
      </div>

      {!isTrigger && <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid var(--bg-card)', width: 8, height: 8 }} />}
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid var(--bg-card)', width: 8, height: 8 }} id="success" />
      {d.type === 'condition' && (
        <Handle type="source" position={Position.Right} style={{ background: 'var(--danger)', border: '2px solid var(--bg-card)', top: '50%', width: 8, height: 8 }} id="failure" />
      )}
    </div>
  );
}

// ── AI Agent node ──────────────────────────────────────────────────────────

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const color = 'var(--c-agent)';
  const tools = d.tools ?? [];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1.5px solid ${selected ? color : 'var(--border-mid)'}`,
      borderRadius: 10,
      minWidth: 220,
      boxShadow: selected ? `0 0 0 3px #38bdf830, 0 4px 16px #0009` : '0 2px 8px #0006',
      overflow: 'visible',
      position: 'relative',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Top accent line */}
      <div style={{ height: 2, background: color, borderRadius: '10px 10px 0 0' }} />

      {/* Header */}
      <div style={{ padding: '8px 12px 6px', display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 5, fontSize: 9, fontWeight: 700,
          letterSpacing: 0.5, background: '#38bdf822', color,
        }}>
          AI
        </span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{d.ref}</div>
        </div>
      </div>

      {/* Tools section */}
      {tools.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-mid)', marginTop: 2 }}>
          <div style={{ padding: '3px 12px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)' }}>
            Tools
          </div>
          {tools.map((tool) => (
            <div key={tool.name} style={{ position: 'relative', padding: '4px 36px 4px 12px', borderTop: '1px solid var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: tool.type === 'builtin' ? '#38bdf820' : '#34d39920', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: tool.type === 'builtin' ? color : 'var(--c-http)', fontWeight: 700, flexShrink: 0 }}>
                {tool.type === 'builtin' ? 'B' : 'H'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{tool.type}</div>
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id={`tool-${tool.name}`}
                style={{
                  background: 'var(--c-http)',
                  border: '2px solid var(--bg-card)',
                  width: 8, height: 8,
                  right: -4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {tools.length === 0 && (
        <div style={{ padding: '4px 12px 10px', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No tools — double-click to add
        </div>
      )}

      <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid var(--bg-card)', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid var(--bg-card)', width: 8, height: 8 }} id="success" />
      <Handle type="source" position={Position.Left} style={{ background: 'var(--danger)', border: '2px solid var(--bg-card)', width: 8, height: 8 }} id="failure" />
    </div>
  );
}

export const nodeTypes = { step: StepNode, agent: AgentNode };
