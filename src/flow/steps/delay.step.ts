import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep } from './base.step';

export interface DelayStepConfig {
  duration: string; // '30s' | '5m' | '2h'
}

export class DelayStep extends BaseStep<DelayStepConfig> {
  async execute(_context: FlowContext): Promise<ExecuteStepOutput> {
    // Delay is handled in the workflow via Temporal sleep() — activity is a no-op
    return { output: null };
  }
}
