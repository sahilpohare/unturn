import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import type { TransformStepConfig } from '../step.entity';
import { BaseStep } from './base.step';

export class TransformStep extends BaseStep<TransformStepConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const output = Object.fromEntries(
      Object.entries(this.config.mapping).map(([key, path]) => [
        key,
        this.resolvePath(path, context),
      ]),
    );
    return { output };
  }
}
