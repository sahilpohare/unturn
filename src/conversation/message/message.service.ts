import { Inject, Injectable } from '@nestjs/common';
import type { Mastra } from '@mastra/core/mastra';
import type { Memory } from '@mastra/memory';
import { MASTRA_INSTANCE, MASTRA_MEMORY } from '../../mastra/mastra.tokens';
import { ThreadService } from '../thread/thread.service';
import { messageWorkflow } from '../../mastra/mastra-infra.module';

export interface SendMessageDto {
  resourceId: string;
  content: string;
}

@Injectable()
export class MessageService {
  constructor(
    @Inject(MASTRA_INSTANCE) private readonly mastra: Mastra,
    @Inject(MASTRA_MEMORY) private readonly memory: Memory,
    private readonly threadService: ThreadService,
  ) {}

  async send(threadId: string, dto: SendMessageDto) {
    // 404 guard
    await this.threadService.findById(threadId);

    const workflow = this.mastra.getWorkflow('messageWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { threadId, resourceId: dto.resourceId, content: dto.content },
    });

    if (result.status === 'failed') throw new Error('Workflow failed');
    if (result.status !== 'success') throw new Error(`Workflow ended with status: ${result.status}`);

    return (result as any).result;
  }

  async findByThread(threadId: string) {
    await this.threadService.findById(threadId);
    const { messages } = await this.memory.recall({
      threadId,
      perPage: 50,
    });
    return messages;
  }
}
