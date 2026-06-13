import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CreateThreadDto, ThreadService } from './thread.service';

@ApiTags('Threads')
@ApiBearerAuth()
@Controller('tenants/:tenantId/threads')
export class ThreadController {
  constructor(private readonly threadService: ThreadService) {}

  @Post()
  create(@Session() session: UserSession, @Body() dto: Omit<CreateThreadDto, 'resourceId'>) {
    return this.threadService.create({ ...dto, resourceId: session.user.id });
  }

  @Get()
  findMine(@Session() session: UserSession) {
    return this.threadService.findByResource(session.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.threadService.findById(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.threadService.delete(id);
  }
}
