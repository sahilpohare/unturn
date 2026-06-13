import type { StepType, StepConfig } from './step.entity';
import type { ToolConfig } from './steps/agent.step';

// Serialisable snapshot passed to the Temporal workflow as input
export interface FlowStepSnapshot {
  id: string;
  ref: string;
  type: StepType;
  name: string;
  position: number;
  config: StepConfig;
  onSuccess: string | null; // ref of next step
  onFailure: string | null; // ref of next step
  retryPolicy: { maximumAttempts: number; initialInterval?: string };
}

export interface FlowSnapshot {
  id: string;
  name: string;
  tenantId: string;
  steps: FlowStepSnapshot[]; // ordered by position
}

// Accumulated state threaded through workflow steps
export interface FlowContext {
  input: Record<string, unknown>;
  steps: Record<string, unknown>; // stepId → output
  tenantId: string;
  /**
   * Per-tenant API credentials fetched by the API process at workflow start.
   * Workers are stateless — they never query the DB.
   * In production: credentials are encrypted in the DB and decrypted by the
   * API process before being placed here.
   */
  credentials: Record<string, string>;
}

// Workflow I/O
export interface FlowWorkflowInput {
  flow: FlowSnapshot;
  input: Record<string, unknown>;
  tenantId: string;
  credentials: Record<string, string>;
}

export interface FlowWorkflowOutput {
  steps: Record<string, unknown>;
  status: 'completed' | 'failed';
  error?: string;
}

// Activity I/O
export interface ExecuteStepInput {
  step: FlowStepSnapshot;
  context: FlowContext;
}

export interface ExecuteStepOutput {
  output: unknown;
  nextStepId?: string; // condition steps set this
}

// Re-export for convenience
export type { ToolConfig };
