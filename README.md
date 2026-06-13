# Unturn

AI-powered workflow automation platform for marketing and outreach teams. Build, visualise, and execute multi-step agentic flows — no code required.

## Stack

- **Backend:** NestJS + TypeORM + PostgreSQL
- **Auth:** better-auth (email/password, organisations as tenants)
- **Workflow engine:** Temporal (durable, retryable step execution)
- **AI agents:** Mastra (tool-calling agents backed by OpenAI)
- **Frontend:** React + ReactFlow (visual flow editor, served from NestJS)
- **API docs:** Swagger at `/api/docs`

## Quick start

```bash
# Install
bun install

# Start postgres + temporal (docker)
docker compose up -d

# Run backend (watch mode)
bun run start:dev

# Build frontend
cd frontend && npm run build
```

Environment variables — copy `.env.example` to `.env` and fill in:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestdb
BETTER_AUTH_SECRET=...
OPENAI_API_KEY=...
META_ACCESS_TOKEN=...         # Meta Ad Library API
INSTAGRAM_ACCESS_TOKEN=...    # Instagram Graph API
INSTAGRAM_USER_ID=...         # Instagram Business Account ID
```

---

## Functional Requirements

### Flow Builder
- Create, update, and delete automation flows scoped to a tenant
- Visual drag-and-drop canvas (ReactFlow) to arrange and connect steps
- Connect steps via success/failure edges; edges persist on explicit save
- Double-click a node to edit its configuration in a side panel
- Support step types: `trigger/manual`, `trigger/webhook`, `trigger/schedule`, `agent`, `http`, `transform`, `condition`, `delay`, `brand-research`, `meta-ads-search`, `creator-vet`, `instagram-dm`

### Step Configuration
- Each step has a ref (stable ID), type, name, position, config (JSONB), and edge routing (`onSuccess`, `onFailure`)
- Agent steps support: `agentName`, `promptTemplate` (Handlebars `{{$.steps.<ref>.<field>}}`), `tools[]`, `threadIdPath`, `resourceIdPath`
- Variable injection in prompt templates from `$.input.*`, `$.steps.<ref>.*`, `$.tenantId`
- Tools are configurable as HTTP endpoints or registered builtins

### Execution
- Execute a flow with typed input args defined by the trigger's `inputSchema`
- Run modal surfaces trigger input fields dynamically before execution
- Execution runs as a Temporal workflow; each step is a durable activity with configurable retry policy
- Flow context (`$.steps.*`) accumulates outputs across steps and is available for Handlebars interpolation in downstream steps
- Query live workflow context via Temporal query API

### Auth & Multi-tenancy
- Email/password sign-up and sign-in via better-auth
- Organisations as tenants — each flow, thread, and message is scoped to a tenant
- Row-level security enforced at DB layer via RLS pool
- Session tokens passed as cookies

### Builtin Tools
- `scrape-url` — fetch and clean HTML from any URL
- `meta-ad-library` — query Meta Ad Library for ads by page ID
- `instagram-profile` — fetch Instagram profile (Graph API or public fallback)
- `search-instagram-creators` — scrape Instagram hashtag pages to discover real creator handles
- `send-instagram-dm` — send DM via Instagram Graph API

### UGC Creator Outreach Flow
- End-to-end automated flow: brand research → Meta ad analysis → hashtag-based creator discovery → profile vetting → personalised DM
- See [docs/ugc-creator-outreach.md](docs/ugc-creator-outreach.md) for full specification

---

## Non-Functional Requirements

### Reliability
- All step executions run inside Temporal workflows — automatically retried on failure up to `retryPolicy.maximumAttempts`
- Delay steps use Temporal `sleep()` — durable across worker restarts
- Failed steps route to `onFailure` step if configured, otherwise fail the workflow gracefully with error captured in output

### Scalability
- Stateless NestJS API — horizontally scalable behind a load balancer
- Temporal workers scale independently from the API
- Tenant isolation via RLS ensures DB queries never cross tenant boundaries

### Security
- All tenant-scoped API routes require an authenticated session (better-auth global guard)
- Tenant context validated on every request via middleware; mismatched tenant throws `403`
- Secrets (API tokens) stored as environment variables, never in flow config
- `INSTAGRAM_ACCESS_TOKEN` and `META_ACCESS_TOKEN` injected at activity runtime only

### Performance
- Frontend served as static assets from NestJS — no separate CDN needed in development
- Flow steps execute in parallel where the workflow graph allows
- Instagram hashtag scraping caps at 30 handles per search to avoid rate limiting

### Observability
- Temporal UI provides full execution history, step timings, and retry logs
- Live workflow context queryable via `getContext` Temporal query during execution
- Swagger at `/api/docs` documents all REST endpoints

### Developer Experience
- Single port (3000) serves both API and frontend SPA
- Hot reload in development (`nest start --watch`)
- Flow definitions exportable as JSON (`ugc-flow.json`) for seeding or version control
- Swagger auto-generated from NestJS decorators
