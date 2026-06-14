# Unturn

AI-powered workflow automation platform for marketing and outreach teams. Build, visualise, and execute multi-step agentic flows — no code required.

## Docs

- [Architecture](docs/architecture.md)
- [UGC Creator Outreach](docs/ugc-creator-outreach.md)
- [Architecture Decision Records](docs/adr/README.md)
- [API docs](http://localhost:3000/api/docs) (Swagger, running instance)

## Stack

| Layer | Technology |
|-------|-----------|
| API | NestJS + TypeORM + PostgreSQL |
| Auth | better-auth — email/password, organisations as tenants |
| Workflow engine | Temporal — durable, retryable step execution |
| AI agents | Mastra — tool-calling agents constructed at runtime from flow JSON |
| Frontend | React + ReactFlow — visual flow editor, served from NestJS |
| Observability | Prometheus + Grafana — queue depth, latency, failure rate |

---

## Technical Test — Fashion E-Commerce Agent Engine

### Architecture

Agents, skills, and tools are defined as **metadata configurations** in `data/agents.json` and `data/stores.json` — mocked representations of a production DB. The Temporal workflow (`flowInterpreterWorkflow`) is a **generic execution engine** that reads these configs and runs them without hardcoded logic.

```
data/agents.json          ← agent + skill + tool definitions (mock DB)
data/stores.json          ← store metadata + per-agent run inputs (mock DB)
scripts/run-agent.ts      ← standalone runner (no NestJS)
src/temporal/worker.ts    ← generic Temporal worker
src/temporal/workflows/   ← flowInterpreterWorkflow (reads config, never hardcoded)
src/flow/steps/           ← step implementations (agent, brand-research, http, etc.)
```

### The Two Agents

#### Agent 1: UGC Creator Outreach (`ugc-creator-outreach`)

**Skills:** brand-intelligence → creator-discovery → personalised-outreach

```
trigger/manual
  { websiteUrl, niche }
       │
brand-research          ← scrapes site → outreach-research-agent → brand profile JSON
       │
agent: ugcResearchAgent ← tools: search-instagram-creators, instagram-profile
  → discovers + vets top 5 creators matching brand aesthetic
       │
agent: ugcOutreachAgent ← tool: send-instagram-dm
  → sends personalised DMs matching brand tone (luxury vs streetwear = different copy)
```

#### Agent 2: Trend-to-Copy Generator (`trend-to-copy`)

**Skills:** brand-intelligence → trend-research → copy-generation

```
trigger/manual
  { websiteUrl, trendUrl, productName, productCategory }
       │
brand-research          ← scrapes brand site → voice/tone/audience profile
       │
agent: trendResearchAgent ← tool: scrape-url
  → scrapes trendUrl (Vogue runway / Highsnobiety) → structured trend signals
       │
agent: copywriterAgent  ← no tools (pure generation)
  → product description + Instagram caption + email subject line
  → reasoning paragraph explaining brand-fit choices
```

### The Two Stores

| Store | Identity |
|-------|----------|
| **Jacquemus** | High-end minimalist French luxury. Mediterranean aesthetic, architectural silhouettes. Aspirational, emotionally warm. |
| **Palace Skateboards** | London streetwear. Irreverent, deliberately ugly-funny. Deep UK skate culture. Anti-hype hype brand. |

These two stores produce **entirely different outputs** from the same agent configs — same workflow graph, different LLM tone/content — because brand voice, target audience, and aesthetic flow through `context.steps` as data.

### Running the 4 Demos

#### Prerequisites

```bash
# Terminal 1 — Temporal (requires Docker)
docker run --rm -p 7233:7233 -p 8080:8080 temporalio/auto-setup:latest

# Terminal 2 — Generic worker
TASK_QUEUE=flow-free npm run worker
```

#### The 4 Runs

```bash
# Run 1: UGC Creator Outreach — Jacquemus (luxury)
OPENAI_API_KEY=sk-... npm run run-agent -- --agent ugc-creator-outreach --store jacquemus

# Run 2: UGC Creator Outreach — Palace Skateboards (streetwear)
OPENAI_API_KEY=sk-... npm run run-agent -- --agent ugc-creator-outreach --store palace-skateboards

# Run 3: Trend-to-Copy — Jacquemus
OPENAI_API_KEY=sk-... npm run run-agent -- --agent trend-to-copy --store jacquemus

# Run 4: Trend-to-Copy — Palace Skateboards
OPENAI_API_KEY=sk-... npm run run-agent -- --agent trend-to-copy --store palace-skateboards
```

Each run prints step-by-step output to stdout and shows the Temporal UI URL for the workflow. All 4 workflows run through the same generic `flowInterpreterWorkflow` — zero agent-specific code in the worker.

**Temporal UI:** http://localhost:8080

---

## Quick start (full platform)

```bash
# Full stack (API + workers + postgres + temporal + prometheus + grafana)
docker compose up --build

# Or run locally
npm install
cp .env.example .env   # fill in secrets

# Terminal 1 — API
npm run start:dev

# Terminal 2 — free tier worker
TASK_QUEUE=flow-free npm run worker

# Terminal 3 — pro tier worker (optional)
TASK_QUEUE=flow-pro npm run worker

# Build frontend
cd frontend && npm run build
```

**Ports:**

| Service | URL |
|---------|-----|
| API + Frontend | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| Temporal UI | http://localhost:8080 |
| Grafana | http://localhost:3001 (admin/admin) |
| Prometheus | http://localhost:9091 |

## Environment variables

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestdb
BETTER_AUTH_SECRET=...
OPENAI_API_KEY=...
OPENAI_MODEL=openai/gpt-4o-mini        # optional, default gpt-4o-mini
META_ACCESS_TOKEN=...                   # Meta Ad Library API
INSTAGRAM_ACCESS_TOKEN=...              # Instagram Graph API
INSTAGRAM_USER_ID=...                   # Instagram Business Account ID
TEMPORAL_ADDRESS=localhost:7233         # optional
TEMPORAL_NAMESPACE=default              # optional
```

## Scaling workers

Workers are independent processes. Scale per tier by running more instances:

```bash
# Docker Compose
docker compose up --scale worker-free=4 --scale worker-pro=8

# Kubernetes — HPA driven by Temporal queue depth (see k8s/)
kubectl apply -f k8s/worker-free.yaml
kubectl apply -f k8s/worker-pro.yaml

# Enterprise tenant — dedicated isolated worker
TENANT_ID=acme-corp envsubst < k8s/worker-enterprise-template.yaml | kubectl apply -f -
```

See [ADR-0007](docs/adr/0007-tier-based-worker-isolation.md) and [ADR-0008](docs/adr/0008-worker-process-separation.md) for rationale.

---

## Functional Requirements

### Flow Builder
- Create, update, and delete automation flows scoped to a tenant
- Visual drag-and-drop canvas (ReactFlow) to arrange and connect steps
- Connect steps via success/failure edges; edges persist on explicit save
- Double-click a node to edit its configuration in a side panel
- Support step types: `trigger/manual`, `trigger/webhook`, `trigger/schedule`, `agent`, `http`, `transform`, `condition`, `delay`, `brand-research`, `meta-ads-search`, `creator-vet`, `instagram-dm`

### Step Configuration
- Each step has a ref (stable ID), type, name, position, config (JSONB), retry policy, and edge routing (`onSuccess`, `onFailure`)
- Agent steps: `agentName`, `systemPrompt`, `promptTemplate` (Handlebars `{{$.steps.<ref>.<field>}}`), `tools[]`, `threadIdPath`, `resourceIdPath`
- Agent and tools constructed at runtime from flow JSON — no pre-registration required
- Variable injection in prompt templates from `$.input.*`, `$.steps.<ref>.*`, `$.tenantId`
- Tools configurable as HTTP endpoints or registered builtins; only tools listed in the step config are passed to the LLM

### Execution
- Execute a flow with typed input args defined by the trigger's `inputSchema`
- Run modal surfaces trigger input fields dynamically before execution
- Each step runs as a Temporal activity with its own retry policy (`maximumAttempts`, `initialInterval`)
- Flow context (`$.steps.*`) accumulates outputs across steps for downstream interpolation
- Tenant routed to correct task queue based on tier (`free → flow-free`, `pro → flow-pro`, `enterprise → flow-enterprise-<tenantId>`)

### Auth & Multi-tenancy
- Email/password sign-up and sign-in via better-auth
- Organisations as tenants — flows, steps, threads, and messages all scoped to tenant
- Row-level security at DB layer via `SET LOCAL app.tenant_id` + RLS policies
- `findFlow()` also queries `WHERE { id, tenantId }` as defence-in-depth

### Builtin Tools
- `scrape-url` — fetch and strip HTML from any public URL
- `meta-ad-library` — query Meta Ad Library for ads by Facebook page ID
- `instagram-profile` — fetch Instagram profile (Graph API with public fallback)
- `search-instagram-creators` — scrape Instagram hashtag pages to discover creator handles
- `send-instagram-dm` — send DM via Instagram Graph API

### UGC Creator Outreach Flow
- End-to-end automated flow: brand research → Meta ad analysis → hashtag creator discovery → profile vetting → personalised DM
- Same flow JSON produces different results per brand — tone, audience, and creators adapt via context injection
- See [docs/ugc-creator-outreach.md](docs/ugc-creator-outreach.md)

---

## Non-Functional Requirements

### Reliability
- Temporal workflows survive worker restarts — in-flight activities are retried automatically
- Per-step retry policy stored in flow JSON and applied at execution time
- Failed steps route to `onFailure` ref if configured; otherwise workflow fails gracefully with error in output
- Delay steps use Temporal `sleep()` — durable, not a `setTimeout`

### Scalability
- API process is stateless and client-only with respect to Temporal — no workers in-process
- Workers scale independently per tier; free worker scaling does not affect pro or enterprise
- HPA driven by `temporal_activity_task_queue_depth` — scales on actual backlog, not CPU
- Enterprise tenants get dedicated queue + worker pod — zero noisy neighbour risk

### Security
- All tenant-scoped routes behind better-auth global guard
- Tenant context enforced via middleware + DB WHERE clause + RLS — three independent layers
- SSRF guard on all outbound HTTP steps — blocks private IPs, loopback, link-local, non-http schemes
- API tokens always from env vars — never stored in flow config or DB

### Observability
- Temporal UI: full execution history, step timings, retry logs
- Prometheus: `temporal_activity_task_queue_depth`, schedule-to-start p99, failure rate per queue
- Grafana: auto-provisioned queue depth dashboard at startup
- Swagger: all REST endpoints documented at `/api/docs`

### Developer Experience
- Single port (3000) serves both API and frontend SPA
- Hot reload in development (`nest start --watch`)
- Flow definitions as portable JSON (`ugc-flow.json`) — seedable, version-controllable
- `docker compose up` starts the complete stack including observability
