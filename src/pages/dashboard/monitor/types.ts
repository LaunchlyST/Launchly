/**
 * Monitor project/agent types. One place for every piece of Monitor state so
 * the UI never scatters loose booleans around.
 */

export type ProviderId = 'anthropic' | 'openai' | 'xai';

/** A model the backend says a provider offers. Never hard-coded in the UI. */
export interface ModelInfo {
  provider: ProviderId;
  modelId: string;
  displayName: string;
  family: string;
  capabilities: Array<'coding' | 'vision' | 'chat' | 'tools'>;
  recommended: boolean;
  available: boolean;
}

/** What the backend returns about a saved provider key — never the key itself. */
export interface ProviderConnection {
  provider: ProviderId;
  connected: boolean;
  keyLast4: string | null;
}

/**
 * How Monitor picks a model:
 *  - auto:   backend picks the recommended coding model across connected providers
 *  - latest: newest recommended model of one provider (moves when the provider ships a new one)
 *  - exact:  a pinned modelId that never changes on its own
 */
export type ModelSelection =
  | { mode: 'auto' }
  | { mode: 'latest'; provider: ProviderId }
  | { mode: 'exact'; provider: ProviderId; modelId: string };

export type ProjectSource = 'github' | 'local' | 'git-url';

export interface ConnectedProject {
  id: string;
  source: ProjectSource;
  name: string;
  /** owner/repo for GitHub, URL for git-url, folder label for local. */
  repository: string;
  branch: string;
  status: 'synced' | 'syncing' | 'error';
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string | null;
}

export interface MonitorPermissions {
  readFiles: boolean;
  searchFiles: boolean;
  editFiles: boolean;
  createFiles: boolean;
  runDevCommands: boolean;
  installPackages: boolean;
  autoCommit: boolean;
  autoPush: boolean;
  autoDeploy: boolean;
  editMode: 'ask' | 'auto';
}

export const DEFAULT_PERMISSIONS: MonitorPermissions = {
  readFiles: true,
  searchFiles: true,
  editFiles: true,
  createFiles: true,
  runDevCommands: true,
  installPackages: false,
  autoCommit: false,
  autoPush: false,
  autoDeploy: false,
  editMode: 'ask',
};

/** Server-controlled tools the agent may call. The model never runs code in the browser. */
export type AgentTool =
  | 'search_files'
  | 'read_file'
  | 'write_file'
  | 'create_file'
  | 'delete_file'
  | 'list_directory'
  | 'git_status'
  | 'git_diff'
  | 'run_command'
  | 'run_build'
  | 'run_tests'
  | 'commit_changes';

export interface ToolActivity {
  id: string;
  tool: AgentTool | 'understand';
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface FileDiff {
  path: string;
  added: number;
  removed: number;
  /** Unified diff text for this file. */
  patch: string;
}

export interface ChangeSet {
  id: string;
  files: FileDiff[];
  checks: { name: string; passed: boolean }[];
  applied: boolean;
  checkpointId: string;
}

export interface Checkpoint {
  id: string;
  createdAt: string;
  label: string;
}

export type AgentStatus = 'idle' | 'working' | 'awaiting-approval' | 'done' | 'error';

export interface AgentTask {
  id: string;
  prompt: string;
  status: AgentStatus;
  activity: ToolActivity[];
  changes: ChangeSet | null;
  error: string | null;
}

/** Result wrapper: every backend call either succeeds or says honestly why not. */
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  reason?: 'not_configured' | 'unauthorized' | 'unavailable' | 'error';
  message?: string;
}

export interface MonitorBackendStatus {
  online: boolean;
  capabilities: { github: boolean; gitUrl: boolean; localBridge: boolean; agent: boolean; providerKeys: boolean };
}
