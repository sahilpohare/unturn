# Architecture

## System overview

```
Browser (React SPA — Blueprint theme)
  │  HTTP Bearer token (sessionStorage)
  ▼
NestJS API (port 3000)
  ├── serves React SPA (static assets)
  ├── better-auth guard (global, resolves Bearer token → session)
  ├── TenantContextMiddleware → AsyncLocalStorage (tenantId from URL param)
  ├── RLS pool → SET LOCAL app.tenant_id
  │
  ├── FlowController     /api/tenants/:tenantId/flows/**
  ├── TenantController   /api/tenants/**
  │     ├── GET /api/tenants/mine          ← maps better-auth org → internal UUID
  │     ├── GET /api/tenants/:id/credentials
  │     └── PATCH /api/tenants/:id/credentials
  ├── ConversationController
  └── MastraModule       /api/mastra/** (chat API)
        │
        └── Temporal Client ──────────────────────────────────────┐
                                                                   │
                                                    Temporal Server (port 7233)
                                                    ├── flow-free queue
                                                    ├── flow-pro queue
                                                    └── flow-enterprise-<tenantId> queue
                                                           │
                                          ┌────────────────┼────────────────┐
                                          │                │                │
                                    worker-free       worker-pro     worker-enterprise
                                    (N pods)          (M pods)       (1 pod/tenant)
                                          │
                                    flowInterpreterWorkflow
                                          │
                                    executeStep activity
                                          │
                                    createStep() registry
                                          │
                              ┌──────────┴──────────┐
                              │                     │
                        AgentStep              BrandResearchStep
                        HttpStep               MetaAdsSearchStep
                        TransformStep          CreatorVetStep
                        ConditionStep          InstagramDmStep
                        DelayStep              TriggerStep
```

## Request lifecycle

1. Browser sends `Authorization: Bearer <token>` (stored in `sessionStorage`)
2. `better-auth` global guard resolves the bearer token → session, attaches user to request
3. `TenantContextMiddleware` reads `:tenantId` (internal UUID) from URL, stores in `AsyncLocalStorage`
4. `RlsPool` intercepts every DB query, calls `SET LOCAL app.tenant_id = '<id>'`
5. PostgreSQL RLS policies filter all rows by `current_setting('app.tenant_id')`
6. `FlowService.findFlow()` additionally queries `WHERE { id, tenantId }` — defence in depth

### Tenant ID resolution (frontend → backend)

better-auth assigns opaque string IDs to organizations (e.g. `5rY4TF1PD6jxJ2DMyXTZx3Qbj5rtDIrY`). The internal `tenants` table uses PostgreSQL UUIDs. The frontend resolves this via:

```
GET /api/tenants/mine
  │  (Bearer token → better-auth session → userId)
  ▼
JOIN "organization" o ON "member".organizationId = o.id
WHERE member.userId = $userId
  │
  ▼
Auto-create tenants rows by slug if missing (handles legacy orgs)
  │
  ▼
Return [{ id: UUID, name, slug }]  ← frontend uses these UUIDs for all subsequent calls
```

## Flow execution lifecycle

```
POST /tenants/:tid/flows/:fid/execute
  │
  ├── findFlow(fid)               — tenant-scoped DB fetch
  ├── tenantRepo.findOne(tid)     — read tier (free/pro/enterprise)
  ├── taskQueueForTenant(tier)    — route to correct Temporal queue
  └── temporal.workflow.start()  — FlowSnapshot passed as immutable input
                                    (no DB reads during execution)
        │
        flowInterpreterWorkflow
          │
          ├── setHandler(contextQuery)     — expose live context via Temporal query
          ├── for each step in order:
          │     ├── delay steps → Temporal sleep() (durable)
          │     └── all others → proxyActivities({ retry: step.retryPolicy })
          │                         .executeStep({ step, context })
          │                               │
          │                         createStep(step)   — factory from registry
          │                         step.execute(context)
          │                               │
          │                         output → context.steps[step.ref]
          │
          └── follow onSuccess / onFailure edges
```

## Agent execution

