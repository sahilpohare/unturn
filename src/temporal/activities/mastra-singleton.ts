import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';

/**
 * Minimal singleton used only by specialised step classes that need a
 * pre-configured agent (e.g. BrandResearchStep).
 *
 * AgentStep constructs agents at runtime from flow JSON — no registration here.
 */
const model = process.env.OPENAI_MODEL ?? 'openai/gpt-4o-mini';

export const mastraInstance = new Mastra({
  agents: {
    'outreach-research-agent': new Agent({
      id: 'outreach-research-agent',
      name: 'outreach-research-agent',
      instructions: 'You are a brand analyst. Extract brand identity from website content and return structured JSON.',
      model,
    }),
  },
});
