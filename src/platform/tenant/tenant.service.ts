import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Auth } from '../auth/auth.instance';
import { AUTH_INSTANCE } from '../auth/auth-infra.module';
import { TenantEntity } from './tenant.entity';

export interface CreateTenantDto {
  name: string;
  slug: string;
  userId: string; // owner
}

/** Keys users can configure. All values are strings (tokens, IDs). */
export type TenantCredentialKey =
  | 'metaAccessToken'
  | 'instagramAccessToken'
  | 'instagramUserId'
  | 'openaiApiKey'
  | 'openaiModel';

@Injectable()
export class TenantService {
  constructor(
    @Inject(AUTH_INSTANCE) private readonly auth: Auth,
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
  ) {}

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

  /**
   * Lists tenants for a user by fetching their better-auth orgs and mapping
   * slugs to internal tenant UUIDs.
   */
  async listForUser(userId: string): Promise<{ id: string; name: string; slug: string }[]> {
    const orgs = await (this.auth.api.listOrganizations as any)({
      query: { userId },
    }).catch(() => null);
    const orgList: { name: string; slug: string }[] = Array.isArray(orgs) ? orgs : (orgs?.organizations ?? []);
    if (!orgList.length) return [];
    const slugs = orgList.map((o) => o.slug).filter(Boolean);
    const tenants = await this.tenantRepo
      .createQueryBuilder('t')
      .where('t.slug IN (:...slugs)', { slugs })
      .select(['t.id', 't.name', 't.slug'])
      .getMany();
    return tenants;
  }

  /**
   * Returns the tenant's credentials with all values masked except the last 4 chars.
   * Never returns raw tokens to the frontend.
   */
  async getCredentials(tenantId: string): Promise<Record<string, string>> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException(`Invalid tenant ID`);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(tenant.credentials ?? {})) {
      if (!v) { masked[k] = ''; continue; }
      masked[k] = v.length > 8 ? '•'.repeat(v.length - 4) + v.slice(-4) : '••••';
    }
    return masked;
  }

  /**
   * Merges the provided credential updates into the tenant's credentials.
   * Empty-string values are treated as "clear this credential".
   * TODO: Encrypt values before storing in production.
   */
  async updateCredentials(tenantId: string, updates: Partial<Record<TenantCredentialKey, string>>): Promise<void> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    const current = tenant.credentials ?? {};
    for (const [k, v] of Object.entries(updates)) {
      if (v === '' || v === undefined) {
        delete current[k];
      } else {
        current[k] = v as string;
      }
    }
    tenant.credentials = current;
    await this.tenantRepo.save(tenant);
  }
}