Agents are not pre-registered. Each `agent` step in the flow JSON defines the full agent at runtime:

```
AgentStepConfig {
  agentName:      string       — label / persona name
  systemPrompt?:  string       — instructions (default: "You are a helpful assistant.")
  promptTemplate: string       — Handlebars template, resolved against FlowContext
  tools:          ToolConfig[] — only these tools are passed to the LLM
}
```

`AgentStep.execute()` calls `new Agent({ instructions: systemPrompt, tools, model })` fresh per execution. Tools are constructed lazily from the step's `tools` array — the full builtin registry is never sent to the LLM.

For the `brand-research` step type, a pre-configured `outreach-research-agent` is used from `mastra-singleton.ts` — the only pre-registered agent.

## Multi-tenancy layers

| Layer | Mechanism | Enforced by |
|-------|-----------|-------------|
| Network | Bearer token + org membership | better-auth guard |
| Tenant resolution | `/api/tenants/mine` maps better-auth org → internal UUID | `TenantService.listForUser()` |
| Application | `TenantContextService.getOrThrow()` | Every service method |
| Database query | `WHERE tenantId = ?` | `FlowService.findFlow()` |
| Database row | RLS policy on `current_setting('app.tenant_id')` | PostgreSQL |
| Temporal | `TenantId` search attribute on every workflow | `FlowService.execute()` |
| Worker | Tier-based task queues | `taskQueueForTenant()` |

## Worker scaling

```
Temporal queue depth (temporal_activity_task_queue_depth)
  │
  └── Prometheus scrapes temporal:9090 every 15s
        │
        └── prometheus-adapter exposes as Kubernetes external metric
              │
              └── HPA: scale when avg depth > 5 per pod
                    │
                    ├── worker-free:  min 1, max 10 replicas
                    ├── worker-pro:   min 2, max 20 replicas
                    └── worker-enterprise-<tid>: min 1, max 5 per tenant
```

Worker concurrency limits per tier:

| Tier | Max concurrent activities | Max activities/sec |
|------|--------------------------|-------------------|
| free | 5 | 2 |
| pro | 20 | 10 |
| enterprise | 50 | 25 |

## Step class hierarchy

```
BaseStep<TConfig>
  ├── assertPublicUrl()     — SSRF guard (shared)
  ├── resolvePath()         — JSONPath traversal of FlowContext
  ├── resolveTemplate()     — Handlebars interpolation
  │
  ├── TriggerStep           — passes input through unchanged
  ├── AgentStep             — constructs Mastra Agent at runtime, calls generate()
  ├── HttpStep              — outbound HTTP with SSRF guard
  ├── TransformStep         — key → JSONPath output mapping
  ├── ConditionStep         — expression → onTrue/onFalse branch
  ├── DelayStep             — no-op (delay handled in workflow via sleep())
  ├── BrandResearchStep     — scrapes website + calls outreach-research-agent
  ├── MetaAdsSearchStep     — Meta Ad Library API + UGC signal extraction
  ├── CreatorVetStep        — Instagram profile fetch + scoring
  └── InstagramDmStep       — Instagram Graph API DM send
```

Each step type owns its config interface in its own file. `step.entity.ts` imports them for the `StepConfig` union type — it contains no interface definitions.

## Flow triggers

A flow may have **one or more** trigger steps. Each trigger defines an entry point:

| Type | Config | Entry mechanism |
|------|--------|-----------------|
| `trigger/manual` | `inputSchema` | POST `/flows/:id/execute` with JSON body |
| `trigger/webhook` | `secret` (optional HMAC) | POST `/flows/:id/webhook` with raw body + `X-Hub-Signature-256` |
| `trigger/schedule` | `cron` | External scheduler calls execute endpoint on cron |

Multiple triggers on the same flow share all downstream steps — the caller supplies the `input` payload; the interpreter is trigger-agnostic.

## UGC Creator Outreach flow

