import type { ExecuteStepInput, ExecuteStepOutput } from '../../flow/flow.types';
import { createStep } from '../../flow/steps/index.js';

export async function executeStep(input: ExecuteStepInput): Promise<ExecuteStepOutput> {
  const step = createStep(input.step);
  return step.execute(input.context);
}
