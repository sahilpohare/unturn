import { assertPublicUrl } from '../base.step';
import { IS_MOCK_APIS, getMockFetchResponse } from '../mock-responses';

export async function scrapeUrl({ url }: { url: string }): Promise<{ url: string; text: string }> {
  if (IS_MOCK_APIS) {
    const mock = getMockFetchResponse(url as string);
    console.log(`[MOCK] scrape-url(${url})`);
    return (mock as any) ?? { url, text: '[MOCK] Page content for ' + url };
  }
  assertPublicUrl(url);
  const res = await fetch(url, {
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
}
