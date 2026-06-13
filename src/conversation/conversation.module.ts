import { Module } from '@nestjs/common';
import { MastraInfraModule } from '../mastra/mastra-infra.module';
import { ThreadService } from './thread/thread.service';
import { ThreadController } from './thread/thread.controller';
import { MessageService } from './message/message.service';
import { MessageController } from './message/message.controller';

@Module({
  imports: [MastraInfraModule], // RlsModule is @Global, no explicit import needed
  providers: [ThreadService, MessageService],
  controllers: [ThreadController, MessageController],
})
export class ConversationModule {}
