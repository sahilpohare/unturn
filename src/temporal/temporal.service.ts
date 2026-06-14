import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';

/**
 * TemporalService is CLIENT-ONLY in the API process.
 *
 * Workers run as separate processes/pods (src/temporal/worker.ts).
 * Scale workers independently via TASK_QUEUE env var:
 *
 *   TASK_QUEUE=flow-free  node dist/temporal/worker.js   # N replicas
 *   TASK_QUEUE=flow-pro   node dist/temporal/worker.js   # M replicas
 *   TASK_QUEUE=flow-enterprise-<tid> node dist/temporal/worker.js  # 1 per enterprise tenant
 */
@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemporalService.name);
  private client: Client;
  private connection: Connection;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const address = this.config.get('TEMPORAL_ADDRESS', 'localhost:7233');
    const namespace = this.config.get('TEMPORAL_NAMESPACE', 'default');
    this.connection = await Connection.connect({ address });
    this.client = new Client({ connection: this.connection, namespace });
    this.logger.log(`Temporal client connected to ${address}`);
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }

  getClient(): Client {
    return this.client;
  }
}
