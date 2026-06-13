/**
 * Standalone agent runner — no NestJS required.
 *
 * Loads agent + store config from data/agents.json and data/stores.json,
 * constructs a FlowSnapshot, and starts a Temporal workflow.
 *
 * Usage:
 *   OPENAI_API_KEY=... npx ts-node -r tsconfig-paths/register scripts/run-agent.ts \
 *     --agent ugc-creator-outreach \
 *     --store jacquemus
 *
 * Environment:
 *   OPENAI_API_KEY      required
 *   TEMPORAL_ADDRESS    default localhost:7233
 *   TEMPORAL_NAMESPACE  default default
 *   OPENAI_MODEL        default openai/gpt-4o-mini
 *   META_ACCESS_TOKEN   optional (for meta-ad-library tool)
 *   INSTAGRAM_ACCESS_TOKEN  optional
 *   INSTAGRAM_USER_ID       optional
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Connection, Client } from '@temporalio/client';
import type { FlowSnapshot, FlowWorkflowInput, FlowStepSnapshot } from '../src/flow/flow.types';

// Expose store ID to worker process for store-specific mock responses
// Workers inherit this env var since they share the same process in ts-node mode

// ── CLI args ─────────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const agentId = arg('--agent');
const storeId = arg('--store');

if (!agentId || !storeId) {
  console.error('Usage: ts-node scripts/run-agent.ts --agent <agentId> --store <storeId>');
  console.error('');
  console.error('Available agents:');
  const agentsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/agents.json'), 'utf8'));
  for (const a of agentsRaw.agents) console.error(`  ${a.id}  —  ${a.name}`);
  console.error('');
  console.error('Available stores:');
  const storesRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/stores.json'), 'utf8'));
  for (const s of storesRaw.stores) console.error(`  ${s.id}  —  ${s.name}`);
  process.exit(1);
}

// ── Load configs ──────────────────────────────────────────────────────────────

const dataDir = path.join(__dirname, '../data');
const agentsDb: { agents: AgentConfig[] } = JSON.parse(fs.readFileSync(path.join(dataDir, 'agents.json'), 'utf8'));
const storesDb: { stores: StoreConfig[] } = JSON.parse(fs.readFileSync(path.join(dataDir, 'stores.json'), 'utf8'));

interface StepConfigJson {
  ref: string;
  type: string;
  name: string;
  position: number;
  config: Record<string, unknown>;
  onSuccess?: string;
  onFailure?: string;
  retryPolicy: { maximumAttempts: number; initialInterval?: string };
}

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills: string[];
  flow: { steps: StepConfigJson[] };
}

interface StoreConfig {
  id: string;
  name: string;
  websiteUrl: string;
  identity: string;
  runs: Record<string, Record<string, string>>;
}

const agentConfig = agentsDb.agents.find((a) => a.id === agentId);
if (!agentConfig) {
  console.error(`Agent "${agentId}" not found in data/agents.json`);
  process.exit(1);
}
const agent = agentConfig!;

const storeConfig = storesDb.stores.find((s) => s.id === storeId);
if (!storeConfig) {
  console.error(`Store "${storeId}" not found in data/stores.json`);
  process.exit(1);
}
const store = storeConfig!;

const runInput = store.runs[agentId];
if (!runInput) {
  console.error(`No run config for agent "${agentId}" in store "${storeId}"`);
  process.exit(1);
}

// Make store ID available to workers (same process in ts-node) for mock routing
process.env.MOCK_STORE = storeId;

// ── Build FlowSnapshot from agent JSON config ─────────────────────────────────

const tenantId = `store-${storeId}`;  // Synthetic tenant ID for demo

const flowId = `${agentId}-${storeId}-${Date.now()}`;

const snapshot: FlowSnapshot = {
  id: flowId,
  name: `${agent.name} — ${store.name}`,
  tenantId,
  steps: agent.flow.steps.map((s): FlowStepSnapshot => ({
    id: `${flowId}-${s.ref}`,
    ref: s.ref,
    type: s.type as any,
    name: s.name,
    position: s.position,
    config: s.config,
    onSuccess: s.onSuccess ?? null,
    onFailure: s.onFailure ?? null,
    retryPolicy: s.retryPolicy,
  })),
};

// For the standalone runner, credentials fall back to env vars inside each step.
// In the real platform, FlowService fetches these from tenant.credentials in DB.
const workflowInput: FlowWorkflowInput = {
  flow: snapshot,
  input: runInput,
  tenantId,
  credentials: {
    metaAccessToken: process.env.META_ACCESS_TOKEN ?? '',
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
    instagramUserId: process.env.INSTAGRAM_USER_ID ?? '',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? 'openai/gpt-4o-mini',
  },
};

// ── Start workflow ────────────────────────────────────────────────────────────

async function main() {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║            UNTURN AGENT RUNNER                          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Agent : ${agent.name.padEnd(47)}║`);
  console.log(`║  Store : ${store.name.padEnd(47)}║`);
  console.log(`║  Tenant: ${tenantId.padEnd(47)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Agent skills:', agent.skills.join(', '));
  console.log('Store identity:', store.identity.slice(0, 100) + '...');
  console.log('');
  console.log('Run input:');
  console.log(JSON.stringify(runInput, null, 2));
  console.log('');
  console.log('Flow steps:');
  for (const step of snapshot.steps) {
    console.log(`  [${step.position}] ${step.type.padEnd(20)} → ${step.name}`);
  }
  console.log('');

  const connection = await Connection.connect({ address });
  const client = new Client({ connection, namespace });

  const workflowId = `run-${agentId}-${storeId}-${Date.now()}`;

  console.log(`Starting workflow: ${workflowId}`);
  console.log(`Temporal UI: http://localhost:8080/namespaces/default/workflows/${encodeURIComponent(workflowId)}`);
  console.log('');

  const handle = await client.workflow.start('flowInterpreterWorkflow', {
    taskQueue: 'flow-free',
    workflowId,
    args: [workflowInput],
    searchAttributes: {
      FlowId: [flowId],
      TenantId: [tenantId],
    },
  });

  console.log('Workflow started. Waiting for result...');
  console.log('(Press Ctrl+C to detach — workflow continues in Temporal)');
  console.log('');

  const result = await handle.result();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  STATUS: ${result.status.toUpperCase().padEnd(47)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  if (result.status === 'failed') {
    console.error('Error:', result.error);
  } else {
    console.log('Step outputs:');
    for (const [ref, output] of Object.entries(result.steps)) {
      console.log(`\n── ${ref} ──`);
      if (typeof output === 'object' && output !== null && 'text' in output) {
        // Agent step — print the LLM text response
        console.log((output as any).text);
        if ((output as any).toolCalls?.length) {
          console.log('\nTool calls made:');
          for (const tc of (output as any).toolCalls) {
            console.log(`  → ${tc.toolName}(${JSON.stringify(tc.args)})`);
          }
        }
      } else {
        console.log(JSON.stringify(output, null, 2));
      }
    }
  }

  await connection.close();
}

main().catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
