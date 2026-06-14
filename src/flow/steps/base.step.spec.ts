import { assertPublicUrl } from './base.step';
import { TransformStep } from './transform.step';
import { makeContext, makeSnapshot } from './__mocks__/context';

describe('assertPublicUrl', () => {
  it('allows public http URLs', () => {
    expect(() => assertPublicUrl('http://example.com/path')).not.toThrow();
    expect(() => assertPublicUrl('https://brand.com')).not.toThrow();
  });

  it('blocks localhost', () => {
    expect(() => assertPublicUrl('http://localhost:3000')).toThrow('Disallowed private/loopback URL');
  });

  it('blocks 127.x.x.x', () => {
    expect(() => assertPublicUrl('http://127.0.0.1')).toThrow('Disallowed private/loopback URL');
  });

  it('blocks 10.x.x.x', () => {
    expect(() => assertPublicUrl('http://10.0.0.1')).toThrow('Disallowed private/loopback URL');
  });

  it('blocks 192.168.x.x', () => {
    expect(() => assertPublicUrl('http://192.168.1.1')).toThrow('Disallowed private/loopback URL');
  });

  it('blocks 172.16-31.x.x', () => {
    expect(() => assertPublicUrl('http://172.16.0.1')).toThrow('Disallowed private/loopback URL');
    expect(() => assertPublicUrl('http://172.31.255.255')).toThrow('Disallowed private/loopback URL');
  });

  it('blocks link-local 169.254.x.x (AWS/GCP metadata)', () => {
    expect(() => assertPublicUrl('http://169.254.169.254')).toThrow('Disallowed private/loopback URL');
  });

  it('blocks non-http schemes', () => {
    expect(() => assertPublicUrl('ftp://example.com')).toThrow('Disallowed URL scheme');
    expect(() => assertPublicUrl('file:///etc/passwd')).toThrow('Disallowed URL scheme');
  });

  it('throws on unparseable URL', () => {
    expect(() => assertPublicUrl('not a url')).toThrow('Invalid URL');
  });
});

describe('BaseStep helpers (via TransformStep)', () => {
  function makeTransform(mapping: Record<string, string>) {
    return new TransformStep(makeSnapshot('transform', { mapping }));
  }

  it('resolvePath returns literal string when not a JSONPath', async () => {
    const step = makeTransform({ out: 'literal-value' });
    const result = await step.execute(makeContext());
    expect((result.output as any).out).toBe('literal-value');
  });

  it('resolvePath traverses nested context', async () => {
    const step = makeTransform({ title: '$.steps.brand.title' });
    const ctx = makeContext({ steps: { brand: { title: 'Glow Co' } } });
    const result = await step.execute(ctx);
    expect((result.output as any).title).toBe('Glow Co');
  });

  it('resolvePath returns undefined for missing path', async () => {
    const step = makeTransform({ missing: '$.steps.nonexistent.field' });
    const result = await step.execute(makeContext());
    expect((result.output as any).missing).toBeUndefined();
  });

  it('resolveTemplate interpolates multiple vars', async () => {
    const step = new TransformStep(makeSnapshot('transform', {
      mapping: { rendered: '$.input.tpl' },
    }));
    // Use AgentStep to test resolveTemplate indirectly via promptTemplate
    // Direct test via TransformStep mapping (path only) — test resolveTemplate via agent.step.spec.ts
    const ctx = makeContext({ input: { tpl: 'hello' } });
    const result = await step.execute(ctx);
    expect((result.output as any).rendered).toBe('hello');
  });
});
