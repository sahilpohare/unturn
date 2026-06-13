# Architecture Decision Records

This directory contains ADRs for the Unturn platform. Each ADR documents a significant architectural decision, its context, and its consequences.

| # | Title | Status |
|---|-------|--------|
| [0001](./0001-temporal-for-durable-execution.md) | Use Temporal for durable workflow execution | Accepted |
| [0002](./0002-mastra-for-ai-agents.md) | Use Mastra for AI agent execution | Accepted |
| [0003](./0003-multi-tenant-rls.md) | Multi-tenancy via PostgreSQL Row-Level Security | Accepted |
| [0004](./0004-step-class-hierarchy.md) | Step class hierarchy for flow execution | Accepted |
| [0005](./0005-retry-policy-per-step.md) | Per-step retry policy defined in flow JSON | Accepted |
| [0006](./0006-ssrf-protection.md) | SSRF protection on outbound HTTP steps | Accepted |
| [0007](./0007-tier-based-worker-isolation.md) | Tier-based worker isolation for noisy neighbour prevention | Accepted |
| [0008](./0008-worker-process-separation.md) | Workers as separate processes, API as client-only | Accepted |
| [0009](./0009-queue-depth-autoscaling.md) | Queue-depth-driven autoscaling via Prometheus + Kubernetes HPA | Accepted |
| [0010](./0010-tenant-id-mapping.md) | Tenant ID mapping between better-auth and internal PostgreSQL UUIDs | Accepted |
| [0011](./0011-multi-trigger-flows.md) | Multiple trigger steps per flow | Accepted |

## Format

Each ADR follows the structure: **Context** → **Decision** → **Consequences**.

New ADRs should be added with the next sequential number.
