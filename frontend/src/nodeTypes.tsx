import { Handle, Position, type NodeProps } from '@xyflow/react';

export const typeColors: Record<string, string> = {
  'trigger/webhook': '#7c3aed',
  'trigger/schedule': '#7c3aed',
  'trigger/manual': '#7c3aed',
  agent: '#2563eb',
  http: '#0891b2',
  transform: '#059669',
  condition: '#d97706',
  delay: '#6b7280',
  'brand-research': '#db2777',
  'meta-ads-search': '#ea580c',
  'creator-vet': '#65a30d',
  'instagram-dm': '#c2410c',
};

export const typeIcons: Record<string, string> = {
  'trigger/webhook': '⚡',
  'trigger/schedule': '🕐',
  'trigger/manual': '▶',
  agent: '🤖',
  http: '🌐',
  transform: '🔄',
  condition: '🔀',
  delay: '⏱',
  'brand-research': '🔍',
  'meta-ads-search': '📢',
  'creator-vet': '✅',
  'instagram-dm': '💬',
};

const toolTypeIcons: Record<string, string> = {
  http: '🌐',
  builtin: '🔧',
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
  const icon = typeIcons[d.type] ?? '•';
  const isTrigger = d.isTrigger ?? d.type?.startsWith('trigger/');

  return (
    <div style={{
      background: '#1e1e2e',
      border: `2px solid ${selected ? '#fff' : color}`,
      borderRadius: 10,
      minWidth: 160,
      boxShadow: selected ? `0 0 0 3px ${color}55` : '0 2px 8px #0008',
      fontFamily: 'sans-serif',
      overflow: 'hidden',
    }}>
      <div style={{ background: color, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          {d.type}
        </span>
      </div>
      <div style={{ padding: '8px 12px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{d.label}</div>
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>ref: {d.ref}</div>
      </div>

      {!isTrigger && <Handle type="target" position={Position.Top} style={{ background: color }} />}
      <Handle type="source" position={Position.Bottom} style={{ background: color }} id="success" />
      {d.type === 'condition' && (
        <Handle type="source" position={Position.Right} style={{ background: '#ef4444', top: '50%' }} id="failure" />
      )}
    </div>
  );
}

// ── AI Agent node ──────────────────────────────────────────────────────────

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const color = '#2563eb';
  const tools = d.tools ?? [];

  return (
    <div style={{
      background: '#1e1e2e',
      border: `2px solid ${selected ? '#fff' : color}`,
      borderRadius: 10,
      minWidth: 220,
      boxShadow: selected ? `0 0 0 3px ${color}55` : '0 2px 8px #0008',
      fontFamily: 'sans-serif',
      overflow: 'visible',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ background: color, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0' }}>
        <span style={{ fontSize: 14 }}>🤖</span>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>AI Agent</span>
      </div>

      {/* Name */}
      <div style={{ padding: '8px 12px 4px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{d.label}</div>
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>ref: {d.ref}</div>
      </div>

      {/* Tools section */}
      {tools.length > 0 && (
        <div style={{ borderTop: '1px solid #2a2a3e', margin: '4px 0 0' }}>
          <div style={{ padding: '4px 12px', color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Tools
          </div>
          {tools.map((tool, i) => (
            <div key={tool.name} style={{ position: 'relative', padding: '5px 36px 5px 12px', borderTop: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{toolTypeIcons[tool.type] ?? '🔧'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.name}</div>
                <div style={{ color: '#475569', fontSize: 10 }}>{tool.type}</div>
              </div>
              {/* Per-tool source handle on the right */}
              <Handle
                type="source"
                position={Position.Right}
                id={`tool-${tool.name}`}
                style={{
                  background: '#0891b2',
                  border: '2px solid #1e1e2e',
                  width: 10, height: 10,
                  right: -5,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {tools.length === 0 && (
        <div style={{ padding: '6px 12px 10px', color: '#334155', fontSize: 11, fontStyle: 'italic' }}>
          No tools — double-click to add
        </div>
      )}

      {/* Flow handles */}
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color }} id="success" />
      <Handle type="source" position={Position.Left} style={{ background: '#ef4444' }} id="failure" />
    </div>
  );
}

export const nodeTypes = { step: StepNode, agent: AgentNode };
