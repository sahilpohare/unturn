import { ApplicationFailure } from '@temporalio/activity';
import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep } from './base.step';

export interface InstagramDmConfig {
  recipientIdPath: string;
  messagePath: string;
  delayMs?: number;
}

export class InstagramDmStep extends BaseStep<InstagramDmConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const recipientId = this.resolvePath(this.config.recipientIdPath, context) as string;
    const message = this.resolvePath(this.config.messagePath, context) as string;
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const igUserId = process.env.INSTAGRAM_USER_ID;

    if (!token) throw ApplicationFailure.nonRetryable('INSTAGRAM_ACCESS_TOKEN not set');
    if (!igUserId) throw ApplicationFailure.nonRetryable('INSTAGRAM_USER_ID not set');
    if (!recipientId || !message) throw ApplicationFailure.nonRetryable('recipientId and message are required');

    if (this.config.delayMs) await new Promise((r) => setTimeout(r, this.config.delayMs));

    const res = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: token,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { output: { results: [{ handle: recipientId, recipientId, status: 'failed', error: `${res.status}: ${err}` }] } };
    }

    return { output: { results: [{ handle: recipientId, recipientId, status: 'sent' }] } };
  }
}
