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

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'limited' | 'error';
export interface ProviderFailure {
  code: string;
  message: string;
  provider?: ProviderId;
  connectionType?: 'api' | 'subscription' | 'local';
  retryAfter?: string;
}

/** What the backend returns about a saved provider key — never the key itself. */
export interface ProviderConnection {
  provider: ProviderId;
  connected: boolean;
  keyLast4: string | null;
  connectionType?: 'api' | 'subscription' | 'local';
  state?: ConnectionState;
  message?: string;
}

/**
 * How Monitor picks a model:
 *  - auto:   backend picks the recommended coding model across connected providers
 *  - latest: newest recommended model of one provider (moves when the provider ships a new one)
 *  - exact:  a pinned modelId that never changes on its own
 *  - local:  the official provider CLI installed on the user's own computer,
 *             billed to the user's own subscription login (never touches Launchly servers)
 */
export type ModelSelection =
  | { mode: 'auto' }
  | { mode: 'latest'; provider: ProviderId }
  | { mode: 'exact'; provider: ProviderId; modelId: string }
  | { mode: 'local'; provider: ProviderId };

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
  viewScreen: boolean;
  controlMouse: boolean;
  controlKeyboard: boolean;
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
  viewScreen: true,
  controlMouse: true,
  controlKeyboard: true,
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
  | 'commit_changes'
  | 'screenshot'
  | 'mouse_move'
  | 'click'
  | 'double_click'
  | 'right_click'
  | 'type'
  | 'keypress'
  | 'hotkey'
  | 'scroll'
  | 'wait'
  | 'subscription_status'
  | 'subscription_exec';

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

export type AgentStatus = 'idle' | 'working' | 'awaiting-approval' | 'done' | 'error' | 'stopped';

/** The exact action the backend paused on, so the UI can name it honestly. */
export interface PendingApproval {
  actionId: string;
  tool: AgentTool;
  label: string;
  input: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  prompt: string;
  status: AgentStatus;
  activity: ToolActivity[];
  changes: ChangeSet | null;
  error: string | null;
  screenshot: string | null;
  actionsExecuted: number;
  maxActions: number;
  /** Set by the server only while status is 'awaiting-approval'. */
  pendingApproval?: PendingApproval | null;
  providerFailure?: ProviderFailure;
}

/** Result wrapper: every backend call either succeeds or says honestly why not. */
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  reason?: 'not_configured' | 'unauthorized' | 'unavailable' | 'error';
  message?: string;
  failure?: ProviderFailure;
}

export interface MonitorBackendStatus {
  online: boolean;
  capabilities: { github: boolean; gitUrl: boolean; localBridge: boolean; agent: boolean; providerKeys: boolean; screenControl: boolean };
}

/** Screen action types returned by the AI */
export type ScreenAction =
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'click'; x: number; y: number; button?: 'left' | 'right' }
  | { type: 'double_click'; x: number; y: number }
  | { type: 'right_click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'keypress'; key: string }
  | { type: 'hotkey'; keys: string[] }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'wait'; duration: number }
  | { type: 'screenshot' }
  | { type: 'done' }
  | { type: 'ask_user'; question: string };

export interface ScreenActionResult {
  success: boolean;
  screenshot?: string;
  error?: string;
}
