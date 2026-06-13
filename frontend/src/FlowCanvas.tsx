import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, type Connection, type Node, type Edge, type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodeTypes';
import { upsertSteps } from './api';
import type { Flow, Step } from './types';

type StepNode = Node<{ label: string; type: string; ref: string; isTrigger: boolean; tools?: unknown[] }>;

function stepsToGraph(steps: Step[]): { nodes: StepNode[]; edges: Edge[] } {
  const nodes: StepNode[] = steps.map((step, i) => {
    const isAgent = step.type === 'agent';
    const config = step.config as any;
    return {
      id: step.ref, type: isAgent ? 'agent' : 'step',
      position: { x: 250, y: i * 160 },
      data: { label: step.name, type: step.type, ref: step.ref, isTrigger: step.type.startsWith('trigger/'), tools: isAgent ? (config?.tools ?? []) : undefined },
    };
  });
  const edges: Edge[] = [];
  for (const step of steps) {
    if (step.onSuccess) edges.push(makeEdge(step.ref, step.onSuccess, 'success'));
    if (step.onFailure) edges.push(makeEdge(step.ref, step.onFailure, 'failure'));
  }
  return { nodes, edges };
}

function makeEdge(source: string, target: string, handle: 'success' | 'failure'): Edge {
  return {
    id: `${source}-${handle}-${target}`, source, target, sourceHandle: handle,
    label: handle,
    style: { stroke: handle === 'success' ? '#4affa0' : '#ff4a6e', strokeWidth: 1.5, strokeDasharray: '4 3' },
    labelStyle: { fill: handle === 'success' ? '#4affa0' : '#ff4a6e', fontSize: 9, fontFamily: "'Share Tech Mono', monospace" },
  };
}

function buildStepsFromGraph(steps: Step[], edges: Edge[]): Step[] {
  return steps.map((step) => ({
    ...step,
    onSuccess: edges.find((e) => e.source === step.ref && e.sourceHandle === 'success')?.target ?? null,
    onFailure: edges.find((e) => e.source === step.ref && e.sourceHandle === 'failure')?.target ?? null,
  }));
}

interface Props {
  flow: Flow | null;
  onNodeClick: (ref: string) => void;
  onNodeDoubleClick: (ref: string) => void;
  onSaved: (flow: Flow) => void;
}

export function FlowCanvas({ flow, onNodeClick, onNodeDoubleClick, onSaved }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const stepsRef = useRef<Step[]>([]);

  useEffect(() => {
    if (!flow?.steps) return;
    stepsRef.current = flow.steps;
    const { nodes: n, edges: e } = stepsToGraph(flow.steps);
    setNodes(n); setEdges(e); setDirty(false); setSaveError('');
  }, [flow, setNodes, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    const handle = (connection.sourceHandle ?? 'success') as 'success' | 'failure';
    setEdges((eds) => addEdge(makeEdge(connection.source!, connection.target!, handle),
      eds.filter((e) => !(e.source === connection.source && e.sourceHandle === handle))));
    setDirty(true);
  }, [setEdges]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    if (changes.some((c) => c.type === 'remove')) setDirty(true);
  }, [onEdgesChange]);

  async function handleSave() {
    if (!flow) return;
    setSaving(true); setSaveError('');
    try {
      const updatedSteps = buildStepsFromGraph(stepsRef.current, edges);
      const saved = await upsertSteps(flow.id, updatedSteps);
      const updated = { ...flow, steps: saved as Step[] };
      stepsRef.current = updated.steps;
      onSaved(updated); setDirty(false);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally { setSaving(false); }
  }

  if (!flow) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#040d1a', position: 'relative' }}>
        {/* Blueprint grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#1a3a6e40 1px, transparent 1px), linear-gradient(90deg, #1a3a6e40 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#2050a0', letterSpacing: '0.2em', marginBottom: 8 }}>
            NO FLOW SELECTED
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#1a3a6e' }}>
            &gt; SELECT A FLOW FROM SIDEBAR TO VISUALIZE
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative', background: '#040d1a' }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onNodeDoubleClick={(_, node) => onNodeDoubleClick(node.id)}
        nodeTypes={nodeTypes} fitView colorMode="dark"
      >
        <Background color="#1a3a6e" gap={40} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { type?: string };
            const m: Record<string, string> = {
              'trigger/webhook': '#4da6ff', 'trigger/schedule': '#4da6ff', 'trigger/manual': '#4da6ff',
              agent: '#a06aff', http: '#4affd4', transform: '#ffda4a', condition: '#ff9a4a',
              delay: '#6a9fd8', 'brand-research': '#ff6af0', 'meta-ads-search': '#ffaa4a',
              'creator-vet': '#4affaa', 'instagram-dm': '#ff6a8a',
            };
            return m[d?.type ?? ''] ?? '#1a3a6e';
          }}
          style={{ background: '#071428', border: '1px solid #1a3a6e' }}
        />
      </ReactFlow>

      {/* Save bar */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
        {saveError && (
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#ff4a6e', background: '#071428', border: '1px solid #ff4a6e40', padding: '4px 10px' }}>
            ERR: {saveError}
          </span>
        )}
        <button onClick={handleSave} disabled={!dirty || saving} style={{
          padding: '6px 16px',
          background: dirty ? '#4da6ff' : 'transparent',
          color: dirty ? '#040d1a' : '#2050a0',
          border: `1px solid ${dirty ? '#4da6ff' : '#1a3a6e'}`,
          fontFamily: "'Orbitron', monospace", fontSize: 9, fontWeight: 700,
          letterSpacing: '0.15em', cursor: dirty && !saving ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}>
          {saving ? 'SAVING...' : dirty ? 'COMMIT CHANGES' : 'SAVED'}
        </button>
      </div>
    </div>
  );
}
