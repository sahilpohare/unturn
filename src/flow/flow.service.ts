import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { WorkflowNotFoundError } from '@temporalio/client';
import { TenantContextService } from '../platform/rls/tenant-context.service';
import { TemporalService } from '../temporal/temporal.service';
import { FlowEntity, FlowStatus } from './flow.entity';
import { StepEntity, StepType, StepConfig } from './step.entity';
import { FlowSnapshot, FlowWorkflowInput } from './flow.types';
import { contextQuery } from '../temporal/workflows/flow-interpreter.workflow';
import { FLOW_TASK_QUEUE } from './flow.constants';

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
    const flow = await this.flowRepo.findOne({ where: { id } });
    if (!flow) throw new NotFoundException(`Flow ${id} not found`);
    this.assertTenant(flow.tenantId);
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

    const workflowInput: FlowWorkflowInput = { flow: snapshot, input, tenantId };

    await this.temporal.getClient().workflow.start('flowInterpreterWorkflow', {
      taskQueue: FLOW_TASK_QUEUE,
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
    this.tenantCtx.getOrThrow(); // must be in tenant context
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
    this.tenantCtx.getOrThrow();
    const handle = this.temporal.getClient().workflow.getHandle(workflowId);
    await handle.cancel();
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

  private assertTenant(tenantId: string) {
    const ctx = this.tenantCtx.getTenantId();
    if (ctx && ctx !== tenantId) throw new ForbiddenException();
  }

  private validateSteps(steps: CreateStepDto[]) {
    if (!steps?.length) return;
    const triggers = steps.filter((s) => s.type.startsWith('trigger/'));
    if (triggers.length !== 1) {
      throw new BadRequestException('Flow must have exactly one trigger step');
    }
    const trigger = triggers[0];
    if (trigger.position !== 0) {
      throw new BadRequestException('Trigger step must be at position 0');
    }
  }
}
