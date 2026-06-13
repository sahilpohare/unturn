import { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowCanvas } from './FlowCanvas';
import { Sidebar } from './Sidebar';
import { LoginPage } from './LoginPage';
import { AddStepPanel } from './AddStepPanel';
import { CredentialsPanel } from './CredentialsPanel';
import * as api from './api';
import type { Flow, Step } from './types';

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token') ?? '');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  function handleLogin(t: string) {
    sessionStorage.setItem('token', t);
    setToken(t);
    api.setToken(t);
  }

  function handleLogout() {
    sessionStorage.removeItem('token');
    setToken('');
    setFlows([]);
    setSelectedFlow(null);
  }

  const refresh = useCallback(async () => {
    try {
      const list = await api.listFlows();
      setFlows(list);
    } catch {
      setFlows([]);
    }
  }, []);

  async function selectFlow(flow: Flow) {
    setSelectedStep(null);
    try {
      const full = await api.getFlow(flow.id);
      setSelectedFlow(full);
    } catch {
      setSelectedFlow(flow);
    }
  }

  function handleStepSaved(updated: Flow) {
    setSelectedFlow(updated);
    setFlows((prev) => prev.map((f) => f.id === updated.id ? { ...f, ...updated } : f));
  }

  function handleNodeDoubleClick(ref: string) {
    if (!selectedFlow) return;
    const step = selectedFlow.steps?.find((s) => s.ref === ref);
    if (step) setEditingStep(step);
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-void)' }}>
      <Sidebar
        flows={flows}
        selectedFlow={selectedFlow}
        onSelectFlow={selectFlow}
        onRefresh={refresh}
        selectedStep={selectedStep}
        onLogout={handleLogout}
        onAddStep={() => setAddingStep(true)}
        onOpenCredentials={() => setShowCredentials(true)}
      />
      <ReactFlowProvider>
        <FlowCanvas
          flow={selectedFlow}
          onNodeClick={setSelectedStep}
          onNodeDoubleClick={handleNodeDoubleClick}
          onSaved={handleStepSaved}
        />
      </ReactFlowProvider>

      {addingStep && selectedFlow && (
        <AddStepPanel
          flow={selectedFlow}
          onClose={() => setAddingStep(false)}
          onSaved={handleStepSaved}
        />
      )}

      {editingStep && selectedFlow && (
        <AddStepPanel
          flow={selectedFlow}
          editStep={editingStep}
          onClose={() => setEditingStep(null)}
          onSaved={handleStepSaved}
        />
      )}

      {showCredentials && (
        <CredentialsPanel
          tenantId={api.getTenantId()}
          onClose={() => setShowCredentials(false)}
        />
      )}
    </div>
  );
}
