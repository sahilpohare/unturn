# UGC Creator Outreach Agent

## Overview

Automated end-to-end pipeline that identifies a brand's identity, finds relevant Instagram UGC creators, and reaches out to them via DM — all triggered with a single flow execution.

## Flow: UGC Creator Outreach

**Trigger inputs:**
- `websiteUrl` — Brand website URL (e.g. `https://brand.com`)
- `metaPageId` — Facebook Page ID of the brand

### Steps

#### 1. Start Outreach (`trigger/manual`)
Manual trigger that accepts `websiteUrl` and `metaPageId` as inputs. These values flow through the entire pipeline via `$.input.*` references.

#### 2. Research Brand (`brand-research`)
Scrapes the brand website (homepage + `/about` + `/products`) and extracts clean text content. Strips scripts, styles, and HTML tags, returning up to 6000 chars of readable content.

- Input: `$.input.websiteUrl`
- Output: `{ url, text }`

#### 3. Find Meta Ads (`meta-ads-search`)
Queries the Meta Ad Library API for active ads running on the brand's Facebook Page. Returns ad creative bodies, publisher platforms, and delivery info.

- Input: `$.input.metaPageId`
- Output: Meta Graph API `ads_archive` response
- Env required: `META_ACCESS_TOKEN`

#### 4. Find Instagram Creators (`agent` — `ugcResearchAgent`)
AI agent that analyses the brand website content and Meta ad creatives to identify 5 Instagram creators who would be a strong UGC fit. Uses the `instagram_profile` builtin tool to verify each creator's follower count and niche before returning them.

**Prompt context injected:**
- `{{$.steps.brand-research.text}}` — scraped brand content
- `{{$.steps.meta-ads.data}}` — Meta ad creatives

**Output:** JSON array of creators with `handle`, `recipientId`, `followerCount`, `niche`

#### 5. Send DMs to Creators (`agent` — `ugcOutreachAgent`)
AI agent that writes and sends a personalised Instagram DM to each creator. Each message introduces the brand, explains the UGC collaboration opportunity, and asks if they are interested. Messages are kept under 300 characters.

**Prompt context injected:**
- `{{$.steps.brand-research.text}}` — brand identity
- `{{$.steps.find-creators.text}}` — creator list from step 4

**Tool used:** `send-instagram-dm` builtin
- Env required: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`

## Required Environment Variables

| Variable | Description |
|---|---|
| `META_ACCESS_TOKEN` | Meta Graph API token with `ads_read` permission |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram Graph API token with `instagram_manage_messages` |
| `INSTAGRAM_USER_ID` | Instagram Business Account user ID |
| `OPENAI_API_KEY` | Used by Mastra agents (`ugcResearchAgent`, `ugcOutreachAgent`) |

## Agents Required in Mastra

Two agents must be registered in the Mastra instance:

- **`ugcResearchAgent`** — Creator discovery. Should use a model with strong reasoning (e.g. `gpt-4o`). System prompt: expert UGC sourcing specialist.
- **`ugcOutreachAgent`** — DM writing and sending. System prompt: expert UGC outreach copywriter. Concise, brand-aligned messaging.

## Data Flow

```
$.input.websiteUrl / $.input.metaPageId
        |
  [brand-research] → $.steps.brand-research.text
        |
  [meta-ads]       → $.steps.meta-ads.data
        |
  [find-creators]  → $.steps.find-creators.text (JSON creator array)
        |
  [send-dms]       → DMs sent via Instagram API
```
