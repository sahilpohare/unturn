# ADR-0003: Multi-tenancy via PostgreSQL Row-Level Security

**Status:** Accepted
**Date:** 2025-01-01

## Context

The platform is multi-tenant. Each tenant's data (flows, steps, executions) must be isolated. We need isolation that is hard to accidentally bypass at the query level, not just at the application layer.

## Decision

Use PostgreSQL Row-Level Security (RLS) as the primary isolation mechanism.

- `TenantContextService` stores the current `tenantId` in `AsyncLocalStorage`.
- Before every query, `RlsPool` calls `SET LOCAL app.tenant_id = '<id>'` within the transaction.
- RLS policies on all tenant-scoped tables filter by `current_setting('app.tenant_id')`.
- `FlowService.findFlow()` additionally queries `WHERE { id, tenantId }` as a defence-in-depth layer.

Tenant identity comes from `better-auth` session (organisation ID). The auth middleware sets the `AsyncLocalStorage` context on every request.

## Consequences

- **Good:** Isolation is enforced at the DB layer — even a buggy query cannot leak cross-tenant rows.
- **Good:** TypeORM queries do not need explicit `WHERE tenantId = ?` on every call (RLS handles it automatically).
- **Bad:** RLS policies must be maintained alongside migrations. Missing a policy on a new table is a silent security gap.
- **Bad:** Temporal activities run outside the HTTP request context. They receive `tenantId` via `FlowWorkflowInput` and must set it explicitly in any DB calls they make.
- **Mitigation:** `executeStep` activity passes `context.tenantId` through `FlowContext` so steps can set the RLS context if needed.
