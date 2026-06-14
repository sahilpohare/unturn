import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { WebhookTriggerConfig, ScheduleTriggerConfig, ManualTriggerConfig } from './steps/trigger.step';
import type { AgentStepConfig } from './steps/agent.step';
import type { HttpStepConfig } from './steps/http.step';
import type { TransformStepConfig } from './steps/transform.step';
import type { ConditionStepConfig } from './steps/condition.step';
import type { DelayStepConfig } from './steps/delay.step';
import type { BrandResearchConfig } from './steps/brand-research.step';
import type { MetaAdsSearchConfig } from './steps/meta-ads-search.step';
import type { CreatorVetConfig } from './steps/creator-vet.step';
import type { InstagramDmConfig } from './steps/instagram-dm.step';

export type { AgentStepConfig } from './steps/agent.step';
export type { ToolConfig } from './steps/agent.step';

export type TriggerSubtype = 'webhook' | 'schedule' | 'manual';
export type StepType =
  | `trigger/${TriggerSubtype}`
  | 'agent'
  | 'http'
  | 'transform'
  | 'condition'
  | 'delay'
  | 'brand-research'
  | 'meta-ads-search'
  | 'creator-vet'
  | 'instagram-dm';

export type StepConfig =
  | WebhookTriggerConfig
  | ScheduleTriggerConfig
  | ManualTriggerConfig
  | AgentStepConfig
  | HttpStepConfig
  | TransformStepConfig
  | ConditionStepConfig
  | DelayStepConfig
  | BrandResearchConfig
  | MetaAdsSearchConfig
  | CreatorVetConfig
  | InstagramDmConfig;

// ─── Entity ──────────────────────────────────────────────────────────────────

@Entity('flow_steps')
@Unique(['flowId', 'ref'])
export class StepEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  flowId: string;

  /** User-defined stable reference string (unique within flow). Used in onSuccess/onFailure edges. */
  @Column({ type: 'varchar' })
  ref: string;

  @Column({ type: 'varchar' })
  type: StepType;

  @Column()
  name: string;

  /** Execution order (0-based). Trigger is always position 0. */
  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'jsonb', default: {} })
  config: StepConfig;

  /** Next step ref on success. Null = end of flow. */
  @Column({ type: 'varchar', nullable: true })
  onSuccess: string | null;

  /** Next step ref on failure. Null = fail the flow. */
  @Column({ type: 'varchar', nullable: true })
  onFailure: string | null;

  @Column({ type: 'jsonb', default: { maximumAttempts: 3, initialInterval: '1s' } })
  retryPolicy: { maximumAttempts: number; initialInterval?: string };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
