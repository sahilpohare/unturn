# ADR-0008: Workers as separate processes, API as client-only

**Status:** Accepted
**Date:** 2025-01-01

## Context

The original `TemporalService` created `Worker` instances inside the NestJS process via `Worker.create()` + `NativeConnection.connect()`. Each worker holds an open gRPC connection and a Node.js event loop partition. At 1000 enterprise tenants each needing a dedicated worker, this would require 1000 NativeConnections inside one process — causing memory exhaustion and connection pool saturation on the Temporal server.

Additionally, in-process workers couple the API deployment lifecycle to the worker lifecycle. A rolling API deployment restarts workers mid-execution, interrupting in-flight activities.

## Decision

`TemporalService` is reduced to a Temporal **client only** — it creates one `Connection` and one `Client`. No workers, no `NativeConnection`s, no `Worker.create()` calls.

Workers are a separate entry point: `src/temporal/worker.ts`. It is a plain Node.js script (no NestJS) that:
1. Reads `TASK_QUEUE` from env
2. Derives the tier and concurrency limits from the queue name
3. Creates one `NativeConnection` + one `Worker`
4. Calls `worker.run()` and blocks

Deployment: one pod per queue. `docker-compose.yml` defines `worker-free` and `worker-pro` as separate services using the same image with `CMD` overridden. Kubernetes manifests in `k8s/` define `Deployment` + `HPA` per tier.

## Consequences

- **Good:** API process has a fixed, small memory footprint regardless of tenant or worker count.
- **Good:** API deployments and worker deployments are independent. Rolling an API update does not interrupt in-flight Temporal activities — the worker pods continue running.
- **Good:** Workers can be scaled, restarted, or replaced without touching the API. A worker crash does not affect the API's ability to accept new flow execution requests.
- **Good:** Worker concurrency is tunable per deployment via `MAX_CONCURRENT_ACTS` and `MAX_ACTS_PER_SECOND` env vars without code changes.
- **Bad:** Local development now requires running two processes: `npm run start:dev` (API) and `TASK_QUEUE=flow-free npm run worker` (worker). `docker compose up` handles this automatically, but bare `npm start` no longer runs a complete system.
- **Tradeoff:** The worker process has no DI container. It imports activities directly. If activities ever need NestJS services (e.g. TypeORM repositories), a minimal NestJS bootstrap would need to be added to `worker.ts`. Currently activities are stateless and only use env vars, so this is not needed.
