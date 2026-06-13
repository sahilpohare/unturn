import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { createHmac, timingSafeEqual } from 'crypto';
import { WorkflowNotFoundError } from '@temporalio/client';
import { TenantContextService } from '../platform/rls/tenant-context.service';
import { TemporalService } from '../temporal/temporal.service';
import { FlowEntity, FlowStatus } from './flow.entity';
import { StepEntity, StepType, StepConfig } from './step.entity';
import { TenantEntity } from '../platform/tenant/tenant.entity';
import { FlowSnapshot, FlowWorkflowInput } from './flow.types';
import { contextQuery } from '../temporal/workflows/flow-interpreter.workflow';
import { taskQueueForTenant } from './flow.constants';
import type { WebhookTriggerConfig } from './steps/trigger.step';

// ─── Constants ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// workflowIds are formatted as `flow-<flowId>-<executionUuid>`
// The flowId is embedded at a known position so we can verify tenant ownership
// without an extra DB round-trip — the full ownership check was already done
// when the workflow was started (execute()). Here we verify the prefix structure
// to prevent cross-tenant enumeration via arbitrary workflowId strings.
function parseWorkflowFlowId(workflowId: string): string | null {
  const m = /^flow-([0-9a-f-]{36})-[0-9a-f-]{36}$/.exec(workflowId);
  return m ? m[1] : null;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateStepDto {
  ref: string; // user-defined stable identifier, unique within flow
  type: StepType;
  name: string;
  position: number;
  config: StepConfig;
  onSuccess?: string; // ref of next step on success
  onFailure?: string; // ref of next step on failure
  retryPolicy?: { maximumAttempts: number; initialInterval?: string };
}

export interface CreateFlowDto {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  steps: CreateStepDto[];
}

export interface UpdateFlowDto {
  name?: string;
  description?: string;
  status?: FlowStatus;
  metadata?: Record<string, unknown>;
}

export interface UpsertStepDto extends CreateStepDto {
  id?: string; // present = update existing by DB id, absent = create new
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(FlowEntity)
    private readonly flowRepo: Repository<FlowEntity>,

    @InjectRepository(StepEntity)
    private readonly stepRepo: Repository<StepEntity>,

    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,

    private readonly tenantCtx: TenantContextService,
    private readonly temporal: TemporalService,
  ) {}

  // ── Flow CRUD ──────────────────────────────────────────────────────────────

  async createFlow(dto: CreateFlowDto): Promise<FlowEntity> {
    const tenantId = this.tenantCtx.getOrThrow();
    this.validateSteps(dto.steps);

    const flow = await this.flowRepo.save(
      this.flowRepo.create({
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        metadata: dto.metadata ?? {},
      }),
    );

    const steps = (dto.steps ?? []).map((s) =>
      this.stepRepo.create({
        ref: s.ref,
        type: s.type,
        name: s.name,
        position: s.position,
        config: s.config,
        onSuccess: s.onSuccess ?? null,
        onFailure: s.onFailure ?? null,
        flowId: flow.id,
        retryPolicy: s.retryPolicy ?? { maximumAttempts: 3, initialInterval: '1s' },
      }),
    );
    flow.steps = await this.stepRepo.save(steps);
    return flow;
  }

  async findFlow(id: string): Promise<FlowEntity> {
    const tenantId = this.tenantCtx.getOrThrow();
    const flow = await this.flowRepo.findOne({ where: { id, tenantId } });
    if (!flow) throw new NotFoundException(`Flow ${id} not found`);
    flow.steps = await this.stepRepo.find({
      where: { flowId: id },
      order: { position: 'ASC' },
    });
    return flow;
  }

  async listFlows(): Promise<FlowEntity[]> {
    const tenantId = this.tenantCtx.getOrThrow();
    return this.flowRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateFlow(id: string, dto: UpdateFlowDto): Promise<FlowEntity> {
    const flow = await this.findFlow(id);
    Object.assign(flow, dto);
    return this.flowRepo.save(flow);
  }

  async deleteFlow(id: string): Promise<void> {
    await this.findFlow(id);
    await this.flowRepo.delete(id);
  }

  // ── Step CRUD ──────────────────────────────────────────────────────────────

  async upsertSteps(flowId: string, dtos: UpsertStepDto[]): Promise<StepEntity[]> {
    const flow = await this.findFlow(flowId);
    this.validateSteps(dtos);

    // Delete steps not in the new list
    const incomingIds = dtos.filter((d) => d.id).map((d) => d.id!);
    const toDelete = flow.steps.filter((s) => !incomingIds.includes(s.id));
    if (toDelete.length) await this.stepRepo.remove(toDelete);

    const entities = dtos.map((dto) =>
      this.stepRepo.create({
        ...(dto.id ? { id: dto.id } : {}),
        flowId,
        ref: dto.ref,
        type: dto.type,
        name: dto.name,
        position: dto.position,
        config: dto.config,
        onSuccess: dto.onSuccess ?? null,
        onFailure: dto.onFailure ?? null,
        retryPolicy: dto.retryPolicy ?? { maximumAttempts: 3, initialInterval: '1s' },
      }),
    );
    return this.stepRepo.save(entities);
  }

  async deleteStep(flowId: string, stepId: string): Promise<void> {
    await this.findFlow(flowId); // tenant guard
    await this.stepRepo.delete({ id: stepId, flowId });
  }

  // ── Execution ──────────────────────────────────────────────────────────────

  async execute(
    flowId: string,
    input: Record<string, unknown> = {},
  ): Promise<{ workflowId: string }> {
    const flow = await this.findFlow(flowId);

    if (flow.status !== 'active') {
      throw new BadRequestException(`Flow "${flow.name}" is not active`);
    }

    const tenantId = this.tenantCtx.getOrThrow();
    const workflowId = `flow-${flow.id}-${uuid()}`;

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const tier = tenant?.tier ?? 'free';
    const taskQueue = taskQueueForTenant(tier, tenantId);
    const credentials = tenant?.credentials ?? {};

    const snapshot: FlowSnapshot = {
      id: flow.id,
      name: flow.name,
      tenantId,
      steps: flow.steps.map((s) => ({
        id: s.id,
        ref: s.ref,
        type: s.type,
        name: s.name,
        position: s.position,
        config: s.config,
        onSuccess: s.onSuccess,
        onFailure: s.onFailure,
        retryPolicy: s.retryPolicy,
      })),
    };

    const workflowInput: FlowWorkflowInput = { flow: snapshot, input, tenantId, credentials };

    await this.temporal.getClient().workflow.start('flowInterpreterWorkflow', {
      taskQueue,
      workflowId,
      args: [workflowInput],
      searchAttributes: {
        // Custom search attributes — register these in your Temporal namespace
        FlowId: [flow.id],
        TenantId: [tenantId],
      },
    });

    return { workflowId };
  }

  async getExecution(workflowId: string) {
    const tenantId = this.tenantCtx.getOrThrow();
    await this.assertWorkflowTenant(workflowId, tenantId);
    try {
      const handle = this.temporal.getClient().workflow.getHandle(workflowId);
      const [description, liveContext] = await Promise.all([
        handle.describe(),
        handle.query(contextQuery).catch(() => null),
      ]);

      return {
        workflowId,
        status: description.status.name,
        startTime: description.startTime,
        closeTime: description.closeTime ?? null,
        context: liveContext,
      };
    } catch (err) {
      if (err instanceof WorkflowNotFoundError) {
        throw new NotFoundException(`Execution ${workflowId} not found`);
      }
      throw err;
    }
  }

  async listExecutions(flowId: string) {
    const tenantId = this.tenantCtx.getOrThrow();
    await this.findFlow(flowId); // 404 + tenant guard

    // Validate both values are safe UUIDs before interpolating into Temporal query
    if (!UUID_RE.test(flowId)) throw new BadRequestException('Invalid flowId');
    if (!UUID_RE.test(tenantId)) throw new BadRequestException('Invalid tenantId');

    const iterator = this.temporal.getClient().workflow.list({
      query: `FlowId="${flowId}" AND TenantId="${tenantId}"`,
    });

    const executions: unknown[] = [];
    for await (const workflow of iterator) {
      executions.push({
        workflowId: workflow.workflowId,
        status: workflow.status.name,
        startTime: workflow.startTime,
        closeTime: workflow.closeTime ?? null,
      });
    }
    return executions;
  }

  async cancelExecution(workflowId: string): Promise<void> {
    const tenantId = this.tenantCtx.getOrThrow();
    await this.assertWorkflowTenant(workflowId, tenantId);
    const handle = this.temporal.getClient().workflow.getHandle(workflowId);
    await handle.cancel();
  }

  // ── Webhook trigger ────────────────────────────────────────────────────────

  /**
   * Called from the public webhook endpoint. No session context — the flow
   * is loaded by (tenantId, flowId) pair directly from the DB. HMAC-SHA256
   * signature is verified before execution to authenticate the caller.
   *
   * Expected header: X-Hub-Signature-256: sha256=<hex>
   */
  async webhookTrigger(
    tenantId: string,
    flowId: string,
    rawBody: Buffer,
    signature: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<{ workflowId: string }> {
    // Load flow bypassing TenantContextService (no session)
    const flow = await this.flowRepo.findOne({ where: { id: flowId, tenantId } });
    if (!flow) throw new NotFoundException(`Flow ${flowId} not found`);

    if (flow.status !== 'active') {
      throw new BadRequestException(`Flow "${flow.name}" is not active`);
    }

    flow.steps = await this.stepRepo.find({
      where: { flowId },
      order: { position: 'ASC' },
    });

    const triggerStep = flow.steps.find((s) => s.type.startsWith('trigger/'));
    const triggerConfig = triggerStep?.config as WebhookTriggerConfig | undefined;

    // Verify HMAC if a secret is configured
    if (triggerConfig?.secret) {
      if (!signature) {
        throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
      }
      const expected = 'sha256=' + createHmac('sha256', triggerConfig.secret).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const tier = tenant?.tier ?? 'free';
    const taskQueue = taskQueueForTenant(tier, tenantId);
    const credentials = tenant?.credentials ?? {};
    const workflowId = `flow-${flow.id}-${uuid()}`;

    const snapshot: FlowSnapshot = {
      id: flow.id,
      name: flow.name,
      tenantId,
      steps: flow.steps.map((s) => ({
        id: s.id,
        ref: s.ref,
        type: s.type,
        name: s.name,
        position: s.position,
        config: s.config,
        onSuccess: s.onSuccess,
        onFailure: s.onFailure,
        retryPolicy: s.retryPolicy,
      })),
    };

    const workflowInput: FlowWorkflowInput = { flow: snapshot, input: payload, tenantId, credentials };

    await this.temporal.getClient().workflow.start('flowInterpreterWorkflow', {
      taskQueue,
      workflowId,
      args: [workflowInput],
      searchAttributes: {
        FlowId: [flow.id],
        TenantId: [tenantId],
      },
    });

    return { workflowId };
  }

  // ── Builtin tools catalogue ────────────────────────────────────────────────

  listBuiltins() {
    return [
      {
        builtinId: 'scrape-url',
        description: 'Fetch and extract readable text from a URL',
        inputSchema: { properties: { url: { type: 'string', description: 'The URL to scrape' } } },
      },
      {
        builtinId: 'meta-ad-library',
        description: 'Search the Meta Ad Library for ads from a Facebook page',
        inputSchema: {
          properties: {
            pageId: { type: 'string', description: 'Facebook Page ID of the brand' },
            countries: { type: 'string', description: 'Comma-separated ISO country codes e.g. US,GB' },
            limit: { type: 'number', description: 'Max number of ads to return' },
          },
        },
        requiredEnv: ['META_ACCESS_TOKEN'],
      },
      {
        builtinId: 'instagram-profile',
        description: 'Get public Instagram profile information for a creator handle',
        inputSchema: { properties: { handle: { type: 'string', description: 'Instagram username without @' } } },
        requiredEnv: ['INSTAGRAM_ACCESS_TOKEN'],
      },
      {
        builtinId: 'send-instagram-dm',
        description: 'Send a direct message to an Instagram user via the Graph API',
        inputSchema: {
          properties: {
            recipientId: { type: 'string', description: 'Instagram user ID of the recipient' },
            message: { type: 'string', description: 'The message text to send' },
          },
        },
        requiredEnv: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID'],
      },
    ];
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  /**
   * Verify a workflowId was issued for the current tenant by parsing its
   * embedded flowId and confirming that flow belongs to the tenant.
   */
  private async assertWorkflowTenant(workflowId: string, tenantId: string): Promise<void> {
    const flowId = parseWorkflowFlowId(workflowId);
    if (!flowId) throw new ForbiddenException('Invalid workflowId format');
    // findFlow already enforces tenantId via WHERE clause
    await this.findFlow(flowId);
    void tenantId; // tenantId already enforced by findFlow via getOrThrow()
  }

  private validateSteps(steps: CreateStepDto[] | null | undefined) {
    if (!steps || !steps.length) return;

    const triggers = steps.filter((s) => s.type.startsWith('trigger/'));
    if (triggers.length !== 1) {
      throw new BadRequestException('Flow must have exactly one trigger step');
    }
    if (triggers[0].position !== 0) {
      throw new BadRequestException('Trigger step must be at position 0');
    }

    // Validate refs are unique
    const refs = steps.map((s) => s.ref);
    const uniqueRefs = new Set(refs);
    if (uniqueRefs.size !== refs.length) {
      throw new BadRequestException('Step refs must be unique within a flow');
    }

    // Validate onSuccess/onFailure point to existing refs
    for (const step of steps) {
      if (step.onSuccess && !uniqueRefs.has(step.onSuccess)) {
        throw new BadRequestException(`onSuccess ref "${step.onSuccess}" not found`);
      }
      if (step.onFailure && !uniqueRefs.has(step.onFailure)) {
        throw new BadRequestException(`onFailure ref "${step.onFailure}" not found`);
      }
    }

    // Cycle detection via DFS
    const adj = new Map<string, string[]>();
    for (const step of steps) {
      const nexts: string[] = [];
      if (step.onSuccess) nexts.push(step.onSuccess);
      if (step.onFailure) nexts.push(step.onFailure);
      adj.set(step.ref, nexts);
    }
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (ref: string): boolean => {
      if (inStack.has(ref)) return true;
      if (visited.has(ref)) return false;
      visited.add(ref);
      inStack.add(ref);
      for (const next of adj.get(ref) ?? []) {
        if (hasCycle(next)) return true;
      }
      inStack.delete(ref);
      return false;
    };

    for (const ref of uniqueRefs) {
      if (hasCycle(ref)) {
        throw new BadRequestException('Flow steps contain a cycle');
      }
    }
  }
}
