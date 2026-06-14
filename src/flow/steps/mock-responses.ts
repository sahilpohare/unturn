/**
 * Runtime mock responses for external APIs and LLM calls.
 *
 * Activated when OPENAI_MODEL=mock (LLM) or MOCK_APIS=true (external HTTP).
 * Set both for a fully offline demo run:
 *
 *   OPENAI_MODEL=mock MOCK_APIS=true npm run run-agent -- --agent ugc-creator-outreach --store jacquemus
 */

export const IS_MOCK_LLM = process.env.OPENAI_MODEL === 'mock';
export const IS_MOCK_APIS = process.env.MOCK_APIS === 'true' || IS_MOCK_LLM;

// ── LLM mock responses keyed by agent name ────────────────────────────────────

export const MOCK_LLM_RESPONSES: Record<string, string> = {
  // brand-research step uses outreach-research-agent
  'outreach-research-agent': JSON.stringify({
    title: 'Jacquemus',
    description: 'Sun-drenched French luxury brand known for architectural silhouettes and Mediterranean warmth.',
    products: [
      { name: 'Le Bambino', description: 'Iconic micro handbag, architectural shape' },
      { name: 'La Robe Courte', description: 'Minimalist short dress with sculptural details' },
    ],
    tone: 'warm, poetic, surrealist-minimal',
    targetAudience: 'Aspirational millennials and Gen Z, fashion-forward, disposable income',
    values: ['artistry', 'provençal heritage', 'emotional storytelling', 'playful luxury'],
  }),

  // ugc-creator-outreach: find-creators step
  ugcResearchAgent: JSON.stringify([
    { handle: 'amelie_paris_style', recipientId: 'mock-id-001', followerCount: 42000, engagementSignal: 'high', reason: 'Consistently posts minimalist OOTDs matching Jacquemus aesthetic' },
    { handle: 'soleil_et_mode', recipientId: 'mock-id-002', followerCount: 28000, engagementSignal: 'high', reason: 'Mediterranean lifestyle content, tagged Jacquemus in 3 posts' },
    { handle: 'luxe.quotidien', recipientId: 'mock-id-003', followerCount: 61000, engagementSignal: 'medium', reason: 'Parisian fashion micro-influencer, high authenticity' },
    { handle: 'margarita.m.style', recipientId: 'mock-id-004', followerCount: 19000, engagementSignal: 'high', reason: 'Strong engagement, posts architectural fashion photography' },
    { handle: 'the.slow.wardrobe', recipientId: 'mock-id-005', followerCount: 35000, engagementSignal: 'medium', reason: 'Slow fashion advocate, aligns with brand values of craft' },
  ]),

  // ugc-creator-outreach: send-dms step
  ugcOutreachAgent:
    'DMs sent to 5 creators. Messages personalised per creator:\n' +
    '• @amelie_paris_style: "Bonjour Amélie — your architectural styling is exactly how we dream of Le Bambino being worn. Would love to send you a piece. 🌿"\n' +
    '• @soleil_et_mode: "Your Mediterranean content is everything we stand for. Let\'s collab — gifting + creative freedom. DM back?"\n' +
    '• @luxe.quotidien: "Your eye for minimal luxury is rare. We\'d love you to be part of our next chapter. Gifting, no obligations."\n' +
    '• @margarita.m.style: "The architecture in your photography. We see you. Gift incoming if you\'re open to it? 🌞"\n' +
    '• @the.slow.wardrobe: "Craft, intention, beauty — we share values. Would love to connect on a gifting collab."',

  // trend-to-copy: scrape-trends step
  trendResearchAgent: JSON.stringify({
    trends: ['fluid silhouettes', 'butter yellows and raw linens', 'Mediterranean resort-wear crossover', 'sculptural minimalism'],
    colours: ['ecru', 'sun yellow', 'terracotta', 'bone white'],
    culturalRefs: ['Riviera summers', 'Matisse cutouts', 'New Wave cinema'],
    keywords: ['effortless', 'sculptural', 'sun-drenched', 'resort', 'architectural'],
    summary: 'Spring 2025 trend narrative: Mediterranean sun meets Parisian atelier. Warm neutrals, body-conscious but architectural shapes.',
  }),

  // trend-to-copy: generate-copy step
  copywriterAgent:
    '**PRODUCT DESCRIPTION**\n' +
    'Le Bambino Long carries the architecture of a building and the weight of an afternoon. Structured calfskin, a single curved strap, and dimensions that make everything else disappear. This is the bag that makes the outfit — not the other way around. Sized for what matters: phone, keys, a folded note. The Long elongates the original silhouette into something that moves differently, swings differently, photographs differently. Ecru, because colour should be earned.\n\n' +
    '**INSTAGRAM CAPTION**\n' +
    'The bag that started conversations before a word was said. #Jacquemus #LeBambino #SlowFashion #FrenchLuxury #SS25\n\n' +
    '**EMAIL SUBJECT LINES**\n' +
    'A) Le Bambino Long. In ecru.\n' +
    'B) The bag you\'ve been circling.\n\n' +
    '**REASONING**\n' +
    'Jacquemus copy lives or dies on restraint — overwriting kills the mystique. The description leans into the Riviera-meets-atelier SS25 trend moment without naming it directly. The caption is single-sentence because the brand\'s best-performing posts always are.',

  // Palace Skateboards variants (keyed by agentName + store context not available at runtime,
  // so we use a secondary lookup in the runner via MOCK_STORE env)
  'ugcResearchAgent:palace-skateboards': JSON.stringify([
    { handle: 'uk.skate.clips', recipientId: 'mock-id-101', followerCount: 89000, engagementSignal: 'high', reason: 'Raw skate clips, London spots, exactly Palace\'s community' },
    { handle: 'streetwear.london', recipientId: 'mock-id-102', followerCount: 54000, engagementSignal: 'high', reason: 'UK streetwear coverage, regularly features Palace drops' },
    { handle: 'grime.and.grip', recipientId: 'mock-id-103', followerCount: 31000, engagementSignal: 'high', reason: 'Skate + grime culture intersection, authentic subcultural voice' },
    { handle: 'board.or.bust', recipientId: 'mock-id-104', followerCount: 22000, engagementSignal: 'very high', reason: 'Small but hyper-engaged skate community account' },
    { handle: 'pavement.prophet', recipientId: 'mock-id-105', followerCount: 41000, engagementSignal: 'medium', reason: 'London streetwear photographer, has shot Palace riders before' },
  ]),

  'ugcOutreachAgent:palace-skateboards':
    'DMs sent to 5 creators:\n' +
    '• @uk.skate.clips: "Lads. Palace x you. Tri-ferg incoming if you\'re down. Holla."\n' +
    '• @streetwear.london: "You know the drill. New Tri-ferg Bomber. Yours if you want it. No brief, no BS."\n' +
    '• @grime.and.grip: "Real ones only. Got a jacket with your name on it. Palace."\n' +
    '• @board.or.bust: "Your crew, our gear. Let\'s link. 🔺"\n' +
    '• @pavement.prophet: "Shot some of our riders already. Let\'s make it official. Jacket in the post."\n',

  'trendResearchAgent:palace-skateboards': JSON.stringify({
    trends: ['workwear silhouettes on skaters', 'archive sportswear revival', 'UK garage and grime cultural crossover', 'anti-logo logomania'],
    colours: ['safety orange', 'washed black', 'racing green', 'off-white'],
    culturalRefs: ['90s Reebok', 'UK pirate radio', 'Southbank concrete', 'Terry Richardson aesthetic'],
    keywords: ['raw', 'irreverent', 'subcultural', 'heavy', 'iconic'],
    summary: 'Palace\'s moment is defined by archive reissue culture meeting genuine subcultural credibility. The anti-hype hype paradox.',
  }),

  'copywriterAgent:palace-skateboards':
    '**PRODUCT DESCRIPTION**\n' +
    'The Tri-Ferg Bomber. It\'s a bomber jacket. You already know what it is. Shell, lining, the triangle on the chest. We\'ve been making versions of this since before it was cool, through when it was cool, and into the other side where it\'s just correct. Wear it to skate. Wear it to not skate. Wash it on hot by mistake and deal with it. Racing green because safety orange sold out.\n\n' +
    '**INSTAGRAM CAPTION**\n' +
    'Tri-Ferg Bomber. Racing Green. Thursday. 🔺 #Palace #Palaceskateboards #TriFerg #Streetwear\n\n' +
    '**EMAIL SUBJECT LINES**\n' +
    'A) Bomber. Thursday.\n' +
    'B) You know what this is.\n\n' +
    '**REASONING**\n' +
    'Palace copy is deliberately deadpan and self-aware — it acknowledges hype culture while refusing to participate in it earnestly. The description leans into the brand\'s "anti-marketing marketing" DNA. Subject lines are terse because Palace\'s audience already knows; anything more would feel like trying too hard.',
};

