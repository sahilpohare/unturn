import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { RlsPool } from '../platform/rls/rls-pool';
import { TenantContextService } from '../platform/rls/tenant-context.service';
import { MASTRA_INSTANCE, MASTRA_MEMORY, MASTRA_STORAGE } from './mastra.tokens';

// ── Mastra Workflows ────────────────────────────────────────────────────────

const validateMessageStep = createStep({
  id: 'validate-message',
  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    content: z.string(),
  }),
  outputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    content: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.content.trim()) throw new Error('Message content is empty');
    return inputData;
  },
});

const generateReplyStep = createStep({
  id: 'generate-reply',
  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    content: z.string(),
  }),
  outputSchema: z.object({
    threadId: z.string(),
    response: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('example-agent');
    if (!agent) throw new Error('example-agent not found');
    const result = await agent.generate(inputData.content, {
      memory: { thread: inputData.threadId, resource: inputData.resourceId },
    });
    return { threadId: inputData.threadId, response: result.text };
  },
});

export const messageWorkflow = createWorkflow({
  id: 'message-workflow',
  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    content: z.string(),
  }),
  outputSchema: z.object({
    threadId: z.string(),
    response: z.string(),
  }),
})
  .then(validateMessageStep)
  .then(generateReplyStep)
  .commit();

// ── Module ──────────────────────────────────────────────────────────────────

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MASTRA_STORAGE,
      inject: [getDataSourceToken(), TenantContextService],
      useFactory: (dataSource: DataSource, tenantCtx: TenantContextService) => {
        const basePool = (dataSource.driver as any).master;
        const rlsPool = new RlsPool(
          { ...basePool.options },
          tenantCtx,
        );
        return new PostgresStore({ id: 'pg-storage', pool: rlsPool });
      },
    },
    {
      provide: MASTRA_MEMORY,
      inject: [MASTRA_STORAGE],
      useFactory: (storage: PostgresStore) =>
        new Memory({
          storage,
          options: {
            lastMessages: 20,
            generateTitle: true,
            workingMemory: { enabled: true },
          },
        }),
    },
    {
      provide: MASTRA_INSTANCE,
      inject: [MASTRA_MEMORY],
      useFactory: (memory: Memory) => {
        const exampleAgent = new Agent({
          id: 'example-agent',
          name: 'example-agent',
          instructions: 'You are a helpful assistant with persistent memory.',
          model: 'openai/gpt-4o-mini',
          memory,
        });
        return new Mastra({ agents: { exampleAgent }, workflows: { messageWorkflow } });
      },
    },
  ],
  exports: [MASTRA_STORAGE, MASTRA_MEMORY, MASTRA_INSTANCE],
})
export class MastraInfraModule {}
