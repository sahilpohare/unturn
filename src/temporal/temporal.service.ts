import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as exampleActivities from './activities/example.activities';
import * as flowActivities from './activities/flow.activities';
import { FLOW_TASK_QUEUE } from '../flow/flow.constants';

@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemporalService.name);
  private client: Client;
  private workers: Worker[] = [];
  private nativeConnections: NativeConnection[] = [];

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const address = this.config.get('TEMPORAL_ADDRESS', 'localhost:7233');
    const namespace = this.config.get('TEMPORAL_NAMESPACE', 'default');

    // Client uses its own connection
    const clientConnection = await Connection.connect({ address });
    this.client = new Client({ connection: clientConnection, namespace });

    // Each worker needs its own NativeConnection
    const generalConn = await NativeConnection.connect({ address });
    const flowConn = await NativeConnection.connect({ address });
    this.nativeConnections = [generalConn, flowConn];

    const generalWorker = await Worker.create({
      connection: generalConn,
      namespace,
      workflowsPath: require.resolve('./workflows/example.workflow'),
      activities: exampleActivities,
      taskQueue: this.config.get('TEMPORAL_TASK_QUEUE', 'default'),
    });

    const flowWorker = await Worker.create({
      connection: flowConn,
      namespace,
      workflowsPath: require.resolve('./workflows/flow-interpreter.workflow'),
      activities: flowActivities,
      taskQueue: FLOW_TASK_QUEUE,
    });

    this.workers = [generalWorker, flowWorker];
    this.workers.forEach((w) =>
      w.run().catch((err) => this.logger.error('Temporal worker error', err)),
    );

    this.logger.log(`Temporal connected to ${address}`);
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.shutdown()));
    // Small delay to allow workers to fully release connection references
    await new Promise((r) => setTimeout(r, 100));
    await Promise.all(this.nativeConnections.map((c) => c.close().catch(() => {})));
  }

  getClient(): Client {
    return this.client;
  }
}
