import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Auth } from '../auth/auth.instance';
import { AUTH_INSTANCE } from '../auth/auth-infra.module';

export interface CreateTenantDto {
  name: string;
  slug: string;
  userId: string; // owner
}

@Injectable()
export class TenantService {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth) {}

  async create(dto: CreateTenantDto) {
    return this.auth.api.createOrganization({
      body: { name: dto.name, slug: dto.slug, userId: dto.userId },
    });
  }

  async findById(id: string) {
    const org = await (this.auth.api.getFullOrganization as any)({
      query: { organizationId: id },
    });
    if (!org) throw new NotFoundException(`Tenant ${id} not found`);
    return org;
  }

  async listMembers(tenantId: string) {
    const org = await (this.auth.api.getFullOrganization as any)({
      query: { organizationId: tenantId },
    });
    if (!org) throw new NotFoundException(`Tenant ${tenantId} not found`);
    return org.members;
  }

  async inviteMember(tenantId: string, email: string, role: 'admin' | 'member' = 'member') {
    return (this.auth.api.createInvitation as any)({
      body: { organizationId: tenantId, email, role },
    });
  }

  async removeMember(tenantId: string, memberId: string) {
    await (this.auth.api.removeMember as any)({
      body: { organizationId: tenantId, memberIdOrEmail: memberId },
    });
  }
}
