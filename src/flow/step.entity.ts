import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// ─── Trigger subtypes ─────────────────────────────────────────────────────────

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

// ─── Config shapes (stored as JSONB) ─────────────────────────────────────────

export interface WebhookTriggerConfig {
  secret?: string;
  /** JSONPath — only proceed if expression is truthy */
  filter?: string;
}

export interface ScheduleTriggerConfig {
  cron: string;
  timezone?: string;
}

export interface ManualTriggerConfig {
  /** JSON Schema describing expected input */
  inputSchema?: Record<string, unknown>;
}

/** A tool the agent can call during this step */
export interface ToolConfig {
  name: string;
  type: 'http' | 'builtin';
  description: string;
  /** JSON Schema for the tool's parameters */
  inputSchema: Record<string, unknown>;
  http?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
  };
  /** For type='builtin': registered tool identifier */
  builtinId?: string;
}

export interface AgentStepConfig {
  agentName: string;
  /** Handlebars template: "Summarise: {{input.text}}" */
  promptTemplate: string;
  tools: ToolConfig[];
  threadIdPath?: string;   // JSONPath into FlowContext e.g. "$.input.threadId"
  resourceIdPath?: string; // JSONPath into FlowContext e.g. "$.input.userId"
}

export interface HttpStepConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}

export interface TransformStepConfig {
  /** output key → JSONPath expression on FlowContext */
  mapping: Record<string, string>;
}

export interface ConditionStepConfig {
  /** JSONPath expression — truthy = onTrue branch */
  expression: string;
  onTrue: string;
  onFalse: string;
}

export interface DelayStepConfig {
  duration: string; // '30s' | '5m' | '2h'
}

// ─── Outreach step configs ────────────────────────────────────────────────────

export interface BrandResearchConfig {
  /** JSONPath or literal website URL */
  websiteUrl: string;
  /** Optional extra pages to scrape e.g. '/products', '/about' */
  extraPaths?: string[];
}

export interface MetaAdsSearchConfig {
  /** Facebook Page ID of the brand */
  pageIdPath: string; // JSONPath e.g. '$.input.metaPageId' or literal
  /** ISO 3166 country code(s) e.g. ['US'] */
  countries: string[];
  /** Max ads to retrieve */
  limit?: number;
  /** Meta Graph API access token — pulled from env if omitted */
  accessToken?: string;
}

export interface CreatorVetConfig {
  /** JSONPath to array of Instagram handles from a prior step */
  handlesPath: string;
  /** Min followers */
  minFollowers?: number;
  /** Max creators to pass through */
  topN?: number;
}

export interface InstagramDmConfig {
  /** JSONPath to Instagram user ID to DM */
  recipientIdPath: string;
  /** JSONPath to message text (from agent output) */
  messagePath: string;
  /** Instagram Graph API access token — pulled from env if omitted */
  accessToken?: string;
  /** Delay between DMs in ms (rate limiting) */
  delayMs?: number;
}

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
