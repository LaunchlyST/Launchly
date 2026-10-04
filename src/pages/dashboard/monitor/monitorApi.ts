import type {
  ApiResult,
  ChangeSet,
  ConnectedProject,
  GitHubRepo,
  ModelInfo,
  ModelSelection,
  MonitorBackendStatus,
  MonitorPermissions,
  ProviderConnection,
  ProviderId,
} from './types';

/**
 * Frontend gateway to the Monitor backend (the subscription worker). Every
 * call is authenticated with the user's Supabase token. API keys go to the
 * server once and are never read back — only { connected, keyLast4 }.
 *
 * When an endpoint isn't deployed or configured, calls resolve to
 * { ok: false, reason: 'not_configured' } — the UI shows that honestly.
 */

import { WORKER_URL } from '../../../lib/workerUrl';

async function call<T>(path: string, token: string | null, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (!token) return { ok: false, reason: 'unauthorized', message: 'Sign in to use Monitor projects.' };
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers as Record<string, string>) },
    });
  } catch {
    return { ok: false, reason: 'unavailable', message: 'Can’t reach the Monitor service.' };
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON (e.g. old worker without these routes) */
  }
  if (res.ok && body?.success !== false) {
    const data = body?.data ?? body;
    // A 200 that isn't our JSON (e.g. the website's HTML) means the Monitor
    // service isn't behind this URL — never treat that as real data.
    if (data === null || data === undefined || typeof data !== 'object') {
      return { ok: false, reason: 'not_configured', message: 'The Monitor service isn’t available at this address.' };
    }
    return { ok: true, data: data as T };
  }
  const code: string | undefined = body?.error?.code;
  if (res.status === 404 || res.status === 501 || code === 'NOT_CONFIGURED') {
    return { ok: false, reason: 'not_configured', message: body?.error?.message || 'This isn’t set up on the server yet.' };
  }
  if (code?.startsWith('PROVIDER_')) return { ok: false, reason: 'error', message: body.error.message, failure: body.error };
  if (res.status === 401) return { ok: false, reason: 'unauthorized', message: 'Sign in again to continue.' };
  return { ok: false, reason: 'error', message: body?.error?.message || `Request failed (${res.status}).` };
}

const json = (b: unknown) => ({ method: 'POST', body: JSON.stringify(b) });

