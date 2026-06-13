import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessageService, SendMessageDto } from './message.service';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('tenants/:tenantId/threads/:threadId/messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  send(
    @Param('threadId') threadId: string,
    @Session() session: UserSession,
    @Body() dto: Pick<SendMessageDto, 'content'>,
  ) {
    return this.messageService.send(threadId, {
      resourceId: session.user.id,
      content: dto.content,
    });
  }

  @Get()
  findAll(@Param('threadId') threadId: string) {
    return this.messageService.findByThread(threadId);
  }
}
