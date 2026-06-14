import { ApplicationFailure } from '@temporalio/activity';
import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import type { FlowStepSnapshot } from '../flow.types';

// ── SSRF guard ──────────────────────────────────────────────────────────────
// Block private/loopback/link-local IP ranges and non-http(s) schemes.
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc|fd|fe80)/i;

export function assertPublicUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw ApplicationFailure.nonRetryable(`Invalid URL: ${raw}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw ApplicationFailure.nonRetryable(`Disallowed URL scheme: ${parsed.protocol}`);
  }
  if (PRIVATE_IP_RE.test(parsed.hostname)) {
    throw ApplicationFailure.nonRetryable(`Disallowed private/loopback URL: ${raw}`);
  }
}

export abstract class BaseStep<TConfig = unknown> {
  protected readonly config: TConfig;
  protected readonly step: FlowStepSnapshot;

  constructor(step: FlowStepSnapshot) {
    this.step = step;
    this.config = step.config as TConfig;
  }

  abstract execute(context: FlowContext): Promise<ExecuteStepOutput>;

  // ── Shared helpers ──────────────────────────────────────────────────────────

  protected resolvePath(path: string, context: FlowContext): unknown {
    if (!path.startsWith('$.')) return path;
    const parts = path.slice(2).split('.');
    let val: unknown = context;
    for (const part of parts) {
      if (val == null || typeof val !== 'object') return undefined;
      val = (val as Record<string, unknown>)[part];
    }
    return val;
  }

  protected resolveTemplate(template: string, context: FlowContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
      const val = this.resolvePath(expr.trim(), context);
      return val != null ? String(val) : '';
    });
  }
}
