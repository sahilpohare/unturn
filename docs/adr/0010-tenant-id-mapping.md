# ADR-0010: Tenant ID mapping between better-auth and internal PostgreSQL UUIDs

**Status:** Accepted
**Date:** 2026-06-14

## Context

The platform uses `better-auth` with the `organization` plugin for authentication and workspace management. better-auth generates its own opaque string IDs for organizations (e.g. `5rY4TF1PD6jxJ2DMyXTZx3Qbj5rtDIrY`). The internal `tenants` table uses `PrimaryGeneratedColumn('uuid')` — standard PostgreSQL UUIDs.

The frontend was calling `/api/auth/organization/list` directly, receiving better-auth org IDs, and using them as `:tenantId` URL params. The backend passed these to TypeORM queries expecting UUIDs, causing `invalid input syntax for type uuid` errors.

Additionally, `better-auth`'s `listOrganizations` server API endpoint requires a cookie-based session and cannot be called server-side with only a userId — it raises `UNAUTHORIZED`.

## Decision

1. Add `GET /api/tenants/mine` endpoint that:
   - Receives the authenticated user's session via `@Session()` decorator (resolved by `nestjs-better-auth` from the Bearer token)
   - Queries the better-auth `organization` and `member` tables directly via TypeORM `DataSource.query()` (same PostgreSQL database)
   - Auto-creates rows in the `tenants` table for any orgs that predate the mapping (matched by `slug`)
   - Returns internal UUID tenant rows

2. Frontend `listTenants()` calls `/api/tenants/mine` instead of the better-auth org list endpoint.

3. `TenantService.create()` now also inserts a `tenants` row (by slug) in addition to creating the better-auth org, keeping the two tables in sync going forward.

4. `TenantSwitcher` auto-selects the first tenant on mount so `tenantId` is always populated with a real UUID from the first page load.

## Consequences

- **Good:** All downstream API calls use real PostgreSQL UUIDs — no more UUID parse errors.
- **Good:** Legacy orgs (created before this fix) are auto-migrated on first `/tenants/mine` call.
- **Good:** No dependency on better-auth's session-bound `listOrganizations` API server-side.
- **Tradeoff:** Direct SQL join against better-auth's internal tables (`organization`, `member`) creates a coupling to their schema. If better-auth renames these tables in a future version, the query breaks. Acceptable given better-auth is a first-party dependency with a stable schema.
- **Tradeoff:** Two sources of truth for org/tenant data (better-auth + `tenants` table). Kept in sync by slug matching. A future cleanup could store the better-auth org ID as a column on `TenantEntity` for a direct FK join.
