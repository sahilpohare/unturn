/**
 * Flow Engine Integration Test
 *
 * Prerequisites (must be running locally):
 *   - PostgreSQL at DATABASE_URL
 *   - Temporal server: docker-compose up temporal
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@temporalio/client';
import { AppModule } from '../src/app.module';
import { FlowEntity } from '../src/flow/flow.entity';
import { FlowService } from '../src/flow/flow.service';
import { TenantContextService } from '../src/platform/rls/tenant-context.service';
import { TemporalService } from '../src/temporal/temporal.service';
import { contextQuery } from '../src/temporal/workflows/flow-interpreter.workflow';

async function pollUntilDone(
  client: Client,
  workflowId: string,
  timeoutMs = 30_000,
): Promise<{ status: string; context: any }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const handle = client.workflow.getHandle(workflowId);
    const desc = await handle.describe();
    const statusName = desc.status.name;
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'TERMINATED'].includes(statusName)) {
      const context = await handle.query(contextQuery).catch(() => null);
      return { status: statusName, context };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Workflow ${workflowId} did not complete within ${timeoutMs}ms`);
}

describe('Flow Engine (integration)', () => {
  let app: INestApplication;
  let flowService: FlowService;
  let tenantCtx: TenantContextService;
  let temporalService: TemporalService;
  let flowRepo: Repository<FlowEntity>;

  const TENANT_ID = `test-tenant-${Date.now()}`;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    flowService = module.get(FlowService);
    tenantCtx = module.get(TenantContextService);
    temporalService = module.get(TemporalService);
    flowRepo = module.get(getRepositoryToken(FlowEntity));
  }, 60_000);

  afterAll(async () => {
    await flowRepo.delete({ tenantId: TENANT_ID });
    await app.close();
  });

  it('creates, activates, executes a JSON-defined flow and Temporal completes it', async () => {
    // Steps use human-readable refs for wiring
    let flow!: FlowEntity;
    await tenantCtx.run(TENANT_ID, async () => {
      flow = await flowService.createFlow({
        name: 'Test: trigger → transform → http → condition',
        steps: [
          {
            ref: 'trigger',
            type: 'trigger/manual',
            name: 'Manual trigger',
            position: 0,
            config: { inputSchema: { properties: { userId: { type: 'string' } } } },
            onSuccess: 'transform',
          },
          {
            ref: 'transform',
            type: 'transform',
            name: 'Build request payload',
            position: 1,
            config: { mapping: { userId: '$.input.userId', source: '$.input.source' } },
            onSuccess: 'fetch-todo',
          },
          {
            ref: 'fetch-todo',
            type: 'http',
            name: 'Fetch user data',
            position: 2,
            config: { url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' },
            onSuccess: 'check-complete',
          },
          {
            ref: 'check-complete',
            type: 'condition',
            name: 'Check completed flag',
            position: 3,
            config: { expression: '$.steps.fetch-todo.completed', onTrue: '', onFalse: '' },
            onSuccess: null,
          },
        ],
      });
    });

    expect(flow.id).toBeDefined();
    expect(flow.steps).toHaveLength(4);

    // Activate
    await tenantCtx.run(TENANT_ID, async () => {
      await flowService.updateFlow(flow.id, { status: 'active' });
    });

    // Execute
    let workflowId!: string;
    await tenantCtx.run(TENANT_ID, async () => {
      const result = await flowService.execute(flow.id, {
        userId: 'user-42',
        source: 'integration-test',
      });
      workflowId = result.workflowId;
    });

    expect(workflowId).toMatch(/^flow-/);

    // Poll
    const { status, context } = await pollUntilDone(temporalService.getClient(), workflowId);

    expect(status).toBe('COMPLETED');

    // Context is keyed by ref
    expect(context.steps['transform']).toMatchObject({
      userId: 'user-42',
      source: 'integration-test',
    });
    expect(context.steps['fetch-todo']).toMatchObject({
      id: 1,
      completed: expect.any(Boolean),
    });
    expect(context.steps['check-complete']).toMatchObject({
      result: expect.any(Boolean),
    });
  }, 60_000);
});
