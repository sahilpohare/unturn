# ADR-0002: Use Mastra for AI agent execution

**Status:** Accepted
**Date:** 2025-01-01

## Context

Flows need to run LLM-backed agents with persistent memory (conversation threads per tenant), tool calling (builtin tools like scrape-url, Meta Ad Library, Instagram), and structured output. We need a framework that handles agent lifecycle, memory storage, and tool schemas.

## Decision

Use [Mastra](https://mastra.ai) for agent definitions and execution. Agents are declared in `src/temporal/activities/mastra-singleton.ts` and used by step classes (`AgentStep`, `BrandResearchStep`) via `mastraInstance.getAgent(id)`.

A second Mastra instance exists inside NestJS DI (`MastraInfraModule`) for the REST chat API with PostgreSQL-backed memory. These two instances are intentionally separate: Temporal activities cannot depend on the NestJS container lifecycle.

Registered agents:
- `outreach-research-agent` — brand identity extraction from website content
- `ugc-research-agent` — Instagram creator discovery
- `ugc-outreach-agent` — personalised DM copy generation
- `example-agent` — general assistant

## Consequences

- **Good:** Mastra handles tool schema generation, LLM provider abstraction, and memory persistence.
- **Good:** Agents are composable inside flows via `AgentStep` config (`agentName`, `promptTemplate`, `tools`).
- **Bad:** Two Mastra instances must be kept in sync if agents are added. Adding a new agent requires updating `mastra-singleton.ts`.
- **Tradeoff:** No shared memory between the Temporal-side agents and the NestJS-side chat API. Accepted because flow executions are stateless pipelines, not interactive sessions.
