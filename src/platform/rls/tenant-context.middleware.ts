import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

/**
 * Applied to routes under /tenants/:tenantId/*.
 * Reads tenantId from the route, then runs the rest of the request pipeline
 * inside TenantContextService.run() so the RlsPool picks it up.
 *
 * Membership check is intentionally minimal here — better-auth's own
 * org membership APIs enforce it at the data layer; RLS enforces it at DB.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const rawTenantId = req.params?.tenantId ?? (req as any).tenantId;
    const tenantId: string | undefined = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;

    if (!tenantId) {
      return next(); // Non-tenant routes — no context needed
    }

    // Run the rest of the pipeline inside the tenant context
    this.tenantContext.run(tenantId, () => next());
  }
}
