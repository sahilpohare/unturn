import { proxyActivities, sleep, setHandler, defineQuery } from '@temporalio/workflow';
import type { Duration } from '@temporalio/common';
import type * as flowActivities from '../activities/flow.activities';
import type {
  FlowWorkflowInput,
  FlowWorkflowOutput,
  FlowContext,
  FlowStepSnapshot,
} from '../../flow/flow.types';
import type { DelayStepConfig } from '../../flow/steps/delay.step';

const { executeStep } = proxyActivities<typeof flowActivities>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3 },
});

// Query: inspect live context from outside the workflow
export const contextQuery = defineQuery<FlowContext>('getContext');

function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const n = parseInt(match[1]);
  const units: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * units[match[2]];
}

export async function flowInterpreterWorkflow(
  input: FlowWorkflowInput,
): Promise<FlowWorkflowOutput> {
  const { flow, tenantId } = input;

  const context: FlowContext = {
    input: input.input,
    steps: {},
    tenantId,
    credentials: input.credentials ?? {},
  };

  // Expose live context via query
  setHandler(contextQuery, () => context);

  // Navigate by ref — ref is unique within a flow
  const stepMap = new Map<string, FlowStepSnapshot>(
    flow.steps.map((s) => [s.ref, s]),
  );

  // Entry point is the trigger step (position 0)
  const triggerStep = flow.steps.find((s) => s.position === 0);
  if (!triggerStep) throw new Error('Flow has no trigger step');

  let currentRef: string | undefined = triggerStep.ref;

  while (currentRef) {
    const step = stepMap.get(currentRef);
    if (!step) throw new Error(`Step ref "${currentRef}" not found`);


    try {
      if (step.type === 'delay') {
        const ms = parseDurationMs((step.config as DelayStepConfig).duration);
        await sleep(ms);
        context.steps[step.ref] = { slept: (step.config as DelayStepConfig).duration };
        currentRef = step.onSuccess ?? undefined;
        continue;
      }

      const result = await proxyActivities<typeof flowActivities>({
        startToCloseTimeout: '10 minutes',
        retry: {
          maximumAttempts: step.retryPolicy.maximumAttempts,
          initialInterval: (step.retryPolicy.initialInterval ?? '1s') as Duration,
        },
      }).executeStep({ step, context });

      // Step outputs keyed by ref so templates like $.steps.brand-research.title work
      context.steps[step.ref] = result.output;

      // Condition steps return their own nextStepRef; others follow onSuccess
      currentRef = result.nextStepId ?? step.onSuccess ?? undefined;
    } catch (err: any) {

      if (step.onFailure) {
        currentRef = step.onFailure;
      } else {
        return {
          steps: context.steps,
          status: 'failed',
          error: err?.message ?? String(err),
        };
      }
    }
  }

  return { steps: context.steps, status: 'completed' };
}
