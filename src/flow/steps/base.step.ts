import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import type { FlowStepSnapshot } from '../flow.types';

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
