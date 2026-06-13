# ADR-0006: SSRF protection on outbound HTTP steps

**Status:** Accepted
**Date:** 2025-01-01

## Context

`HttpStep` and `BrandResearchStep` make outbound HTTP calls to user-supplied URLs. Without validation, a malicious flow config could target internal services (metadata endpoints, Temporal, Postgres, local admin APIs) via Server-Side Request Forgery.

## Decision

Add `assertPublicUrl(url: string)` to `BaseStep`. It throws `ApplicationFailure.nonRetryable` (so Temporal does not retry) if:

1. The URL is not parseable as a valid URL.
2. The scheme is not `http:` or `https:`.
3. The hostname matches private/loopback/link-local ranges:
   - `localhost`, `127.x.x.x`
   - `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`
   - `169.254.x.x` (AWS metadata, GCP metadata)
   - IPv6 loopback `::1`, ULA `fc/fd`, link-local `fe80`

`HttpStep` calls `assertPublicUrl(url)` after template resolution. `BrandResearchStep` calls it on the base URL and each constructed path URL.

## Consequences

- **Good:** Blocks the most common SSRF vectors at the execution layer.
- **Good:** Error is non-retryable — no repeated probing attempts on failure.
- **Limitation:** Does not resolve DNS — a hostname that currently resolves to a public IP but points to a private IP via DNS rebinding is not blocked. For production, consider using a dedicated egress proxy with network-level controls.
- **Limitation:** Does not block all internal hostnames (e.g. `postgres`, `temporal` as bare service names in Docker networks). Network-level egress policy is the correct complement.
