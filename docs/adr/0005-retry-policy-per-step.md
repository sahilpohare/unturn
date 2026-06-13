# ADR-0005: Per-step retry policy defined in flow JSON

**Status:** Accepted
**Date:** 2025-01-01

## Context

Different steps have very different failure modes. An LLM agent call may need 3 retries with exponential backoff. An Instagram DM send should not be retried (idempotency risk). An HTTP step hitting a flaky webhook may need 5 retries. A single global retry policy cannot serve all cases.

## Decision

Each step stores a `retryPolicy: { maximumAttempts: number; initialInterval?: string }` field. The policy is defined in the flow JSON at authoring time and stored on `StepEntity`. When the flow snapshot is built for Temporal, the policy is embedded in `FlowStepSnapshot.retryPolicy`.

The `flowInterpreterWorkflow` applies the policy per-step by calling `proxyActivities({ retry: step.retryPolicy })` inline for each step execution. Default is `{ maximumAttempts: 3, initialInterval: '1s' }` if omitted.

The UI exposes "Max Retries" and "Retry Interval" fields in the step editor (AddStepPanel) and displays the current policy in the step inspector (Sidebar).

## Consequences

- **Good:** Full per-step control over retry behaviour. Idempotent steps can have high retry counts; non-idempotent steps (DM send) can be set to 1.
- **Good:** Policy is visible and editable in the UI without code changes.
- **Bad:** Retry policy changes require re-saving the flow and re-running. In-flight executions use the snapshot from start time.
- **Tradeoff:** `initialInterval` is a string (`1s`, `30s`, `2m`) cast to Temporal's `Duration`. Invalid strings will cause a Temporal error at dispatch time, not at save time. Validation is left to the user for now.
