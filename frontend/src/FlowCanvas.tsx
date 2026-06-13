import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type EdgeChange,
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
      id: step.ref,
      type: isAgent ? 'agent' : 'step',
      position: { x: 250, y: i * 160 },
      data: {
        label: step.name,
        type: step.type,
        ref: step.ref,
        isTrigger: step.type.startsWith('trigger/'),
        tools: isAgent ? (config?.tools ?? []) : undefined,
      },
    };
  });

  const edges: Edge[] = [];
  for (const step of steps) {
    if (step.onSuccess) {
      edges.push(makeEdge(step.ref, step.onSuccess, 'success'));
    }
    if (step.onFailure) {
      edges.push(makeEdge(step.ref, step.onFailure, 'failure'));
    }
  }

  return { nodes, edges };
}

function makeEdge(source: string, target: string, handle: 'success' | 'failure'): Edge {
  return {
    id: `${source}-${handle}-${target}`,
    source,
    target,
    sourceHandle: handle,
    label: handle,
    style: { stroke: handle === 'success' ? '#22c55e' : '#ef4444' },
    labelStyle: { fill: handle === 'success' ? '#22c55e' : '#ef4444', fontSize: 10 },
  };
}

// Derive step payloads from current nodes + edges
function buildStepsFromGraph(steps: Step[], edges: Edge[]): Step[] {
  return steps.map((step) => {
    const successEdge = edges.find((e) => e.source === step.ref && e.sourceHandle === 'success');
    const failureEdge = edges.find((e) => e.source === step.ref && e.sourceHandle === 'failure');
    return {
      ...step,
      onSuccess: successEdge?.target ?? null,
      onFailure: failureEdge?.target ?? null,
    };
  });
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
  // Keep a ref to current steps so we can read them at save time
  const stepsRef = useRef<Step[]>([]);

  useEffect(() => {
    if (!flow?.steps) return;
    stepsRef.current = flow.steps;
    const { nodes: n, edges: e } = stepsToGraph(flow.steps);
    setNodes(n);
    setEdges(e);
    setDirty(false);
    setSaveError('');
  }, [flow, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const handle = (connection.sourceHandle ?? 'success') as 'success' | 'failure';
      // Remove any existing edge from same source+handle (one edge per handle)
      setEdges((eds) => {
        const filtered = eds.filter(
          (e) => !(e.source === connection.source && e.sourceHandle === handle),
        );
        return addEdge(makeEdge(connection.source!, connection.target!, handle), filtered);
      });
      setDirty(true);
    },
    [setEdges],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === 'remove')) setDirty(true);
    },
    [onEdgesChange],
  );

  async function handleSave() {
    if (!flow) return;
    setSaving(true);
    setSaveError('');
    try {
      const updatedSteps = buildStepsFromGraph(stepsRef.current, edges);
      const saved = await upsertSteps(flow.id, updatedSteps);
      const updated = { ...flow, steps: saved as Step[] };
      stepsRef.current = updated.steps;
      onSaved(updated);
      setDirty(false);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!flow) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 16 }}>
        ← Select a flow to visualise
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onNodeDoubleClick={(_, node) => onNodeDoubleClick(node.id)}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
      >
        <Background color="#2a2a3e" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { type?: string };
            const colors: Record<string, string> = {
              'trigger/webhook': '#7c3aed', 'trigger/schedule': '#7c3aed', 'trigger/manual': '#7c3aed',
              agent: '#2563eb', http: '#0891b2', transform: '#059669',
              condition: '#d97706', delay: '#6b7280',
            };
            return colors[d?.type ?? ''] ?? '#374151';
          }}
          style={{ background: '#1e1e2e' }}
        />
      </ReactFlow>

      {/* Save bar */}
      <div style={{
        position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 10, zIndex: 10,
      }}>
        {saveError && (
          <span style={{ color: '#fca5a5', fontSize: 12, background: '#13131f', padding: '4px 10px', borderRadius: 6 }}>
            {saveError}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            background: dirty ? '#2563eb' : '#1e1e2e',
            color: dirty ? '#fff' : '#475569',
            border: `1px solid ${dirty ? '#2563eb' : '#2a2a3e'}`,
            borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 600,
            cursor: dirty && !saving ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          {saving ? 'Saving…' : dirty ? 'Save connections' : 'Saved'}
        </button>
      </div>
    </div>
  );
}
