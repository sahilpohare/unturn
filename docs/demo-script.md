# Unturn — Demo Video Script

**Format:** Screen recording with voiceover
**Length:** ~8–10 minutes
**Audience:** Technical stakeholders, potential users, engineering interviewers

---

## INTRO [0:00 – 0:30]

*[Screen: project repo or a blank terminal]*

> "This is Unturn — an AI-powered workflow automation platform built for marketing and outreach teams.
>
> The core idea: you describe a multi-step process as a visual flow, define what each step does in JSON, and the platform executes it durably — with retries, branching logic, and live AI agents — without you writing a single line of orchestration code.
>
> I'll walk you through the architecture, then show it running end-to-end with a real brand."

---

## PART 1 — ARCHITECTURE [0:30 – 2:30]

*[Screen: `docs/architecture.md` or draw on the diagram]*

> "Let's start with how it's built."

### The Stack

> "The API is NestJS on Node, serving a React frontend on the same port. Authentication is better-auth — email/password, with organisations as multi-tenant workspaces.
>
> Every API route is scoped to a tenant. The tenant ID comes from the URL param, gets stored in AsyncLocalStorage by middleware, and is enforced at three independent layers — application WHERE clause, PostgreSQL RLS policies, and the auth guard. You can't read another tenant's data even if you craft a malicious request."

*[Screen: `src/platform/rls/` or the multi-tenancy table in architecture.md]*

### The Execution Engine

> "Workflow execution is Temporal. When you trigger a flow, the API starts a `flowInterpreterWorkflow` — a durable Temporal workflow that loops through the flow's steps in graph order. Each step runs as a Temporal activity with its own retry policy.
>
> If the worker crashes mid-execution, Temporal replays from exactly where it left off. No lost work. No zombie jobs.
>
> Workers are separate processes — the API never runs activities in-process. And they're tier-isolated: free users share a queue, pro users get their own, enterprise tenants get a dedicated worker pod. Noisy neighbours don't exist."

*[Screen: docker-compose.yml showing worker-free, worker-pro services]*

### The Agent Model

> "AI agents are not pre-registered. Every `agent` step in the flow JSON defines its own persona, system prompt, and tools at runtime. When the step executes, Mastra constructs the agent fresh — model, instructions, tool list — from the config. The worker has zero knowledge of what agent it's running until execution time.
>
> This means you can build any agent by editing JSON. No deploys, no code changes."

*[Screen: `AddStepPanel.tsx` agent form, or the agent step config in the DB]*

---

## PART 2 — THE PRODUCT [2:30 – 5:00]

*[Screen: browser at `http://localhost:3000`]*

### Login + Workspace

> "The frontend is a Blueprint-themed visual editor. Let me log in."

*[Action: sign in]*

> "Once in, the app auto-resolves my workspace — the internal tenant UUID — and loads my flows. The sidebar shows all flows for this workspace."

### Flow Canvas

> "This is the UGC Creator Outreach flow. Five steps connected by edges."

*[Action: click the flow, let ReactFlow render]*

> "Brand Research scrapes the website and extracts a structured brand profile. Meta Ads Search queries the Ad Library for UGC-style ads. Two AI agent steps — one to discover and vet creators, one to write and send personalised DMs. And a manual trigger at the top.
>
> The arrows aren't just visual. Each step's `onSuccess` ref is stored in the DB and drives execution order in Temporal — the workflow follows the graph, not a hardcoded sequence."

### Editing a Step

> "Let me open the AI agent step."

*[Action: double-click the find-creators node]*

> "This is the step editor. You can see the agent name, system prompt, prompt template with variable injection — those double-brace expressions pull from prior step outputs in the flow context — and the tool list.
>
> Tools can be builtins like `search-instagram-creators`, which scrapes Instagram hashtag pages, or custom HTTP endpoints. Only tools listed here are passed to the LLM. The worker never sends the full builtin catalogue."

*[Action: close panel]*

### Adding a Step

> "Adding a step is a palette pick and a form fill. No code."

*[Action: click Add Step, pick HTTP, fill in URL, close]*

> "The step is appended to the existing graph. Flows support multiple triggers — manual, webhook, and schedule — all sharing the same downstream steps."

---

## PART 3 — RUNNING THE FLOW [5:00 – 7:30]

*[Screen: Sidebar with selected flow]*

### Trigger

> "Let me run this against Nike's IE website."

*[Action: click Run → run modal opens]*

> "The run modal surfaces input fields dynamically from the trigger's input schema. I'm passing the Nike URL."

*[Action: type `https://www.nike.com/ie/`, click Execute]*

> "That POST hit `/api/tenants/<uuid>/flows/<id>/execute`. The API loaded the flow, snapshotted all steps, routed to the free-tier Temporal queue, and started the workflow. Execution is now entirely in Temporal — the API is done."

### Temporal UI

*[Screen: switch to `http://localhost:8080`]*

> "Here's the Temporal UI. I can see the workflow running in real time. Each row is a Temporal activity — one per flow step. You can see Brand Research completed, Meta Ads Search running.
>
> If I click in, I get the full execution history: input args, output, timing, retry count. This is not application logging — this is Temporal's built-in durability log. If the worker had crashed between these two activities, the workflow would have resumed here automatically on restart."

