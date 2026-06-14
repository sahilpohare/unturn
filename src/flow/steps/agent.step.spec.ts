import { AgentStep } from './agent.step';
import { makeContext, makeSnapshot } from './__mocks__/context';

// Mock @mastra/core/agent so no real LLM call is made
jest.mock('@mastra/core/agent', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue({ text: 'mock agent response', toolCalls: [] }),
  })),
}));

jest.mock('@mastra/core/tools', () => ({
  createTool: jest.fn((cfg: any) => cfg),
}));

const { Agent } = jest.requireMock('@mastra/core/agent');

describe('AgentStep', () => {
  beforeEach(() => jest.clearAllMocks());

  it('constructs agent at runtime from config, not singleton', async () => {
    const snapshot = makeSnapshot('agent', {
      agentName: 'myAgent',
      systemPrompt: 'You are a test agent.',
      promptTemplate: 'Hello {{$.input.name}}',
      tools: [],
    });
    const context = makeContext({ input: { name: 'World' } });

    const step = new AgentStep(snapshot);
    const result = await step.execute(context);

    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'myAgent',
        instructions: 'You are a test agent.',
      }),
    );
    expect(result.output).toEqual({ text: 'mock agent response', toolCalls: [] });
  });

  it('resolves promptTemplate variables from context', async () => {
    const snapshot = makeSnapshot('agent', {
      agentName: 'test',
      promptTemplate: 'Brand: {{$.steps.brand.title}}, Tone: {{$.steps.brand.tone}}',
      tools: [],
    });
    const context = makeContext({
      steps: { brand: { title: 'Glow Co', tone: 'playful' } },
    });

    const agentInstance = { generate: jest.fn().mockResolvedValue({ text: 'ok', toolCalls: [] }) };
    Agent.mockImplementationOnce(() => agentInstance);

    const step = new AgentStep(snapshot);
    await step.execute(context);

    const [prompt] = agentInstance.generate.mock.calls[0];
    expect(prompt).toBe('Brand: Glow Co, Tone: playful');
  });

  it('uses default system prompt when systemPrompt omitted', async () => {
    const snapshot = makeSnapshot('agent', {
      agentName: 'test',
      promptTemplate: 'hi',
      tools: [],
    });

    const step = new AgentStep(snapshot);
    await step.execute(makeContext());

    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: 'You are a helpful assistant.' }),
    );
  });

  it('only builds tools listed in step config', async () => {
    const snapshot = makeSnapshot('agent', {
      agentName: 'test',
      promptTemplate: 'hi',
      tools: [
        {
          name: 'search_creators',
          type: 'builtin',
          builtinId: 'search-instagram-creators',
          description: 'Find creators',
          inputSchema: { properties: { hashtag: { type: 'string' } } },
        },
      ],
    });

    const agentInstance = { generate: jest.fn().mockResolvedValue({ text: 'ok', toolCalls: [] }) };
    Agent.mockImplementationOnce((cfg: any) => {
      expect(Object.keys(cfg.tools)).toEqual(['search_creators']);
      return agentInstance;
    });

    const step = new AgentStep(snapshot);
    await step.execute(makeContext());
  });

  it('passes threadId and resourceId to agent.generate when configured', async () => {
    const snapshot = makeSnapshot('agent', {
      agentName: 'test',
      promptTemplate: 'hi',
      tools: [],
      threadIdPath: '$.input.threadId',
      resourceIdPath: '$.input.userId',
    });
    const context = makeContext({ input: { threadId: 'thread-1', userId: 'user-1' } });

    const agentInstance = { generate: jest.fn().mockResolvedValue({ text: 'ok', toolCalls: [] }) };
    Agent.mockImplementationOnce(() => agentInstance);

    const step = new AgentStep(snapshot);
    await step.execute(context);

    expect(agentInstance.generate).toHaveBeenCalledWith(
      'hi',
      { memory: { thread: 'thread-1', resource: 'user-1' } },
    );
  });
});
