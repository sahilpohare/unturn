/**
 * Standalone worker entry point.
 *
 * Deploy one process (pod/task) per queue. Scale replicas independently.
 *
 * Usage:
 *   TASK_QUEUE=flow-free node dist/temporal/worker.js
 *   TASK_QUEUE=flow-pro  node dist/temporal/worker.js
 *   TASK_QUEUE=flow-enterprise-<tenantId> node dist/temporal/worker.js
 *
 * Environment:
 *   TASK_QUEUE             required — which queue this worker services
 *   TEMPORAL_ADDRESS       default: localhost:7233
 *   TEMPORAL_NAMESPACE     default: default
 *   MAX_CONCURRENT_ACTS    override concurrency (optional)
 *   MAX_ACTS_PER_SECOND    override rate limit (optional)
 */
import 'reflect-metadata';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as flowActivities from './activities/flow.activities';
import { TIER_CONCURRENCY, type TenantTier } from '../flow/flow.constants';

function tierFromQueue(queue: string): TenantTier {
  if (queue.startsWith('flow-enterprise-')) return 'enterprise';
  if (queue === 'flow-pro') return 'pro';
  return 'free';
}

async function main() {
  const taskQueue = process.env.TASK_QUEUE;
  if (!taskQueue) throw new Error('TASK_QUEUE env var required');

  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
  const tier = tierFromQueue(taskQueue);
  const limits = TIER_CONCURRENCY[tier];

  const maxConcurrentActivityTaskExecutions =
    process.env.MAX_CONCURRENT_ACTS
      ? parseInt(process.env.MAX_CONCURRENT_ACTS, 10)
      : limits.maxConcurrentActivities;

  const maxActivitiesPerSecond =
    process.env.MAX_ACTS_PER_SECOND
      ? parseFloat(process.env.MAX_ACTS_PER_SECOND)
      : limits.maxActivitiesPerSecond;

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace,
    workflowsPath: require.resolve('./workflows/flow-interpreter.workflow'),
    activities: flowActivities,
    taskQueue,
    maxConcurrentActivityTaskExecutions,
    maxActivitiesPerSecond,
  });

  console.log(`Worker started | queue=${taskQueue} tier=${tier} maxActs=${maxConcurrentActivityTaskExecutions} maxActs/s=${maxActivitiesPerSecond}`);

  await worker.run();
}

main().catch((err) => {
  console.error('Worker fatal error', err);
  process.exit(1);
});
