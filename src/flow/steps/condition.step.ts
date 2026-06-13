import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import type { ConditionStepConfig } from '../step.entity';
import { BaseStep } from './base.step';

export class ConditionStep extends BaseStep<ConditionStepConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const value = this.resolvePath(this.config.expression, context);
    return {
      output: { result: !!value },
      nextStepId: value ? this.config.onTrue : this.config.onFalse,
    };
  }
}
