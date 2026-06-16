import { IS_MOCK_APIS, getMockFetchResponse } from '../mock-responses';

export async function instagramProfile(
  { handle }: { handle: string },
  igAccessToken: string | undefined,
): Promise<unknown> {
  if (IS_MOCK_APIS) {
    console.log(`[MOCK] instagram-profile(${handle})`);
    return { ...(getMockFetchResponse('graph.facebook.com') as object), username: handle };
  }
  if (igAccessToken) {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${handle}?fields=name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${igAccessToken}`,
    );
    if (res.ok) return res.json();
  }
  // Undocumented fallback — only used when no token is configured
  const res = await fetch(`https://www.instagram.com/${handle}/?__a=1&__d=dis`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Could not fetch profile for @${handle}`);
  return res.json();
}

export async function searchInstagramCreators(
  { hashtag, limit = 20 }: { hashtag: string; limit?: number },
): Promise<{ hashtag: string; creators: string[]; count: number }> {
  if (IS_MOCK_APIS) {
    console.log(`[MOCK] search-instagram-creators(${hashtag})`);
    return getMockFetchResponse('instagram.com/explore/tags') as any;
  }
  const tag = (hashtag as string).replace(/^#/, '');
  const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      Accept: 'text/html,application/xhtml+xml',
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
}

export async function sendInstagramDm(
  { recipientId, message }: { recipientId: string; message: string },
  igAccessToken: string | undefined,
  igUserId: string | undefined,
): Promise<unknown> {
  if (IS_MOCK_APIS) {
    console.log(`[MOCK] send-instagram-dm(to=${recipientId}, msg="${String(message).slice(0, 60)}...")`);
    return { recipient_id: recipientId, message_id: 'mock-msg-' + Date.now(), status: 'sent' };
  }
  if (!igAccessToken) throw new Error('instagramAccessToken not set for this tenant');
  if (!igUserId) throw new Error('instagramUserId not set for this tenant');
  const res = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: igAccessToken,
    }),
  });
  if (!res.ok) throw new Error(`Instagram DM ${res.status}: ${await res.text()}`);
  return res.json();
}