export const monitorApi = {
  status: (t: string | null) => call<MonitorBackendStatus>('/api/monitor/status', t),

  // AI providers & models
  models: (t: string | null) => call<{ models: ModelInfo[]; latest: Partial<Record<ProviderId, string | null>> }>('/api/monitor/models', t),
  providers: (t: string | null) => call<ProviderConnection[]>('/api/monitor/providers', t),
  testProvider: (t: string | null, provider: ProviderId, apiKey: string, connectionType: 'api' | 'subscription' = 'api') =>
    call<{ valid: boolean }>(`/api/monitor/providers/${provider}/test`, t, json({ apiKey, connectionType })),
  saveProvider: (t: string | null, provider: ProviderId, apiKey: string, connectionType: 'api' | 'subscription' = 'api') =>
    call<ProviderConnection>(`/api/monitor/providers/${provider}`, t, json({ apiKey, connectionType })),
  removeProvider: (t: string | null, provider: ProviderId, connectionType: 'api' | 'subscription' = 'api') =>
    call<ProviderConnection>(`/api/monitor/providers/${provider}`, t, { method: 'DELETE', body: JSON.stringify({ connectionType }) }),

  verifyProvider: (t: string | null, provider: ProviderId) =>
    call<ProviderConnection>(`/api/monitor/providers/${provider}/verify`, t, json({})),
  chat: (t: string | null, body: { prompt: string; screenshot: string; model: ModelSelection; history: { role: 'user' | 'assistant'; content: string }[] }, signal: AbortSignal) =>
    call<{ text: string; provider: ProviderId; connectionType: 'api' | 'subscription' | 'local'; model: string }>('/api/monitor/chat', t, { ...json(body), signal }),
  deviceSubscription: (t: string | null) =>
    call<{ claude: { installed: boolean; authenticated: boolean; detail?: string }; codex: { installed: boolean; authenticated: boolean; detail?: string } }>('/api/monitor/device/subscription', t),

  // Projects
  projects: (t: string | null) => call<ConnectedProject[]>('/api/monitor/projects', t),
  githubStart: (t: string | null) => call<{ authorizeUrl: string }>('/api/monitor/github/authorize', t, json({})),
  githubComplete: (t: string | null, code: string, state: string) => call<{ login: string }>('/api/monitor/github/complete', t, json({ code, state })),
  githubRepos: (t: string | null, q = '') => call<GitHubRepo[]>(`/api/monitor/github/repos?q=${encodeURIComponent(q)}`, t),
  githubBranches: (t: string | null, repo: string) => call<string[]>(`/api/monitor/github/branches?repo=${encodeURIComponent(repo)}`, t),
  githubDisconnect: (t: string | null) => call<{ disconnected: boolean }>('/api/monitor/github/disconnect', t, { method: 'DELETE' }),
  connectProject: (t: string | null, body: { source: 'github' | 'git-url' | 'local'; repository: string; branch: string }) =>
    call<ConnectedProject>('/api/monitor/projects', t, json(body)),
  disconnectProject: (t: string | null, id: string) => call<{ id: string }>(`/api/monitor/projects/${encodeURIComponent(id)}`, t, { method: 'DELETE' }),

  // Device (local agent running on the user's computer)
  pairDevice: (t: string | null, name?: string) => call<{ deviceId: string; name: string; token: string }>('/api/monitor/device/pair', t, json({ name })),
  deviceStatus: (t: string | null) => call<DeviceStatus>('/api/monitor/device/status', t),

  // Agent (observe → reason → act → observe on the real computer)
  runTask: (
    t: string | null,
    body: { projectId?: string; prompt: string; model: ModelSelection; permissions: MonitorPermissions; screenshot?: string | null; maxActions?: number; monitorIndex?: number }
  ) => call<{ taskId: string }>('/api/monitor/agent/tasks', t, json(body)),
  getTask: (t: string | null, taskId: string) => call<import('./types').AgentTask>(`/api/monitor/agent/tasks/${encodeURIComponent(taskId)}`, t),
  stopTask: (t: string | null, taskId: string) => call<{ stopped: boolean }>(`/api/monitor/agent/tasks/${encodeURIComponent(taskId)}/stop`, t, json({})),
  approveTask: (t: string | null, taskId: string) => call<{ approved: boolean }>(`/api/monitor/agent/tasks/${encodeURIComponent(taskId)}/approve`, t, json({})),
  applyChanges: (t: string | null, changeSetId: string) => call<ChangeSet>(`/api/monitor/agent/changes/${changeSetId}/apply`, t, json({})),
  undo: (t: string | null, checkpointId: string) => call<{ restored: boolean }>(`/api/monitor/agent/checkpoints/${checkpointId}/restore`, t, json({})),
};

export interface DeviceStatus {
  paired: boolean;
  online: boolean;
  name: string | null;
  lastSeenAt?: string | null;
  monitors?: Array<{ index: number; name: string; width: number; height: number; primary?: boolean }>;
  agentRoot?: string | null;
  agentPlatform?: string | null;
}

export interface LocalCliStatus {
  claude: { installed: boolean; authenticated: boolean; detail?: string };
  codex: { installed: boolean; authenticated: boolean; detail?: string };
}

/** Provider display metadata. Model names come from the backend, not from here. */
export const PROVIDERS: { id: ProviderId; name: string; latestLabel: string; keyHint: string }[] = [
  { id: 'anthropic', name: 'Anthropic Claude', latestLabel: 'Claude — Latest', keyHint: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', latestLabel: 'OpenAI — Latest', keyHint: 'sk-…' },
  { id: 'xai', name: 'xAI Grok', latestLabel: 'Grok — Latest', keyHint: 'xai-…' },
];

export function selectionLabel(sel: ModelSelection, models: ModelInfo[]): string {
  if (sel.mode === 'auto') return 'Auto';
  const p = PROVIDERS.find((x) => x.id === sel.provider);
  if (sel.mode === 'latest') return `${p?.name.split(' ').pop()} · Latest`;
  if (sel.mode === 'local') return `${sel.provider === 'anthropic' ? 'Claude Code' : sel.provider === 'openai' ? 'Codex CLI' : p?.name} (this computer)`;
  return models.find((m) => m.modelId === sel.modelId)?.displayName ?? sel.modelId;
}
