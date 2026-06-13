import { Pool, PoolClient } from 'pg';
import { TenantContextService } from './tenant-context.service';

/**
 * Wraps pg.Pool so every acquired client has app.tenant_id set for the
 * duration of that connection checkout.  Both Mastra's PostgresStore and
 * better-auth receive this pool — RLS is enforced at the DB level for all
 * queries, from all subsystems.
 */
export class RlsPool extends Pool {
  constructor(
    options: ConstructorParameters<typeof Pool>[0],
    private readonly tenantContext: TenantContextService,
  ) {
    super(options);
  }

  // Override connect() — called by pg internals for every query
  async connect(): Promise<PoolClient> {
    const client = await super.connect();
    const tenantId = this.tenantContext.getTenantId();

    if (tenantId) {
      // SET LOCAL scopes the variable to the current transaction/statement.
      // If no transaction is open, SET (without LOCAL) persists for the
      // connection lifetime — we use SET so it survives outside transactions.
      await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
    } else {
      // Clear any previous value so stale tenant_id never leaks
      await client.query(`SELECT set_config('app.tenant_id', '', false)`);
    }

    return client;
  }
}