```
trigger/manual
  { websiteUrl, metaPageId }
        │
        ▼
brand-research
  scrape(websiteUrl) → outreach-research-agent
  → { title, description, tone, targetAudience, products, values }
        │
        ▼
meta-ads-search
  Meta Ad Library API → UGC signal detection → handle extraction
  → { ads, ugcAds, handles }
        │
        ▼
agent: find-creators  (ugcResearchAgent persona)
  tools: [search-instagram-creators, instagram-profile]
  prompt: brand profile + UGC ads → discover + filter creators
  → { text: JSON array of top 5 creators with recipientId }
        │
        ▼
agent: send-dms  (ugcOutreachAgent persona)
  tools: [send-instagram-dm]
  prompt: brand + creator bios → personalised DM per creator
  → { text, toolCalls: [send_instagram_dm × N] }
```

The same flow JSON produces different creator targets and DM copy for every brand because `tone`, `targetAudience`, and creator bios flow through `context.steps` as data — the workflow graph is identical, the content is not.

## Directory structure

```
src/
  app.module.ts                    — root module, middleware config
  main.ts                          — bootstrap, static serving, Swagger
  flow/
    flow.entity.ts                 — FlowEntity (TypeORM)
    flow.service.ts                — CRUD + execution + tenant/queue routing
    flow.controller.ts             — REST endpoints
    flow.constants.ts              — tier queues, concurrency limits
    flow.types.ts                  — FlowContext, FlowSnapshot, activity I/O types
    step.entity.ts                 — StepEntity + StepType union (imports configs from steps/)
    steps/
      base.step.ts                 — BaseStep<T> + assertPublicUrl
      agent.step.ts                — AgentStep + ToolConfig + AgentStepConfig
      http.step.ts                 — HttpStep + HttpStepConfig
      trigger.step.ts              — TriggerStep + trigger config interfaces
      transform.step.ts            — TransformStep + TransformStepConfig
      condition.step.ts            — ConditionStep + ConditionStepConfig
      delay.step.ts                — DelayStep + DelayStepConfig
      brand-research.step.ts       — BrandResearchStep + BrandResearchConfig
      meta-ads-search.step.ts      — MetaAdsSearchStep + MetaAdsSearchConfig
      creator-vet.step.ts          — CreatorVetStep + CreatorVetConfig
      instagram-dm.step.ts         — InstagramDmStep + InstagramDmConfig
      index.ts                     — createStep() factory + step registry
  temporal/
    temporal.service.ts            — client-only (no workers in API process)
    temporal.module.ts
    worker.ts                      — standalone worker entry point (TASK_QUEUE env)
    workflows/
      flow-interpreter.workflow.ts — main durable workflow loop
    activities/
      flow.activities.ts           — executeStep() — 5 lines
      mastra-singleton.ts          — minimal Mastra instance for BrandResearchStep
  platform/
    auth/                          — better-auth instance + NestJS module
    rls/                           — RlsPool, TenantContextService, middleware
    tenant/                        — TenantEntity (with tier column), TenantService
    user/
  mastra/
    mastra-infra.module.ts         — NestJS DI Mastra instance (chat API, PostgresStore memory)
    mastra.tokens.ts               — DI tokens
  conversation/                    — thread + message CRUD for chat API
frontend/
  src/
    App.tsx                        — root, auth gate, flow/step selection state
    Sidebar.tsx                    — flow list, run modal, step inspector
    FlowCanvas.tsx                 — ReactFlow canvas
    AddStepPanel.tsx               — step create/edit modal
    ToolEditor.tsx                 — tool list editor for agent steps
    api.ts                         — typed fetch wrappers
    types.ts                       — Flow, Step frontend types
docs/
  architecture.md                  — this file
  ugc-creator-outreach.md          — UGC flow specification
  adr/                             — architecture decision records (ADR-0001 → ADR-0011)
k8s/
  worker-free.yaml                 — Deployment + HPA for free tier
  worker-pro.yaml                  — Deployment + HPA for pro tier
  worker-enterprise-template.yaml  — envsubst template for per-tenant enterprise workers
observability/
  prometheus.yml                   — scrape config (temporal:9090)
  grafana/provisioning/            — auto-provisioned datasource + queue depth dashboard
```
