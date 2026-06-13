import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Memory } from '@mastra/memory';
import { MASTRA_MEMORY } from '../../mastra/mastra.tokens';
import { TenantContextService } from '../../platform/rls/tenant-context.service';

export interface CreateThreadDto {
  resourceId: string; // userId
  title?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ThreadService {
  constructor(
    @Inject(MASTRA_MEMORY) private readonly memory: Memory,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async create(dto: CreateThreadDto) {
    const tenantId = this.tenantCtx.getOrThrow();
    return this.memory.createThread({
      resourceId: dto.resourceId,
      title: dto.title,
      metadata: { ...dto.metadata, tenantId },
    });
  }

  async findById(id: string) {
    const thread = await this.memory.getThreadById({ threadId: id });
    if (!thread) throw new NotFoundException(`Thread ${id} not found`);

    // App-level guard (RLS is the primary enforcement at DB level)
    const tenantId = this.tenantCtx.getTenantId();
    if (tenantId && thread.metadata?.tenantId !== tenantId) {
      throw new ForbiddenException('Thread does not belong to this tenant');
    }
    return thread;
  }

  async findByResource(resourceId: string) {
    const tenantId = this.tenantCtx.getOrThrow();
    const { threads } = await this.memory.listThreads({ filter: { resourceId } });
    // Secondary filter — RLS already does this at DB level
    return threads.filter((t) => t.metadata?.tenantId === tenantId);
  }

  async delete(id: string) {
    await this.findById(id); // 404 + tenant guard
    await this.memory.deleteThread(id);
  }
}
