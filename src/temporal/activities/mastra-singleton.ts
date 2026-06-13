import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';

/**
 * Lightweight Mastra instance used only by Temporal activities.
 * Activities run in Node.js (not the workflow V8 sandbox), so this is safe.
 * The NestJS DI Mastra instance is separate — this avoids coupling Temporal
 * workers to the NestJS container lifecycle.
 */
export const mastraInstance = new Mastra({
  agents: {
    'example-agent': new Agent({
      id: 'example-agent',
      name: 'example-agent',
      instructions: 'You are a helpful assistant.',
      model: 'openai/gpt-4o-mini',
    }),
  },
});