/**
 * Get a mock LLM response for a given agent name.
 * Falls back to generic placeholder if no specific mock defined.
 */
export function getMockLlmResponse(agentName: string, store?: string): string {
  // Try store-specific first
  if (store) {
    const storeKey = `${agentName}:${store}`;
    if (MOCK_LLM_RESPONSES[storeKey]) return MOCK_LLM_RESPONSES[storeKey];
  }
  return MOCK_LLM_RESPONSES[agentName] ?? `[MOCK] ${agentName} completed successfully.`;
}

// ── API mock responses ────────────────────────────────────────────────────────

export const MOCK_API_RESPONSES: Record<string, unknown> = {
  'scrape-url': {
    url: 'https://example.com',
    text: 'Luxury fashion brand. Minimalist aesthetics. French heritage. Shop our latest collection.',
  },

  'meta-ad-library': {
    data: [
      {
        id: 'mock-ad-001',
        page_name: 'Mock Brand',
        ad_creative_bodies: ['Introducing our new collection. Shop now.'],
        publisher_platforms: ['instagram', 'facebook'],
        ad_delivery_start_time: '2024-12-01T00:00:00+0000',
      },
      {
        id: 'mock-ad-002',
        page_name: 'Mock Brand',
        ad_creative_bodies: ['Real people. Real style. Tag us @mockbrand to be featured.'],
        publisher_platforms: ['instagram'],
        ad_delivery_start_time: '2025-01-15T00:00:00+0000',
      },
    ],
    paging: { cursors: { before: 'abc', after: 'def' } },
  },

  'instagram-profile': {
    username: 'mock_creator',
    name: 'Mock Creator',
    biography: 'Fashion + lifestyle. Based in London. Collabs: hello@mockcreator.com',
    followers_count: 42000,
    follows_count: 800,
    media_count: 312,
  },

  'search-instagram-creators': {
    hashtag: 'mockfashion',
    creators: ['mock_creator_1', 'mock_creator_2', 'mock_creator_3', 'mock_creator_4', 'mock_creator_5'],
    count: 5,
  },

  'send-instagram-dm': {
    recipient_id: 'mock-recipient',
    message_id: 'mock-msg-' + Date.now(),
    status: 'sent',
  },
};

/**
 * Intercept fetch for a known API pattern and return mock data.
 * Returns undefined if the URL doesn't match a known mock.
 */
export function getMockFetchResponse(url: string): unknown | undefined {
  if (url.includes('ads_archive') || url.includes('ad_library')) return MOCK_API_RESPONSES['meta-ad-library'];
  if (url.includes('instagram.com') && url.includes('/messages')) return MOCK_API_RESPONSES['send-instagram-dm'];
  if (url.includes('instagram.com') && url.includes('/explore/tags')) {
    return '<html>"username":"mock_creator_1" @mock_creator_2 @mock_creator_3</html>';
  }
  if (url.includes('graph.facebook.com') && !url.includes('ads_archive')) return MOCK_API_RESPONSES['instagram-profile'];
  // Generic scrape
  if (url.startsWith('http')) return MOCK_API_RESPONSES['scrape-url'];
  return undefined;
}
