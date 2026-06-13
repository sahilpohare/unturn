import type { FlowContext } from '../../flow.types';
import type { FlowStepSnapshot } from '../../flow.types';

export function makeContext(overrides: Partial<FlowContext> = {}): FlowContext {
  return {
    input: {},
    steps: {},
    tenantId: 'tenant-test',
    credentials: {},
    ...overrides,
  };
}

export function makeSnapshot(
  type: string,
  config: Record<string, unknown>,
  overrides: Partial<FlowStepSnapshot> = {},
): FlowStepSnapshot {
  return {
    id: 'step-id',
    ref: 'step-ref',
    type: type as any,
    name: 'Test Step',
    position: 0,
    config: config as any,
    onSuccess: null,
    onFailure: null,
    retryPolicy: { maximumAttempts: 3, initialInterval: '1s' },
    ...overrides,
  };
}
