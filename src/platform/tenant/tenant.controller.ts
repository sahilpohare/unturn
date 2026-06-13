import { Body, Controller, Delete, Get, HttpCode, Param, Post, Patch } from '@nestjs/common';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService, CreateTenantDto, TenantCredentialKey } from './tenant.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('mine')
  listMine(@Session() session: UserSession) {
    return this.tenantService.listForUser(session.user.id);
  }

  @Post()
  create(@Session() session: UserSession, @Body() dto: Omit<CreateTenantDto, 'userId'>) {
    return this.tenantService.create({ ...dto, userId: session.user.id });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.tenantService.listMembers(id);
  }

  @Post(':id/members/invite')
  invite(
    @Param('id') tenantId: string,
    @Body() dto: { email: string; role?: 'admin' | 'member' },
  ) {
    return this.tenantService.inviteMember(tenantId, dto.email, dto.role);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(204)
  removeMember(@Param('id') tenantId: string, @Param('memberId') memberId: string) {
    return this.tenantService.removeMember(tenantId, memberId);
  }

  @Get(':id/credentials')
  getCredentials(@Param('id') id: string) {
    return this.tenantService.getCredentials(id);
  }

  @Patch(':id/credentials')
  @HttpCode(204)
  updateCredentials(
    @Param('id') id: string,
    @Body() body: Partial<Record<TenantCredentialKey, string>>,
  ) {
    return this.tenantService.updateCredentials(id, body);
  }
}
