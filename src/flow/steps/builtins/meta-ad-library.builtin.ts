import { IS_MOCK_APIS, getMockFetchResponse } from '../mock-responses';

export async function metaAdLibrary(
  { pageId, countries = 'US', limit = 50 }: { pageId: string; countries?: string; limit?: number },
  metaAccessToken: string | undefined,
): Promise<unknown> {
  if (IS_MOCK_APIS) {
    console.log(`[MOCK] meta-ad-library(pageId=${pageId})`);
    return getMockFetchResponse('ads_archive');
  }
  if (!metaAccessToken) throw new Error('metaAccessToken not set for this tenant');
  const params = new URLSearchParams({
    search_page_ids: pageId,
    ad_type: 'ALL',
    ad_reached_countries: JSON.stringify((countries as string).split(',').map((c) => c.trim())),
    fields:
      'id,page_id,page_name,ad_snapshot_url,ad_creative_bodies,publisher_platforms,ad_delivery_start_time',
    limit: String(limit),
    access_token: metaAccessToken,
  });
  const res = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params}`);
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${await res.text()}`);
  return res.json();
}
