import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep } from './base.step';

export interface WebhookTriggerConfig {
  secret?: string;
  filter?: string;
}

export interface ScheduleTriggerConfig {
  cron: string;
  timezone?: string;
}

export interface ManualTriggerConfig {
  inputSchema?: Record<string, unknown>;
}

export class TriggerStep extends BaseStep {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    // Trigger passes input through unchanged
    return { output: context.input };
  }
}
