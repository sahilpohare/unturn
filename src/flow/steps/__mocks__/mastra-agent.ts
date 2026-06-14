/**
 * Reusable factory for a mock Mastra Agent.
 * Pass the text you want the agent to return.
 */
export function mockAgent(text: string, toolCalls: unknown[] = []) {
  return {
    generate: jest.fn().mockResolvedValue({ text, toolCalls }),
  };
}
