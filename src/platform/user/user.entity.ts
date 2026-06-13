import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export type UserRole = 'owner' | 'admin' | 'member';
export type UserStatus = 'active' | 'invited' | 'suspended';

@Entity('users')
@Unique(['tenantId', 'email'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: 'member' })
  role: UserRole;

  @Column({ type: 'varchar', default: 'invited' })
  status: UserStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
