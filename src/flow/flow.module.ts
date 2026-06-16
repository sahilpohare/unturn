import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowEntity } from './flow.entity';
import { StepEntity } from './step.entity';
import { FlowService } from './flow.service';
import { FlowController } from './flow.controller';
import { WebhookController } from './webhook.controller';
import { TemporalModule } from '../temporal/temporal.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlowEntity, StepEntity]),
    TemporalModule,
    PlatformModule,
  ],
  providers: [FlowService],
  controllers: [FlowController, WebhookController],
})
export class FlowModule {}
