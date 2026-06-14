import { ApplicationFailure } from '@temporalio/activity';
import type { FlowContext, ExecuteStepOutput } from '../flow.types';
import { BaseStep } from './base.step';

export interface MetaAdsSearchConfig {
  pageIdPath: string;
  countries: string[];
  limit?: number;
}

export class MetaAdsSearchStep extends BaseStep<MetaAdsSearchConfig> {
  async execute(context: FlowContext): Promise<ExecuteStepOutput> {
    const pageId = this.resolvePath(this.config.pageIdPath, context) as string ?? this.config.pageIdPath;
    const token = process.env.META_ACCESS_TOKEN;

    if (!token) throw ApplicationFailure.nonRetryable('META_ACCESS_TOKEN not set');

    const params = new URLSearchParams({
      search_page_ids: pageId,
      ad_type: 'ALL',
      ad_reached_countries: JSON.stringify(this.config.countries ?? ['US']),
      fields: 'id,page_id,page_name,ad_snapshot_url,ad_creative_bodies,publisher_platforms,ad_delivery_start_time',
      limit: String(this.config.limit ?? 50),
      access_token: token,
    });

    const res = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params}`);
    if (!res.ok) {
      const err = await res.text();
      throw ApplicationFailure.create({
        message: `Meta Ad Library API ${res.status}: ${err}`,
        nonRetryable: res.status === 401 || res.status === 403,
      });
    }

    const data = await res.json() as { data: any[] };
    const rawAds: any[] = data.data ?? [];

    const ugcSignals = /\b(i tried|honest review|obsessed|game.?changer|must.?have|real results|this is not an ad|not sponsored)\b/i;
    const handleRegex = /@([A-Za-z0-9_.]{3,30})/g;

    const ads = rawAds.map((raw) => {
      const body = (raw.ad_creative_bodies ?? []).join(' ');
      const handles = [...body.matchAll(handleRegex)].map((m) => m[1]);
      const platforms: string[] = raw.publisher_platforms ?? [];
      const isUgcLike =
        ugcSignals.test(body) ||
        platforms.some((p) => ['instagram', 'facebook'].includes(p.toLowerCase()));
      return { adId: raw.id, pageId: raw.page_id, pageName: raw.page_name, snapshotUrl: raw.ad_snapshot_url, body, platforms, startDate: raw.ad_delivery_start_time ?? null, isUgcLike, extractedHandles: handles };
    });

    const ugcAds = ads.filter((a) => a.isUgcLike);
    const handles = [...new Set(ugcAds.flatMap((a) => a.extractedHandles))];

    return { output: { ads, ugcAds, handles } };
  }
}
