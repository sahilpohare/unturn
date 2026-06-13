import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  tenantId: string;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  run<T>(tenantId: string, fn: () => T): T {
    return this.storage.run({ tenantId }, fn);
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  getOrThrow(): string {
    const id = this.getTenantId();
    if (!id) throw new Error('No tenant context set for this request');
    return id;
  }
}
