import { ApplicationFailure } from '@temporalio/activity';
import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep, assertPublicUrl } from './base.step';
import { IS_MOCK_LLM, IS_MOCK_APIS, getMockLlmResponse } from './mock-responses';

export interface BrandResearchConfig {
  websiteUrl: string;
  extraPaths?: string[];
}

export class BrandResearchStep extends BaseStep<BrandResearchConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const baseUrl = this.resolvePath(this.config.websiteUrl, context) as string ?? this.config.websiteUrl;
    assertPublicUrl(baseUrl);
    const paths = [baseUrl, ...(this.config.extraPaths ?? []).map((p) => `${baseUrl.replace(/\/$/, '')}${p}`)];

    // Mock path — skip real scraping and LLM call
    if (IS_MOCK_LLM) {
      const store = process.env.MOCK_STORE;
      console.log(`[MOCK] brand-research(${baseUrl}) store=${store ?? 'default'}`);
      const text = getMockLlmResponse('outreach-research-agent', store);
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch { parsed = { title: baseUrl, description: text }; }
      return {
        output: {
          url: baseUrl,
          title: parsed.title ?? baseUrl,
          description: parsed.description ?? '',
          rawText: '[MOCK] scraped content',
          products: parsed.products ?? [],
          ...parsed,
        },
      };
    }

    const pages: string[] = [];
    for (const url of paths) {
      assertPublicUrl(url);
      // Real scraper always runs unless IS_MOCK_APIS is true
      if (IS_MOCK_APIS) {
        pages.push(`[MOCK] content for ${url}`);
        continue;
      }
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000);
      pages.push(text);
    }

    const combined = pages.join('\n\n---\n\n');

    const { mastraInstance } = await import('../../temporal/activities/mastra-singleton.js');
    const agent = (mastraInstance as any).getAgent('outreach-research-agent');
    if (!agent) {
      throw ApplicationFailure.nonRetryable('outreach-research-agent not registered in mastra instance');
    }

    const result = await agent.generate(
      `You are a brand analyst. Extract brand identity from the following website content.
Return a JSON object:
{
  "title": "Brand name",
  "description": "1-2 sentence brand description",
  "products": [{ "name": "...", "description": "..." }],
  "tone": "e.g. playful, premium, minimalist",
  "targetAudience": "e.g. millennial women interested in wellness",
  "values": ["value1", "value2"]
}
Website content:
${combined}
Return ONLY the JSON, no markdown.`,
    );

    let parsed: any = {};
    try {
      parsed = JSON.parse(result.text.replace(/```json|```/g, '').trim());
    } catch {
      parsed = { title: baseUrl, description: result.text };
    }

    return {
      output: {
        url: baseUrl,
        title: parsed.title ?? baseUrl,
        description: parsed.description ?? '',
        rawText: combined.slice(0, 1000),
        products: parsed.products ?? [],
        ...parsed,
      },
    };
  }
}
