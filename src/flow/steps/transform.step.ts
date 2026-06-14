import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep } from './base.step';

export interface TransformStepConfig {
  mapping: Record<string, string>;
}

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
