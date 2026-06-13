# ADR-0001: Use Temporal for durable workflow execution

**Status:** Accepted
**Date:** 2025-01-01

## Context

Flows are multi-step pipelines that may include agent calls (minutes), delays (hours/days), and external HTTP calls that can fail. We need durable execution with automatic retry, visibility, and the ability to cancel or query running instances.

## Decision

Use [Temporal](https://temporal.io) as the workflow engine. Each flow run becomes a `flowInterpreterWorkflow` execution. Steps are dispatched as Temporal activities, which carry retry semantics independently.

The `FlowSnapshot` (all step definitions + config) is passed as the workflow input at start time. This means the workflow is self-contained — no DB reads during execution, consistent with Temporal's determinism requirement.

## Consequences

- **Good:** Durable execution survives worker restarts. Delays (`sleep`) are free. Each step has independent retry policy. Full history and query support via `contextQuery`.
- **Good:** Activity failures are retried transparently; workflow code stays linear.
- **Bad:** Temporal adds operational complexity (namespace, search attributes, worker process).
- **Bad:** Workflow code must be deterministic — no `Date.now()`, no random, no dynamic imports inside workflow functions.
- **Tradeoff:** `FlowSnapshot` is immutable once started. A flow edit does not affect in-flight runs. This is intentional.
