import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import type { DelayStepConfig } from '../step.entity';
import { BaseStep } from './base.step';

export class DelayStep extends BaseStep<DelayStepConfig> {
  async execute(_context: FlowContext): Promise<ExecuteStepOutput> {
    // Delay is handled in the workflow via Temporal sleep() — activity is a no-op
    return { output: null };
  }
}
