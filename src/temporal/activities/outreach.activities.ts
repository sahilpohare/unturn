import { ApplicationFailure } from '@temporalio/activity';
import type { FlowContext, ExecuteStepOutput } from '../../flow/flow.types';
import type {
  BrandResearchConfig,
  MetaAdsSearchConfig,
  CreatorVetConfig,
  InstagramDmConfig,
} from '../../flow/step.entity';

// ─── Context helpers ──────────────────────────────────────────────────────────

function resolvePath(path: string, context: FlowContext): unknown {
  if (!path.startsWith('$.')) return path;
  const parts = path.slice(2).split('.');
  let val: unknown = context;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return undefined;
    val = (val as Record<string, unknown>)[part];
  }
  return val;
}

// ─── Brand Research ───────────────────────────────────────────────────────────

export interface BrandProfile {
  url: string;
  title: string;
  description: string;
  rawText: string;
  products: { name: string; description: string }[];
}

export async function executeBrandResearch(
  config: BrandResearchConfig,
  context: FlowContext,
): Promise<BrandProfile> {
  const baseUrl = resolvePath(config.websiteUrl, context) as string ?? config.websiteUrl;
  const paths = [baseUrl, ...(config.extraPaths ?? []).map((p) => `${baseUrl.replace(/\/$/, '')}${p}`)];

  const pages: string[] = [];

  for (const url of paths) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
    });
    if (!res.ok) continue;
    const html = await res.text();
    // Strip tags, collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000); // keep first 4k chars per page
    pages.push(text);
  }

  const combined = pages.join('\n\n---\n\n');

  // Extract title from first page HTML (rough)
  const titleMatch = pages[0]?.match(/(?:^|\s)([A-Z][^.!?]{5,80})/);
  const title = titleMatch?.[1] ?? baseUrl;

  // Use mastra agent to extract structured brand data
  const { mastraInstance } = await import('./mastra-singleton.js');
  const agent = (mastraInstance as any).getAgent('outreach-research-agent');
  if (!agent) {
    throw ApplicationFailure.nonRetryable('outreach-research-agent not registered in mastra-singleton');
  }

  const result = await agent.generate(
    `You are a brand analyst. Extract the brand identity and top products from the following website content.

Return a JSON object with this exact shape:
{
  "title": "Brand name",
  "description": "1-2 sentence brand description",
  "products": [{ "name": "product name", "description": "short description" }],
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
    // best effort — return raw text if parse fails
    parsed = { title, description: result.text };
  }

  return {
    url: baseUrl,
    title: parsed.title ?? title,
    description: parsed.description ?? '',
    rawText: combined.slice(0, 1000),
    products: parsed.products ?? [],
    ...parsed,
  };
}

// ─── Meta Ad Library Search ───────────────────────────────────────────────────

export interface AdCreative {
  adId: string;
  pageId: string;
  pageName: string;
  snapshotUrl: string;
  body: string;
  platforms: string[];
  startDate: string | null;
  isUgcLike: boolean;
  /** Instagram handles visible in the ad body */
  extractedHandles: string[];
}

export async function executeMetaAdsSearch(
  config: MetaAdsSearchConfig,
  context: FlowContext,
): Promise<{ ads: AdCreative[]; ugcAds: AdCreative[]; handles: string[] }> {
  const pageId = resolvePath(config.pageIdPath, context) as string ?? config.pageIdPath;
  const token = config.accessToken ?? process.env.META_ACCESS_TOKEN;

  if (!token) {
    throw ApplicationFailure.nonRetryable('META_ACCESS_TOKEN not set');
  }

  const params = new URLSearchParams({
    search_page_ids: pageId,
    ad_type: 'ALL',
    ad_reached_countries: JSON.stringify(config.countries ?? ['US']),
    fields: [
      'id',
      'page_id',
      'page_name',
      'ad_snapshot_url',
      'ad_creative_bodies',
      'publisher_platforms',
      'ad_delivery_start_time',
    ].join(','),
    limit: String(config.limit ?? 50),
    access_token: token,
  });

  const url = `https://graph.facebook.com/v20.0/ads_archive?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    throw ApplicationFailure.create({
      message: `Meta Ad Library API ${res.status}: ${err}`,
      nonRetryable: res.status === 401 || res.status === 403,
    });
  }

  const data = await res.json() as { data: any[] };
  const rawAds: any[] = data.data ?? [];

  // UGC detection: talking-head ads tend to have short, conversational body copy
  // and appear on Instagram Reels / Stories
  const ugcSignals = /\b(i tried|honest review|obsessed|game.?changer|must.?have|real results|this is not an ad|not sponsored)\b/i;
  const handleRegex = /@([A-Za-z0-9_.]{3,30})/g;

  const ads: AdCreative[] = rawAds.map((raw) => {
    const body = (raw.ad_creative_bodies ?? []).join(' ');
    const handles = [...body.matchAll(handleRegex)].map((m) => m[1]);
    const platforms: string[] = raw.publisher_platforms ?? [];
    const isUgcLike =
      ugcSignals.test(body) ||
      platforms.some((p: string) => ['instagram', 'facebook'].includes(p.toLowerCase()));

    return {
      adId: raw.id,
      pageId: raw.page_id,
      pageName: raw.page_name,
      snapshotUrl: raw.ad_snapshot_url,
      body,
      platforms,
      startDate: raw.ad_delivery_start_time ?? null,
      isUgcLike,
      extractedHandles: handles,
    };
  });

  const ugcAds = ads.filter((a) => a.isUgcLike);
  const handles = [...new Set(ugcAds.flatMap((a) => a.extractedHandles))];

  return { ads, ugcAds, handles };
}

