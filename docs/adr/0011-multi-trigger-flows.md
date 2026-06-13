# ADR-0011: Multiple trigger steps per flow

**Status:** Accepted
**Date:** 2026-06-14

## Context

Flows initially enforced exactly one trigger step (validated in `FlowService.validateSteps`). This prevented a common pattern: the same flow logic triggered by multiple entry points (e.g. manual + webhook + schedule). Users adding a second trigger via the UI caused the frontend to strip the existing trigger before upserting, and the backend to reject with a validation error.

## Decision

- **Backend:** Change `validateSteps` from `triggers.length !== 1` to `triggers.length === 0`. Flows must have at least one trigger but may have many.
- **Frontend:** Remove the logic in `AddStepPanel` that filtered out existing trigger steps before building the upsert payload. New triggers are appended like any other step.

The `execute()` endpoint accepts a `flowId` and runs the entire flow regardless of which trigger fired. Callers are responsible for passing the appropriate `input` payload matching the trigger's expected schema.

## Consequences

- **Good:** Flows can be triggered by multiple mechanisms without duplication of step logic.
- **Good:** UI no longer silently deletes triggers when adding a second one.
- **Neutral:** The workflow interpreter executes all steps in graph order starting from position 0. With multiple triggers, the caller selects the entry point by passing the right input — the interpreter itself is trigger-agnostic.
- **Tradeoff:** No validation that trigger refs/positions are non-conflicting. If two triggers share the same `onSuccess` chain, that is valid and intentional.
