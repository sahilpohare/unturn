export type StepType =
  | 'trigger/webhook'
  | 'trigger/schedule'
  | 'trigger/manual'
  | 'agent'
  | 'http'
  | 'transform'
  | 'condition'
  | 'delay'
  | 'brand-research'
  | 'meta-ads-search'
  | 'creator-vet'
  | 'instagram-dm';

export interface Step {
  id: string;
  flowId: string;
  ref: string;
  type: StepType;
  name: string;
  position: number;
  config: Record<string, unknown>;
  onSuccess: string | null;
  onFailure: string | null;
  retryPolicy: { maximumAttempts: number; initialInterval?: string };
}

export interface Flow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'disabled';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  steps: Step[];
}
