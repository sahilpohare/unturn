import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { UserEntity } from '../user/user.entity';
import type { TenantTier } from '../../flow/flow.constants';

export type TenantStatus = 'active' | 'suspended' | 'cancelled';

@Entity('tenants')
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: 'active' })
  status: TenantStatus;

  @Column({ type: 'varchar', default: 'free' })
  tier: TenantTier;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  /**
   * Per-tenant API credentials, stored as JSONB.
   * In production these should be encrypted at rest (e.g. via pgcrypto or
   * a KMS envelope). Workers receive credentials via FlowContext — they never
   * query the DB directly, keeping worker processes stateless.
   *
   * Known keys: metaAccessToken, instagramAccessToken, instagramUserId,
   *             openaiApiKey, openaiModel
   */
  @Column({ type: 'jsonb', default: {} })
  credentials: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  users: UserEntity[];
}
