# ADR-0004: Step class hierarchy for flow execution

**Status:** Accepted
**Date:** 2025-01-01

## Context

Flow steps were originally implemented as a large `switch` inside a single activity function. This made adding new step types require editing core infrastructure, and sharing helpers (path resolution, template interpolation) was duplicated.

## Decision

Extract each step type into its own class extending `BaseStep<TConfig>`.

```
BaseStep<TConfig>
  ├── TriggerStep
  ├── AgentStep        — LLM agent via Mastra
  ├── HttpStep         — outbound HTTP with SSRF guard
  ├── TransformStep    — JSONata/mapping transforms
  ├── ConditionStep    — expression-based branching
  ├── DelayStep        — Temporal sleep (handled in workflow, not activity)
  ├── BrandResearchStep
  ├── MetaAdsSearchStep
  ├── CreatorVetStep
  └── InstagramDmStep
```

`BaseStep` provides `resolvePath(path, context)` and `resolveTemplate(template, context)` plus `assertPublicUrl(url)` for SSRF protection. A `createStep(snapshot)` factory in `steps/index.ts` maps step type strings to classes.

`flow.activities.ts` is reduced to 5 lines — it just calls `createStep(input.step).execute(input.context)`.

## Consequences

- **Good:** Adding a new step type = new file + one registry entry. No changes to activity or workflow code.
- **Good:** Shared helpers live in one place. SSRF guard applied consistently via `assertPublicUrl`.
- **Good:** Each step is independently testable with a mock `FlowContext`.
- **Bad:** Steps are instantiated fresh per execution (no singleton state). This is correct — steps are stateless.
- **Tradeoff:** Step config types are untyped at the registry boundary (`FlowStepSnapshot.config: unknown`). Runtime casting is required inside each step class. Acceptable given the dynamic JSON config model.
