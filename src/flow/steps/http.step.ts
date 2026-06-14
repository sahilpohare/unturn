import { ApplicationFailure } from '@temporalio/activity';
import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep, assertPublicUrl } from './base.step';

export interface HttpStepConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}

export class HttpStep extends BaseStep<HttpStepConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const url = this.resolveTemplate(this.config.url, context);
    assertPublicUrl(url);
    const res = await fetch(url, {
      method: this.config.method,
      headers: { 'Content-Type': 'application/json', ...(this.config.headers ?? {}) },
      body: ['GET', 'DELETE'].includes(this.config.method)
        ? undefined
        : JSON.stringify(this.config.body),
    });

    if (!res.ok) {
      throw ApplicationFailure.create({
        message: `HTTP ${this.config.method} ${url} → ${res.status}`,
        nonRetryable: res.status >= 400 && res.status < 500,
      });
    }

    return { output: await res.json() };
  }
}
