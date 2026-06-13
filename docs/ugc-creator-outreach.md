# UGC Creator Outreach Agent

Automated pipeline that takes a brand's website and Facebook Page ID, researches their identity and ad strategy, discovers real Instagram creators via hashtag search, vets them against follower and niche criteria, and sends personalised DMs — fully autonomously.

---

## Architecture

```
Input (websiteUrl, metaPageId)
        │
        ▼
┌─────────────────────┐
│  1. brand-research  │  Scrapes website, extracts brand identity via LLM
└─────────┬───────────┘
          │ $.steps.brand-research.*
          ▼
┌─────────────────────┐
│  2. meta-ads-search │  Queries Meta Ad Library, detects UGC-style ads
└─────────┬───────────┘
          │ $.steps.meta-ads.ugcAds, $.steps.meta-ads.handles
          ▼
┌─────────────────────┐
│  3. find-creators   │  Agent: hashtag search → profile vetting → top 5
│  (ugcResearchAgent) │
│  Tools:             │
│   - search_instagram_creators  │
│   - instagram_profile          │
└─────────┬───────────┘
          │ $.steps.find-creators.text (JSON creator array)
          ▼
┌─────────────────────┐
│  4. send-dms        │  Agent: writes personalised DM → sends via API
│  (ugcOutreachAgent) │
│  Tools:             │
│   - send_instagram_dm          │
└─────────────────────┘
```

---

## Step 1 — Brand Research (`brand-research`)

Scrapes the brand website (homepage + `/about` + `/products`) and uses the `outreach-research-agent` Mastra agent to extract structured brand identity.

**Input config:**
```json
{
  "websiteUrl": "$.input.websiteUrl",
  "extraPaths": ["/about", "/products"]
}
```

**Output shape:**
```json
{
  "url": "https://brand.com",
  "title": "Brand Name",
  "description": "1-2 sentence brand description",
  "tone": "playful | premium | minimalist | ...",
  "targetAudience": "e.g. millennial women interested in wellness",
  "values": ["sustainability", "inclusivity"],
  "products": [{ "name": "...", "description": "..." }],
  "rawText": "first 1000 chars of scraped content"
}
```

**Mastra agent required:** `outreach-research-agent`

---

## Step 2 — Meta Ads Search (`meta-ads-search`)

Queries the Meta Ad Library API for all active ads on the brand's Facebook Page. Detects UGC-style ads using keyword signals and platform signals (Instagram/Reels). Extracts any `@handles` mentioned in ad copy.

**Input config:**
```json
{
  "pageIdPath": "$.input.metaPageId",
  "countries": ["US"],
  "limit": 20
}
```

**Output shape:**
```json
{
  "ads": [...],
  "ugcAds": [...],
  "handles": ["creator1", "creator2"]
}
```

**UGC detection signals:**
- Ad body contains: `i tried`, `honest review`, `obsessed`, `game changer`, `must have`, `real results`, `not an ad`, `not sponsored`
- Published on Instagram or Facebook platforms

**Env required:** `META_ACCESS_TOKEN` with `ads_read` permission

---

## Step 3 — Find Instagram Creators (`agent` — `ugcResearchAgent`)

AI agent that uses real Instagram data to discover and vet creators. No hallucinated handles — every creator returned has been fetched from actual Instagram pages.

### Agent loop

```
1. Analyse brand profile + ad data
2. Pick 3–5 niche hashtags (e.g. #skincareRoutine, #cleanBeauty)
3. For each hashtag → call search_instagram_creators → get real handles
4. For each handle → call instagram_profile → get followers, bio
5. Filter: 5k–500k followers, niche match, brand tone alignment
6. Return top 5 as JSON array
```

### Tool: `search_instagram_creators`

Scrapes `instagram.com/explore/tags/<hashtag>/` to extract usernames from embedded page JSON and `@handle` patterns in text.

```json
{
  "name": "search_instagram_creators",
  "type": "builtin",
  "builtinId": "search-instagram-creators",
  "inputSchema": {
    "properties": {
      "hashtag": { "type": "string", "description": "Hashtag without # e.g. skincare" },
      "limit":   { "type": "number", "description": "Max handles to return (default 20)" }
    }
  }
}
```

**Returns:**
```json
{
  "hashtag": "skincare",
  "creators": ["handle1", "handle2", "..."],
  "count": 18
}
```

### Tool: `instagram_profile`

Fetches a creator's profile. Uses Instagram Graph API if `INSTAGRAM_ACCESS_TOKEN` is set, falls back to public profile scrape.

```json
{
  "name": "instagram_profile",
  "type": "builtin",
  "builtinId": "instagram-profile",
  "inputSchema": {
    "properties": {
      "handle": { "type": "string", "description": "Username without @" }
    }
  }
}
```

**Returns:**
```json
{
  "name": "Creator Full Name",
  "biography": "...",
  "followers_count": 42000,
  "follows_count": 800,
  "media_count": 320,
  "profile_picture_url": "..."
}
```

