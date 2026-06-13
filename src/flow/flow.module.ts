import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowEntity } from './flow.entity';
import { StepEntity } from './step.entity';
import { FlowService } from './flow.service';
import { FlowController } from './flow.controller';
import { TemporalModule } from '../temporal/temporal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlowEntity, StepEntity]),
    TemporalModule,
  ],
  providers: [FlowService],
  controllers: [FlowController],
})
export class FlowModule {}
