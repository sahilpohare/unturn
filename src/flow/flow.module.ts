import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowEntity } from './flow.entity';
import { StepEntity } from './step.entity';
import { TenantEntity } from '../platform/tenant/tenant.entity';
import { FlowService } from './flow.service';
import { FlowController } from './flow.controller';
import { WebhookController } from './webhook.controller';
import { TemporalModule } from '../temporal/temporal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlowEntity, StepEntity, TenantEntity]),
    TemporalModule,
  ],
  providers: [FlowService],
  controllers: [FlowController, WebhookController],
})
export class FlowModule {}
