import { ApplicationFailure } from '@temporalio/activity';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { FlowContext, ExecuteStepOutput, ToolConfig } from '../flow.types';
import type { AgentStepConfig } from '../step.entity';
import { BaseStep } from './base.step';

// ─── Builtin tool registry ────────────────────────────────────────────────────

const builtinRegistry: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
  'scrape-url': async ({ url }) => {
    const res = await fetch(url as string, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
    return { url, text };
  },

  'meta-ad-library': async ({ pageId, countries = 'US', limit = 50 }) => {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error('META_ACCESS_TOKEN env var not set');
    const params = new URLSearchParams({
      search_page_ids: pageId as string,
      ad_type: 'ALL',
      ad_reached_countries: JSON.stringify((countries as string).split(',').map((c) => c.trim())),
      fields: 'id,page_id,page_name,ad_snapshot_url,ad_creative_bodies,publisher_platforms,ad_delivery_start_time',
      limit: String(limit),
      access_token: token,
    });
    const res = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params}`);
    if (!res.ok) throw new Error(`Meta API ${res.status}: ${await res.text()}`);
    return res.json();
  },

  'instagram-profile': async ({ handle }) => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (token) {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${handle}?fields=name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${token}`,
      );
      if (res.ok) return res.json();
    }
    const res = await fetch(`https://www.instagram.com/${handle}/?__a=1&__d=dis`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`Could not fetch profile for @${handle}`);
    return res.json();
  },

  'search-instagram-creators': async ({ hashtag, limit = 20 }) => {
    const tag = (hashtag as string).replace(/^#/, '');
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`Instagram hashtag fetch failed: ${res.status}`);
    const html = await res.text();
    const handles = new Set<string>();
    for (const m of html.matchAll(/"username"\s*:\s*"([A-Za-z0-9_.]{3,30})"/g)) handles.add(m[1]);
    for (const m of html.matchAll(/@([A-Za-z0-9_.]{3,30})/g)) handles.add(m[1]);
    const system = new Set(['instagram', 'reels', 'explore', 'stories', 'shop']);
    const creators = [...handles].filter((h) => !system.has(h.toLowerCase())).slice(0, limit as number);
    return { hashtag: tag, creators, count: creators.length };
  },

  'send-instagram-dm': async ({ recipientId, message }) => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const igUserId = process.env.INSTAGRAM_USER_ID;
    if (!token) throw new Error('INSTAGRAM_ACCESS_TOKEN not set');
    if (!igUserId) throw new Error('INSTAGRAM_USER_ID not set');
    const res = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message }, access_token: token }),
    });
    if (!res.ok) throw new Error(`Instagram DM ${res.status}: ${await res.text()}`);
    return res.json();
  },
};

export class AgentStep extends BaseStep<AgentStepConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const { mastraInstance } = await import('../../temporal/activities/mastra-singleton.js');
    const agent = (mastraInstance as any).getAgent(this.config.agentName);
    if (!agent) {
      throw ApplicationFailure.nonRetryable(`Agent "${this.config.agentName}" not found`);
    }

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

  static buildTool(toolConfig: ToolConfig) {
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