### Output shape

```json
[
  {
    "handle": "creatorhandle",
    "recipientId": "12345678",
    "followerCount": 42000,
    "bio": "skincare obsessed | honest reviews",
    "niche": "skincare / beauty",
    "whyFit": "Matches brand tone (minimalist), targets 25-35F beauty audience"
  }
]
```

### Prompt template variables

| Variable | Source |
|---|---|
| `{{$.steps.brand-research.title}}` | Brand name |
| `{{$.steps.brand-research.description}}` | Brand description |
| `{{$.steps.brand-research.targetAudience}}` | Target audience |
| `{{$.steps.brand-research.tone}}` | Brand tone |
| `{{$.steps.meta-ads.ugcAds}}` | UGC-style ads found |
| `{{$.steps.meta-ads.handles}}` | Handles seen in existing ads |

**Mastra agent required:** `ugcResearchAgent`

---

## Step 4 — Send DMs (`agent` — `ugcOutreachAgent`)

AI agent that writes a personalised DM for each creator and sends it via the Instagram Graph API.

### DM format

- Mentions something specific to the creator's content or niche
- Introduces the brand in one sentence
- Pitches the UGC collaboration opportunity
- Ends with a soft CTA (e.g. "Would love to chat if you're interested!")
- Under 300 characters total

### Tool: `send_instagram_dm`

```json
{
  "name": "send_instagram_dm",
  "type": "builtin",
  "builtinId": "send-instagram-dm",
  "inputSchema": {
    "properties": {
      "recipientId": { "type": "string", "description": "Instagram user ID" },
      "message":     { "type": "string", "description": "DM text under 300 chars" }
    }
  }
}
```

**Env required:** `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`

### Prompt template variables

| Variable | Source |
|---|---|
| `{{$.steps.brand-research.title}}` | Brand name |
| `{{$.steps.brand-research.description}}` | Brand description |
| `{{$.steps.brand-research.tone}}` | Brand tone |
| `{{$.steps.find-creators.text}}` | JSON creator array from step 3 |

**Mastra agent required:** `ugcOutreachAgent`

---

## Mastra Agents Required

Register these two agents in your Mastra instance before running the flow:

### `ugcResearchAgent`

```ts
new Agent({
  name: 'ugcResearchAgent',
  model: openai('gpt-4o'),
  instructions: `You are an expert UGC creator sourcing specialist.
You use real Instagram data — hashtag searches and profile lookups — to find creators
who genuinely fit a brand's niche, tone, and target audience.
Never invent handles. Always verify with tools before recommending.`,
})
```

### `ugcOutreachAgent`

```ts
new Agent({
  name: 'ugcOutreachAgent',
  model: openai('gpt-4o'),
  instructions: `You are an expert UGC outreach copywriter.
Write concise, genuine, personalised DMs that feel human — not templated.
Keep messages under 300 characters. Always use send_instagram_dm to actually send each message.`,
})
```

### `outreach-research-agent` (used in brand-research step)

```ts
new Agent({
  name: 'outreach-research-agent',
  model: openai('gpt-4o-mini'),
  instructions: `You are a brand analyst. Extract structured brand identity from website content. Return valid JSON only.`,
})
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Powers all Mastra agents |
| `META_ACCESS_TOKEN` | Yes | Meta Graph API token with `ads_read` permission |
| `INSTAGRAM_ACCESS_TOKEN` | Yes | Instagram Graph API token with `instagram_manage_messages` |
| `INSTAGRAM_USER_ID` | Yes | Your Instagram Business Account user ID |

---

## Seeding the Flow

The canonical flow definition lives at `ugc-flow.json`. Seed it via API:

```bash
# Sign in
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}' | jq -r '.token')

# Create flow
curl -X POST "http://localhost:3000/api/tenants/<tenantId>/flows" \
  -H "Cookie: better-auth.session_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d @ugc-flow.json
```

---

## Running the Flow

1. Open the UI at `http://localhost:3000`
2. Select the **UGC Creator Outreach** flow
3. Set status to `active` (edit flow or via API)
4. Click **Run** — a modal prompts for:
   - `websiteUrl` — e.g. `https://glossier.com`
   - `metaPageId` — e.g. `1234567890`
5. Submit — execution starts in Temporal
6. Monitor progress in Temporal UI at `http://localhost:8080`

---

## Limitations & Notes

- Instagram hashtag scraping is best-effort — Instagram may return minimal data without a logged-in session. A dedicated creator search API (Modash, Phyllo, Heepsy) would be more reliable at scale.
- `instagram-profile` public fallback (`?__a=1`) may be blocked by Instagram; Graph API token is strongly recommended.
- Instagram DM API requires the recipient to have messaged your account first (for non-Business accounts). Ensure your Instagram account has the `instagram_manage_messages` permission granted.
- Rate limits: cap hashtag searches to ~5 per flow run to avoid 429s.
