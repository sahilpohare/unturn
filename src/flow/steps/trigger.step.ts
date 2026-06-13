import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep } from './base.step';

export class TriggerStep extends BaseStep {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    // Trigger passes input through unchanged
    return { output: context.input };
  }
}
