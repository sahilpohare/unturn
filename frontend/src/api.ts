import type { Flow } from './types';

const BASE = '/api';

let tenantId = '';
let token = '';

export function setTenantId(id: string) { tenantId = id; }
export function setToken(t: string) { token = t; }

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function listFlows(): Promise<Flow[]> {
  const r = await fetch(`${BASE}/tenants/${tenantId}/flows`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getFlow(id: string): Promise<Flow> {
  const r = await fetch(`${BASE}/tenants/${tenantId}/flows/${id}`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createFlow(body: { name: string; description?: string; steps: unknown[] }): Promise<Flow> {
  const r = await fetch(`${BASE}/tenants/${tenantId}/flows`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateFlow(id: string, body: Partial<Flow>): Promise<Flow> {
  const r = await fetch(`${BASE}/tenants/${tenantId}/flows/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteFlow(id: string): Promise<void> {
  await fetch(`${BASE}/tenants/${tenantId}/flows/${id}`, { method: 'DELETE', headers: headers() });
}

export async function deleteStep(flowId: string, stepId: string): Promise<void> {
  await fetch(`${BASE}/tenants/${tenantId}/flows/${flowId}/steps/${stepId}`, { method: 'DELETE', headers: headers() });
}

export async function upsertSteps(flowId: string, steps: unknown[]): Promise<unknown[]> {
  const r = await fetch(`${BASE}/tenants/${tenantId}/flows/${flowId}/steps`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(steps),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function executeFlow(flowId: string, input: Record<string, unknown> = {}): Promise<{ workflowId: string }> {
  const r = await fetch(`${BASE}/tenants/${tenantId}/flows/${flowId}/execute`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function getTenantId() { return tenantId; }

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export async function listTenants(): Promise<Tenant[]> {
  const r = await fetch(`${BASE}/tenants/mine`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createTenant(name: string, slug: string): Promise<Tenant> {
  const r = await fetch('/api/auth/organization/create', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, slug }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type CredentialKey =
  | 'metaAccessToken'
  | 'instagramAccessToken'
  | 'instagramUserId'
  | 'openaiApiKey'
  | 'openaiModel';

export const CREDENTIAL_LABELS: Record<CredentialKey, string> = {
  metaAccessToken: 'Meta Access Token',
  instagramAccessToken: 'Instagram Access Token',
  instagramUserId: 'Instagram Business Account ID',
  openaiApiKey: 'OpenAI API Key',
  openaiModel: 'OpenAI Model (e.g. openai/gpt-4o-mini)',
};

export async function getCredentials(tid: string): Promise<Record<CredentialKey, string>> {
  const r = await fetch(`${BASE}/tenants/${tid}/credentials`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateCredentials(tid: string, body: Partial<Record<CredentialKey, string>>): Promise<void> {
  const r = await fetch(`${BASE}/tenants/${tid}/credentials`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
}
