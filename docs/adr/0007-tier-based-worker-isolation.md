# ADR-0007: Tier-based worker isolation for noisy neighbour prevention

**Status:** Accepted
**Date:** 2025-01-01

## Context

All tenants shared a single Temporal task queue (`flow-engine`) and a single worker pool running inside the API process. A free tenant executing 50 concurrent flows would exhaust the worker's `maxConcurrentActivityTaskExecutions`, starving pro and enterprise tenants. No mechanism existed to enforce per-tenant or per-tier execution limits.

At 1000+ tenants the in-process worker model also hits a hard ceiling: you cannot hold 1000 NativeConnections and worker event loops in a single Node.js process without OOM.

## Decision

Three changes together form the isolation boundary:

**1. Tier-based task queues**

Each tenant is assigned a tier (`free | pro | enterprise`). `FlowService.execute()` reads the tenant's tier and routes to the corresponding Temporal task queue:

| Tier | Queue | Notes |
|------|-------|-------|
| free | `flow-free` | Shared, low concurrency |
| pro | `flow-pro` | Shared, higher concurrency |
| enterprise | `flow-enterprise-<tenantId>` | Dedicated per tenant |

Free and pro tenants share a queue within their tier — they are isolated from other tiers but not from each other within the tier. Enterprise tenants get a fully dedicated queue and worker.

**2. Workers as separate processes**

`TemporalService` in the API process is client-only. No workers run in-process. Workers are a separate binary (`src/temporal/worker.ts`) that reads `TASK_QUEUE` from env and starts a single worker with tier-appropriate concurrency limits:

| Tier | `maxConcurrentActivities` | `maxActivitiesPerSecond` |
|------|--------------------------|--------------------------|
| free | 5 | 2 |
| pro | 20 | 10 |
| enterprise | 50 | 25 |

This means the API process memory footprint is fixed regardless of tenant count. Worker pods scale independently.

**3. Queue-depth-driven autoscaling**

Temporal exposes `temporal_activity_task_queue_depth` per queue via Prometheus (port 9090). Prometheus scrapes this metric. Kubernetes HPA uses it via prometheus-adapter as an external metric:

```
scale up when: queue_depth > 5 × current_replicas
```

Free workers: 1–10 replicas. Pro workers: 2–20 replicas. Enterprise workers: 1–5 replicas per tenant.

## Consequences

- **Good:** A noisy free tenant cannot affect pro or enterprise queues — they are on separate workers with independent thread pools and rate limits.
- **Good:** API process is stateless with respect to workers. Deploying a new API version does not restart workers. Workers can be rolled independently.
- **Good:** Enterprise tenants get guaranteed isolation. A dedicated queue means their queue depth is never shared with any other tenant.
- **Good:** Autoscaling is driven by actual queue backlog (schedule-to-start latency) not CPU/memory — a much more accurate signal for Temporal workloads.
- **Bad:** Enterprise worker provisioning is an ops concern. A new enterprise tenant requires infra automation (envsubst + kubectl apply) to deploy their dedicated worker pod. This is not self-service.
- **Bad:** Within a tier (free, pro), tenants still share a queue. A pro tenant running 100 concurrent flows will consume most of the pro worker's concurrency budget until HPA adds replicas. True per-tenant isolation within a tier requires queue-per-tenant, which multiplies queue count and is not implemented.
- **Tradeoff:** `maxActivitiesPerSecond` on the worker is a global rate for that worker process, not per-tenant. Two pro tenants sharing the pro queue split the rate budget. Accepted for pro tier; enterprise tier is unaffected due to dedicated queues.