*[Action: click into a completed activity, show input/output]*

> "The brand research output — title, tone, target audience, product descriptions — is now in the flow context. The next step's prompt template resolves `{{$.steps.brand-research.title}}` against this object at runtime."

### Results

*[Screen: back to terminal or Temporal UI, show completed workflow]*

> "Workflow complete. Five steps, all green. The AI identified creators matching Nike's aesthetic and sent personalised DMs — tone, copy, and creator selection all driven by the brand profile extracted in step one.
>
> Same flow JSON, different brand, entirely different output. That's the point."

---

## PART 4 — TECHNICALS DEEP DIVE [7:30 – 9:00]

*[Screen: jump around code as relevant]*

### Why Temporal

> "Temporal solves the hardest problem in agent orchestration: durability. HTTP requests time out. Servers crash. LLM calls take 30 seconds. Without Temporal, you'd write retry logic, dead letter queues, state checkpoints. With Temporal, you write a loop and call activities. The framework handles the rest."

*[Screen: `src/temporal/workflows/flow-interpreter.workflow.ts`]*

> "The workflow is about 60 lines. It loops through steps, checks for delays — which use Temporal sleep, not setTimeout, so they survive restarts — and calls `executeStep` as an activity with the step's retry policy. No hardcoded step logic here."

### Why No Pre-registered Agents

> "Traditional agent platforms require you to register agents before you can use them. Here, the agent definition is data in the flow step config. The worker receives a `FlowStepSnapshot` — a serialisable object — and calls `createStep(snapshot).execute(context)`. The step class constructs the Mastra agent from the config fields. Zero coupling between the worker and the agent's purpose."

*[Screen: `src/flow/steps/agent.step.ts` — the constructor]*

### The Multi-tenant UUID Fix

> "One interesting engineering problem we solved: better-auth uses its own opaque IDs for organisations. Our `tenants` table uses PostgreSQL UUIDs. The frontend was sending better-auth org IDs as URL params, which crashed TypeORM with a UUID parse error.
>
> The fix: `GET /api/tenants/mine` joins the better-auth `organization` and `member` tables — same Postgres DB — to find which orgs the user belongs to, then maps slugs to internal UUIDs. Auto-creates tenant rows for legacy orgs. The frontend now only ever sees real UUIDs."

*[Screen: `src/platform/tenant/tenant.service.ts` — `listForUser`]*

### Observability

*[Screen: Grafana at `http://localhost:3001`]*

> "Prometheus scrapes Temporal's metrics endpoint every 15 seconds. Grafana auto-provisions a queue depth dashboard — this drives Kubernetes HPA in production. When the free queue depth exceeds five tasks per pod, more worker replicas spin up. Scale-down happens automatically when the queue drains."

---

## OUTRO [9:00 – 9:30]

> "To summarise:
>
> — Durable agentic workflows via Temporal — survives crashes, retries automatically
> — Agents defined as data, not code — build any persona without deploying
> — Visual flow editor — non-technical teams can build and modify flows
> — Three-layer multi-tenancy — auth guard, application query, PostgreSQL RLS
> — Tier-isolated workers — free and pro users never contend for capacity
> — Full observability — Temporal UI for execution history, Grafana for queue metrics
>
> The walkthrough script at `scripts/walkthrough.sh` runs this entire demo automatically — sign up, seed the flow, execute against any brand URL, and print the results — in a single command.
>
> Questions welcome."

---

## SCREEN SEQUENCE REFERENCE

| Timestamp | Screen | Action |
|-----------|--------|--------|
| 0:00 | Terminal / repo | Intro |
| 0:30 | `docs/architecture.md` | Architecture diagram walkthrough |
| 1:15 | `docker-compose.yml` | Worker tiers |
| 2:00 | `src/flow/steps/agent.step.ts` | Agent model |
| 2:30 | `http://localhost:3000` | Login |
| 3:00 | Flow canvas | ReactFlow graph |
| 3:30 | Step editor (double-click node) | Agent config, prompt template |
| 4:30 | Add Step panel | Adding an HTTP step |
| 5:00 | Run modal | Trigger with Nike URL |
| 5:30 | `http://localhost:8080` | Temporal UI, live activities |
| 6:15 | Activity detail | Input/output, retry count |
| 7:00 | Completed workflow | Results summary |
| 7:30 | `flow-interpreter.workflow.ts` | 60-line workflow loop |
| 8:00 | `agent.step.ts` | Runtime agent construction |
| 8:20 | `tenant.service.ts` | UUID mapping fix |
| 8:40 | `http://localhost:3001` | Grafana queue depth |
| 9:00 | Terminal | Outro |

---

## PREP CHECKLIST

- [ ] `docker compose up` — postgres, temporal, api, worker-free all healthy
- [ ] Frontend built: `cd frontend && npm run build`
- [ ] `.env` has `OPENAI_API_KEY` set
- [ ] UGC flow exists in the DB (or run `./scripts/walkthrough.sh` first to seed it)
- [ ] Temporal UI clean — terminate any stuck workflows: `temporal workflow list` → `temporal workflow terminate --workflow-id <id>`
- [ ] Browser tabs open: `localhost:3000`, `localhost:8080`, `localhost:3001`
- [ ] Terminal font size increased for recording
- [ ] Screen recording software ready (1080p minimum)
