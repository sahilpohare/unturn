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
import { Button } from '@/components/ui/button';

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
    style: { stroke: handle === 'success' ? 'var(--success)' : 'var(--danger)', strokeWidth: 1.5 },
    labelStyle: { fill: handle === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: 9, fontFamily: 'var(--font-mono)' },
  };
}

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
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--bg-void)' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6M9 12h6M9 15h4" />
        </svg>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a flow to visualise</span>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full relative">
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
        <Background color="var(--border-mid)" gap={24} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { type?: string };
            const map: Record<string, string> = {
              'trigger/webhook': '#a78bfa', 'trigger/schedule': '#a78bfa', 'trigger/manual': '#a78bfa',
              agent: '#38bdf8', http: '#34d399', transform: '#fb923c',
              condition: '#f472b6', delay: '#94a3b8',
              'brand-research': '#e879f9', 'meta-ads-search': '#fb923c',
              'creator-vet': '#4ade80', 'instagram-dm': '#f87171',
            };
            return map[d?.type ?? ''] ?? '#374151';
          }}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 8 }}
        />
      </ReactFlow>

      {/* Save bar */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        {saveError && (
          <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--danger)', color: '#fca5a5' }}>
            {saveError}
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          size="sm"
          className="h-8 text-xs"
          style={dirty ? { background: 'var(--text-primary)', color: 'var(--bg-void)' } : { background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-mid)' }}
        >
          {saving ? 'Saving…' : dirty ? 'Save connections' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