// ─── Creator Vetting ──────────────────────────────────────────────────────────

export interface CreatorProfile {
  handle: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isVerified: boolean;
  profilePicUrl: string;
  score: number; // 0-100
}

export async function executeCreatorVet(
  config: CreatorVetConfig,
  context: FlowContext,
): Promise<{ creators: CreatorProfile[] }> {
  const handles = resolvePath(config.handlesPath, context) as string[];

  if (!Array.isArray(handles) || handles.length === 0) {
    return { creators: [] };
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const minFollowers = config.minFollowers ?? 1000;
  const topN = config.topN ?? 10;

  const creators: CreatorProfile[] = [];

  for (const handle of handles.slice(0, 30)) { // cap at 30 to avoid rate limits
    try {
      let profile: any;

      if (token) {
        // Use Instagram Graph API if token available
        const res = await fetch(
          `https://graph.facebook.com/v20.0/${handle}?fields=name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${token}`,
        );
        if (res.ok) profile = await res.json();
      }

      if (!profile) {
        // Fallback: public profile page (best-effort text parse)
        const res = await fetch(`https://www.instagram.com/${handle}/?__a=1&__d=dis`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (res.ok) {
          try { profile = await res.json(); } catch { /* ignore */ }
        }
      }

      if (!profile) continue;

      const followerCount = profile.followers_count ?? profile.graphql?.user?.edge_followed_by?.count ?? 0;
      if (followerCount < minFollowers) continue;

      // Simple score: log-scale followers (max 40) + bio length proxy (max 30) + verified (30)
      const followerScore = Math.min(40, Math.log10(followerCount + 1) * 10);
      const bioScore = Math.min(30, (profile.biography?.length ?? 0) / 5);
      const verifiedScore = profile.is_verified ? 30 : 0;
      const score = Math.round(followerScore + bioScore + verifiedScore);

      creators.push({
        handle,
        fullName: profile.name ?? profile.graphql?.user?.full_name ?? handle,
        bio: profile.biography ?? profile.graphql?.user?.biography ?? '',
        followerCount,
        followingCount: profile.follows_count ?? 0,
        postCount: profile.media_count ?? 0,
        isVerified: !!profile.is_verified,
        profilePicUrl: profile.profile_picture_url ?? '',
        score,
      });
    } catch {
      // skip failed profiles
    }
  }

  const sorted = creators.sort((a, b) => b.score - a.score).slice(0, topN);
  return { creators: sorted };
}

// ─── Instagram DM ─────────────────────────────────────────────────────────────

export interface DmResult {
  handle: string;
  recipientId: string;
  status: 'sent' | 'failed';
  error?: string;
}

export async function executeInstagramDm(
  config: InstagramDmConfig,
  context: FlowContext,
): Promise<{ results: DmResult[] }> {
  const recipientId = resolvePath(config.recipientIdPath, context) as string;
  const message = resolvePath(config.messagePath, context) as string;
  const token = config.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_USER_ID;

  if (!token) throw ApplicationFailure.nonRetryable('INSTAGRAM_ACCESS_TOKEN not set');
  if (!igUserId) throw ApplicationFailure.nonRetryable('INSTAGRAM_USER_ID not set');
  if (!recipientId || !message) {
    throw ApplicationFailure.nonRetryable('recipientId and message are required');
  }

  if (config.delayMs) {
    await new Promise((r) => setTimeout(r, config.delayMs));
  }

  // Instagram Graph API: send DM via /me/messages
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${igUserId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: token,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return {
      results: [{
        handle: String(recipientId),
        recipientId,
        status: 'failed',
        error: `${res.status}: ${err}`,
      }],
    };
  }

  return {
    results: [{
      handle: String(recipientId),
      recipientId,
      status: 'sent',
    }],
  };
}
