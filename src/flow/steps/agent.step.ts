import { ApplicationFailure } from '@temporalio/activity';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep, assertPublicUrl } from './base.step';
import { IS_MOCK_LLM, getMockLlmResponse } from './mock-responses';
import { buildBuiltinRegistry } from './builtins/index';

export interface ToolConfig {
  name: string;
  type: 'http' | 'builtin';
  description: string;
  inputSchema: Record<string, unknown>;
  http?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
  };
  builtinId?: string;
}

export interface AgentStepConfig {
  agentName: string;
  systemPrompt?: string;
  promptTemplate: string;
  tools: ToolConfig[];
  threadIdPath?: string;
  resourceIdPath?: string;
}

export class AgentStep extends BaseStep<AgentStepConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    // Mock LLM path — returns canned response, no API call made
    if (IS_MOCK_LLM) {
      const store = process.env.MOCK_STORE;
      const text = getMockLlmResponse(this.config.agentName, store);
      console.log(`[MOCK LLM] agent=${this.config.agentName} store=${store ?? 'default'}`);
      return { output: { text, toolCalls: [] } };
    }

    const model = process.env.OPENAI_MODEL ?? 'openai/gpt-4o-mini';

    // Build tools from the step config — only the ones this step needs
    const builtinRegistry = buildBuiltinRegistry(context);
    const tools = Object.fromEntries(
      (this.config.tools ?? []).map((tc) => [tc.name, AgentStep.buildTool(tc, builtinRegistry)]),
    );

    // Agent constructed at runtime from JSON — no singleton lookup
    const agent = new Agent({
      id: this.config.agentName,
      name: this.config.agentName,
      instructions: this.config.systemPrompt ?? 'You are a helpful assistant.',
      model,
      tools,
    });

    const prompt = this.resolveTemplate(this.config.promptTemplate, context);
    const threadId = this.config.threadIdPath
      ? (this.resolvePath(this.config.threadIdPath, context) as string | undefined)
      : undefined;
    const resourceId = this.config.resourceIdPath
      ? (this.resolvePath(this.config.resourceIdPath, context) as string | undefined)
      : context.tenantId;

    const result = await agent.generate(prompt, {
      memory: threadId ? { thread: threadId, resource: resourceId! } : undefined,
    });

    return { output: { text: result.text, toolCalls: result.toolCalls ?? [] } };
  }

  // ── Static factory for building Mastra tools from ToolConfig ───────────────

  static buildTool(toolConfig: ToolConfig, builtinRegistry: Record<string, (input: Record<string, unknown>) => Promise<unknown>>) {
    const shape: Record<string, z.ZodTypeAny> = {};
    const props = (toolConfig.inputSchema?.properties ?? {}) as Record<string, { type?: string; description?: string }>;
    for (const [key, def] of Object.entries(props)) {
      shape[key] = def.type === 'number' ? z.number() : z.string();
      if (def.description) shape[key] = shape[key].describe(def.description);
    }

    return createTool({
      id: toolConfig.name,
      description: toolConfig.description,
      inputSchema: z.object(shape),
      execute: async ({ context: toolInput }) => {
        if (toolConfig.type === 'builtin') {
          const handler = builtinRegistry[toolConfig.builtinId!];
          if (!handler) {
            throw ApplicationFailure.nonRetryable(`Builtin tool "${toolConfig.builtinId}" not registered`);
          }
          return handler(toolInput as Record<string, unknown>);
        }
        const { url, method, headers = {} } = toolConfig.http!;
        assertPublicUrl(url);
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: ['GET', 'DELETE'].includes(method) ? undefined : JSON.stringify(toolInput),
        });
        if (!res.ok) throw new Error(`Tool HTTP ${method} ${url} → ${res.status}`);
        return res.json();
      },
    });
  }
}
