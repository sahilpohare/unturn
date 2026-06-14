export type TenantTier = 'free' | 'pro' | 'enterprise';

// One queue per tier. Enterprise tenants get a dedicated queue to guarantee isolation.
export const TIER_QUEUES: Record<TenantTier, string | ((tenantId: string) => string)> = {
  free:       'flow-free',
  pro:        'flow-pro',
  enterprise: (tenantId: string) => `flow-enterprise-${tenantId}`,
};

export function taskQueueForTenant(tier: TenantTier, tenantId: string): string {
  const q = TIER_QUEUES[tier];
  return typeof q === 'function' ? q(tenantId) : q;
}

// Worker concurrency limits per tier
export const TIER_CONCURRENCY: Record<TenantTier, { maxConcurrentActivities: number; maxActivitiesPerSecond: number }> = {
  free:       { maxConcurrentActivities: 5,  maxActivitiesPerSecond: 2  },
  pro:        { maxConcurrentActivities: 20, maxActivitiesPerSecond: 10 },
  enterprise: { maxConcurrentActivities: 50, maxActivitiesPerSecond: 25 },
};

// Legacy single-queue constant kept for the general/example worker
export const FLOW_TASK_QUEUE = 'flow-engine';

