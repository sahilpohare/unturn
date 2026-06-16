import type { FlowContext } from '../../flow.types';
import { scrapeUrl } from './scrape-url.builtin';
import { metaAdLibrary } from './meta-ad-library.builtin';
import { instagramProfile, searchInstagramCreators, sendInstagramDm } from './instagram.builtin';

export type BuiltinHandler = (input: Record<string, unknown>) => Promise<unknown>;

/**
 * Builds the builtin tool registry for a single step execution.
 * Credentials come from FlowContext (injected at workflow start by the API
 * process). process.env is used as a fallback for local dev only.
 */
export function buildBuiltinRegistry(context: FlowContext): Record<string, BuiltinHandler> {
  const creds = context.credentials ?? {};
  const metaToken = creds.metaAccessToken ?? process.env.META_ACCESS_TOKEN;
  const igToken = creds.instagramAccessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = creds.instagramUserId ?? process.env.INSTAGRAM_USER_ID;

  return {
    'scrape-url': ({ url }) => scrapeUrl({ url: url as string }),

    'meta-ad-library': ({ pageId, countries, limit }) =>
      metaAdLibrary({ pageId: pageId as string, countries: countries as string | undefined, limit: limit as number | undefined }, metaToken),

    'instagram-profile': ({ handle }) =>
      instagramProfile({ handle: handle as string }, igToken),

    'search-instagram-creators': ({ hashtag, limit }) =>
      searchInstagramCreators({ hashtag: hashtag as string, limit: limit as number | undefined }),

    'send-instagram-dm': ({ recipientId, message }) =>
      sendInstagramDm({ recipientId: recipientId as string, message: message as string }, igToken, igUserId),
  };
}
