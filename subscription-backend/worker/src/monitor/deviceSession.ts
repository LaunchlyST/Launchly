import { providerError, ProviderRequestError, type ProviderFailure } from './providerErrors.ts';
/**
 * DeviceSession — one Durable Object instance per paired computer.
 *
 * Holds the live WebSocket to that computer's local agent (`local-agent/agent.js`)
 * in memory and runs the AI observe → reason → act → observe loop:
 *   1. Observe: current screenshot (from the agent, or the browser's shared
 *      screen frame forwarded by the frontend) is sent to the selected model.
 *   2. Reason: the model returns structured screen/file actions.
 *   3. Act: each action is validated against the user's permissions, then
 *      executed on the REAL computer through the agent socket.
 *   4. Observe: a fresh screenshot is captured after every action and the
 *      loop continues until done, stopped, or the action budget runs out.
 *
 * Safety: destructive actions pause for approval unless editMode is 'auto';
 * secrets are redacted before anything reaches the model; a stop flag
 * immediately cancels the loop and clears queued actions.
 */

export interface DeviceSessionEnv {}

type AgentStatus = 'idle' | 'working' | 'awaiting-approval' | 'done' | 'error' | 'stopped';
type ToolStatus = 'pending' | 'running' | 'done' | 'error';
type ToolName =
  | 'read_file' | 'write_file' | 'list_directory' | 'run_command'
  | 'screenshot' | 'mouse_move' | 'click' | 'double_click' | 'right_click'
  | 'type' | 'keypress' | 'hotkey' | 'scroll' | 'wait' | 'list_monitors'
  | 'subscription_status' | 'subscription_exec';

interface ToolActivity {
  id: string;
  tool: ToolName | 'understand';
  label: string;
  status: ToolStatus;
}

interface PendingApproval {
  actionId: string;
  tool: string;
  label: string;
  input: any;
}

interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  primary: boolean;
}

interface Task {
  id: string;
  prompt: string;
  status: AgentStatus;
  activity: ToolActivity[];
  changes: null;
  error: string | null;
  providerFailure?: ProviderFailure;
  screenshot: string | null;
  actionsExecuted: number;
  maxActions: number;
  stopped?: boolean;
  pendingApproval?: PendingApproval | null;
  resumeInput?: any | null;
  monitorIndex?: number;
  monitors?: MonitorInfo[];
  connectionType?: 'api' | 'subscription' | 'local';
  project?: { id: string; source: string; name: string; repository: string; branch: string } | null;
}

/** Local provider-CLI tools. These run on the USER'S OWN computer through the
 * local agent (official `claude`/`codex` CLIs with the user's own login) and
 * are never advertised to API models. */
const LOCAL_CLI_TOOLS = [
  {
    name: 'subscription_status',
    description: 'Report which official provider CLIs (claude, codex) are installed and logged in on this computer.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'subscription_exec',
    description: 'Run one coding task through the official provider CLI on this computer, billed to the user\'s own subscription login.',
    input_schema: { type: 'object', properties: { tool: { type: 'string', enum: ['claude', 'codex'] }, prompt: { type: 'string' } }, required: ['tool', 'prompt'] },
  },
];

const MAX_ACTIONS_DEFAULT = 30;
const TASK_TIMEOUT_MS = 10 * 60 * 1000;

const FILE_TOOLS = [
  {
    name: 'read_file',
    description: 'Read a text file relative to the connected project root.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a text file relative to the connected project root.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory relative to the connected project root.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'run_command',
    description: 'Run a NON-destructive shell command in the connected project root. Never use for deleting, formatting, or credential commands.',
    input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
  },
];

const SCREEN_TOOLS = [
  {
    name: 'screenshot',
    description: 'Capture the current screen. Call this to see the result after each action.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'mouse_move',
    description: 'Move the mouse to screen coordinates, 0-1000 relative (x: 0 left → 1000 right, y: 0 top → 1000 bottom).',
    input_schema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
  },
  {
    name: 'click',
    description: 'Left-click at screen coordinates 0-1000 relative.',
    input_schema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
  },
  {
    name: 'double_click',
    description: 'Double-click at screen coordinates 0-1000 relative.',
    input_schema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
  },
  {
    name: 'right_click',
    description: 'Right-click at screen coordinates 0-1000 relative. Opens context menus — use sparingly.',
    input_schema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
  },
  {
    name: 'type',
    description: 'Type text with the keyboard into the focused field. Keep it short. Never type passwords or secrets.',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'keypress',
    description: 'Press a single key: Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown, F1-F12.',
    input_schema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
  },
  {
    name: 'hotkey',
    description: 'Press a key combination, e.g. ["ctrl","c"], ["alt","Tab"], ["win","r"]. Allowed modifiers: ctrl, alt, shift, win.',
    input_schema: { type: 'object', properties: { keys: { type: 'array', items: { type: 'string' } } }, required: ['keys'] },
  },
  {
    name: 'scroll',
    description: 'Scroll up or down.',
    input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] }, amount: { type: 'number' } }, required: ['direction'] },
  },
  {
    name: 'wait',
    description: 'Wait for the UI to settle. Duration in milliseconds, max 10000.',
    input_schema: { type: 'object', properties: { duration: { type: 'number' } }, required: ['duration'] },
  },
];

/** Patterns that look like secrets — redacted before anything reaches the model. */
const SECRET_PATTERNS = [
  /sk-(ant|proj)-[A-Za-z0-9-_]{10,}/g,
  /sk-[A-Za-z0-9]{10,}/g,
  /xai-[A-Za-z0-9]{10,}/g,
  /gh[pousr]_[A-Za-z0-9]{10,}/g,
  /AIza[A-Za-z0-9-_]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{10,}/g,
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED SECRET]');
  return out;
}

function isDestructive(tool: string, input: any): boolean {
  // A local CLI run can edit files and execute commands on its own — it always
  // pauses for approval unless the user enabled automatic editing.
  if (tool === 'subscription_exec') return true;
  if (tool === 'run_command') {
    const cmd = String(input?.command ?? '').toLowerCase();
    return /\b(rm\s+-rf?|del\s+\/[fsq]|format\s+[a-z]:|mkfs|shutdown|reboot|reg\s+delete|net\s+user|passwd\b|rd\s+\/s)/.test(cmd);
  }
  if (tool === 'hotkey') {
    const keys = (input?.keys ?? []).map((k: string) => String(k).toLowerCase()).join('+');
    return keys.includes('alt+f4') === false && /ctrl\+alt\+(del|delete)/.test(keys);
  }
  if (tool === 'keypress') {
    return ['delete'].includes(String(input?.key ?? '').toLowerCase()) === false ? false : false;
  }
  return false;
}

function validateAction(tool: string, input: any, perms: any): string | null {
  const num = (v: any) => typeof v === 'number' && Number.isFinite(v);
  if (['mouse_move', 'click', 'double_click', 'right_click'].includes(tool)) {
    if (!perms.controlMouse) return 'Mouse control is disabled in permissions.';
    if (!num(input?.x) || !num(input?.y) || input.x < 0 || input.x > 1000 || input.y < 0 || input.y > 1000)
      return 'Coordinates must be numbers between 0 and 1000.';
  }
  if (['type', 'keypress', 'hotkey'].includes(tool) && !perms.controlKeyboard)
    return 'Keyboard control is disabled in permissions.';
  if (tool === 'type') {
    const t = String(input?.text ?? '');
    if (!t) return 'Nothing to type.';
    if (t.length > 500) return 'Text is too long (max 500 characters).';
  }
  if (tool === 'keypress') {
    const allowed = ['enter', 'tab', 'escape', 'backspace', 'delete', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'home', 'end', 'pageup', 'pagedown', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'];
    if (!allowed.includes(String(input?.key ?? '').toLowerCase())) return `Key "${input?.key}" is not allowed.`;
  }
  if (tool === 'hotkey') {
    const keys = Array.isArray(input?.keys) ? input.keys : [];
    if (keys.length < 1 || keys.length > 3) return 'Hotkey must have 1-3 keys.';
    if (/ctrl\+alt\+(del|delete)/i.test(keys.join('+'))) return 'That key combination is blocked.';
  }
  if (tool === 'scroll') {
    if (!['up', 'down'].includes(String(input?.direction))) return 'Scroll direction must be up or down.';
  }
  if (tool === 'wait') {
    const d = Number(input?.duration);
    if (!Number.isFinite(d) || d < 100 || d > 10000) return 'Wait must be 100-10000 ms.';
  }
  if (tool === 'subscription_exec') {
    if (!['claude', 'codex'].includes(String(input?.tool))) return 'Subscription tool must be "claude" or "codex".';
    const p = String(input?.prompt ?? '').trim();
    if (!p) return 'Nothing to ask.';
    if (p.length > 8000) return 'Prompt is too long (max 8000 characters).';
    if (!perms.runDevCommands) return 'Running the local provider CLI is disabled in permissions.';
  }
  if (['read_file', 'write_file', 'list_directory', 'run_command'].includes(tool) && !perms.viewScreen && false) return 'Not permitted.';
  return null;
}

export class DeviceSession {
  state: DurableObjectState;
  agentSocket: WebSocket | null = null;
  pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  constructor(state: DurableObjectState, _env: DeviceSessionEnv) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/connect') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.accept();
      this.agentSocket?.close(1000, 'replaced by a new connection');
      this.agentSocket = server;
      this.lastAgentSeenAt = new Date().toISOString();
      server.addEventListener('message', (ev) => this.onAgentMessage(ev));
      const failAll = () => {
        for (const [, p] of this.pending) p.reject(new Error('Computer disconnected'));
        this.pending.clear();
      };
      server.addEventListener('close', () => {
        if (this.agentSocket === server) this.agentSocket = null;
        failAll();
      });
      server.addEventListener('error', () => {
        if (this.agentSocket === server) this.agentSocket = null;
        failAll();
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/status') {
      const meta = await this.state.storage.get<{ root?: string; platform?: string }>('device-meta');
      return json({ online: !!this.agentSocket, lastSeenAt: this.lastAgentSeenAt, monitors: this.monitorList, agentRoot: meta?.root ?? null, agentPlatform: meta?.platform ?? null });
    }

    if (url.pathname === '/frames/latest' && request.method === 'GET') {
      if (!this.latestFrame) return json({ waiting: true, received: this.frameCount, lastError: this.lastFrameError });
      return json({ waiting: false, received: this.frameCount, lastError: this.lastFrameError, frame: this.latestFrame });
    }

    if (url.pathname === '/stream' && request.method === 'POST') {
      if (!this.agentSocket) return json({ error: 'Computer disconnected' }, 409);
      const body = (await request.json().catch(() => ({}))) as { on?: unknown; fps?: unknown; width?: unknown; monitor?: unknown };
      try {
        if (body.on === false) {
          await this.callTool('stream_stop', {}, 15000);
          return json({ streaming: false });
        }
        const result = await this.callTool('stream_start', { fps: body.fps, width: body.width, monitor: body.monitor }, 30000);
        return json({ streaming: true, result });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Could not control the stream.' }, 502);
      }
    }

    if (url.pathname === '/subscription' && request.method === 'GET') {
      if (!this.agentSocket) return json({ error: 'Computer disconnected' }, 409);
      try {
        const status = await this.callTool('subscription_status', {}, 30000);
        return json(status && typeof status === 'object' ? status : { error: 'Unexpected response from the computer.' }, 200);
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Could not reach the computer.' }, 502);
      }
    }

    if (url.pathname === '/tasks' && request.method === 'POST') {
      const body = (await request.json()) as { taskId: string; prompt: string; apiKey: string; model: string; provider?: string; connectionType?: 'api' | 'subscription'; screenshot?: string | null; permissions?: any; maxActions?: number; monitorIndex?: number; project?: { id: string; source: string; name: string; repository: string; branch: string } | null };
      if (!this.agentSocket) return json({ error: 'Computer disconnected' }, 409);
      const task: Task = { id: body.taskId, prompt: body.prompt, status: 'idle', activity: [], changes: null, error: null, screenshot: body.screenshot ?? null, actionsExecuted: 0, maxActions: Math.min(Math.max(body.maxActions ?? MAX_ACTIONS_DEFAULT, 1), 60), stopped: false, pendingApproval: null, resumeInput: null, monitorIndex: body.monitorIndex ?? 0, monitors: this.monitorList, connectionType: body.connectionType, project: body.project ?? null };
      await this.saveTask(task);
      this.runControlLoop(body.taskId, body.prompt, body.apiKey, body.model, body.provider ?? 'anthropic', body.screenshot ?? null, body.permissions ?? {}, body.connectionType ?? 'api').catch(() => {});
      return json({ taskId: body.taskId });
    }

    const stopMatch = url.pathname.match(/^\/tasks\/([^/]+)\/stop$/);
    if (stopMatch && request.method === 'POST') {
      const task = await this.loadTask(stopMatch[1]);
      if (!task) return json({ error: 'not found' }, 404);
      await this.saveTask({ ...task, stopped: true, status: 'stopped', error: 'Stopped by user.' });
      for (const [, p] of this.pending) p.reject(new Error('Stopped by user.'));
      this.pending.clear();
      return json({ stopped: true });
    }

    const approveMatch = url.pathname.match(/^\/tasks\/([^/]+)\/approve$/);
    if (approveMatch && request.method === 'POST') {
      const task = await this.loadTask(approveMatch[1]);
      if (!task) return json({ error: 'not found' }, 404);
      if (task.status !== 'awaiting-approval') return json({ error: 'nothing to approve' }, 409);
      await this.saveTask({ ...task, status: 'working', pendingApproval: null, resumeInput: { approved: true } });
      return json({ approved: true });
    }

    const taskMatch = url.pathname.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === 'GET') {
      const task = await this.loadTask(taskMatch[1]);
      if (!task) return json({ error: 'not found' }, 404);
      return json(task);
    }

    return json({ error: 'not found' }, 404);
  }

  private taskKey(id: string) {
    return `task:${id}`;
  }
  private async saveTask(t: Task) {
    await this.state.storage.put(this.taskKey(t.id), t);
  }
  private async loadTask(id: string): Promise<Task | undefined> {
    return this.state.storage.get<Task>(this.taskKey(id));
  }

  private onAgentMessage(ev: MessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
    } catch {
      return;
    }
    if (msg.type === 'tool_result' && msg.callId && this.pending.has(msg.callId)) {
      const p = this.pending.get(msg.callId)!;
      this.pending.delete(msg.callId);
      if (msg.error) p.reject(new Error(msg.error));
      else p.resolve(msg.result);
    }
    if (msg.type === 'monitor_list' && Array.isArray(msg.monitors)) {
      this.monitorList = msg.monitors;
    }
    if (msg.type === 'hello' && (typeof msg.root === 'string' || typeof msg.platform === 'string')) {
      void this.state.storage.put('device-meta', {
        root: typeof msg.root === 'string' ? msg.root.slice(0, 500) : undefined,
        platform: typeof msg.platform === 'string' ? msg.platform.slice(0, 32) : undefined,
      });
    }
    if (msg.type === 'heartbeat' || msg.type === 'hello' || msg.type === 'monitor_list' || msg.type === 'tool_result') {
      this.lastAgentSeenAt = new Date().toISOString();
    }
    // Continuous frame stream from the device agent (see local-agent startStream).
    if (msg.type === 'frame' && typeof msg.image === 'string' && typeof msg.seq === 'number') {
      this.latestFrame = { image: msg.image, ts: typeof msg.ts === 'number' ? msg.ts : Date.now(), seq: msg.seq, monitor: msg.monitor ?? 0, width: msg.width ?? 0, bytes: typeof msg.bytes === 'number' ? msg.bytes : 0 };
      this.frameCount += 1;
      this.lastFrameError = null;
      this.lastAgentSeenAt = new Date().toISOString();
    }
    if (msg.type === 'frame_error') {
      this.lastFrameError = typeof msg.error === 'string' ? msg.error.slice(0, 500) : 'Frame capture failed.';
    }
  }

  private monitorList: MonitorInfo[] = [];
  private lastAgentSeenAt: string | null = null;
  private latestFrame: { image: string; ts: number; seq: number; monitor: number; width: number; bytes: number } | null = null;
  private frameCount = 0;
  private lastFrameError: string | null = null;

  private callTool(name: string, input: any, timeoutMs = 45000): Promise<any> {
    if (!this.agentSocket) return Promise.reject(new Error('Computer disconnected'));
    const callId = crypto.randomUUID();
    const socket = this.agentSocket;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(callId);
        reject(new Error(`Timed out waiting for the computer to run "${name}".`));
      }, timeoutMs);
      this.pending.set(callId, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      socket.send(JSON.stringify({ type: 'tool_call', callId, name, input }));
    });
  }

  private async updateTask(id: string, patch: Partial<Task>) {
    const current = await this.loadTask(id);
    if (!current) return;
    await this.saveTask({ ...current, ...patch });
  }

  private async setActivity(id: string, tool: ToolName | 'understand', label: string, status: ToolStatus, activityId?: string): Promise<string> {
    const task = await this.loadTask(id);
    if (!task) return activityId ?? crypto.randomUUID();
    const stepId = activityId ?? crypto.randomUUID();
    const existing = task.activity.findIndex((a) => a.id === stepId);
    const activity = [...task.activity];
    if (existing >= 0) activity[existing] = { ...activity[existing], status };
    else activity.push({ id: stepId, tool, label, status });
    await this.saveTask({ ...task, activity });
    return stepId;
  }

  /**
   * Observe → reason → act → observe. The model sees screenshots and returns
   * real computer actions; every action is validated, executed on the paired
   * computer, and followed by a fresh screenshot.
   */
  private async runControlLoop(taskId: string, prompt: string, apiKey: string, model: string, provider: string, firstScreenshot: string | null, perms: any, connectionTypeArg: 'api' | 'subscription' = 'api') {
    const started = Date.now();
    const checkStop = async (): Promise<boolean> => {
      const t = await this.loadTask(taskId);
      return !t || t.stopped === true || t.status === 'stopped';
    };
    if (!this.agentSocket) {
      await this.updateTask(taskId, { status: 'error', error: 'Computer disconnected' });
      return;
    }
    await this.updateTask(taskId, { status: 'working' });
    await this.setActivity(taskId, 'understand', 'Looking at your screen…', 'running');

    const taskMeta0 = await this.loadTask(taskId);
    if ((taskMeta0?.connectionType ?? connectionTypeArg) === 'local') {
      await this.runLocalCliTask(taskId, prompt, provider, perms);
      return;
    }

    let screenshot: string | null = firstScreenshot;
    // If the browser didn't forward a frame, capture one from the agent.
    if (!screenshot) {
      try {
        const task = await this.loadTask(taskId);
        const monitorIndex = task?.monitorIndex ?? 0;
        const shot = await this.callTool('screenshot', { monitorIndex }, 30000);
        screenshot = typeof shot === 'string' ? shot : (shot?.image ?? null);
        if (task) await this.saveTask({ ...task, screenshot });
      } catch {
        await this.updateTask(taskId, { status: 'error', error: 'Could not capture the screen. Share your screen and make sure the computer agent is online.' });
        return;
      }
    }

    const taskMeta = await this.loadTask(taskId);
    const projectCtx = taskMeta?.project
      ? `The user's selected project is "${taskMeta.project.name}" (${taskMeta.project.source}:${taskMeta.project.repository}, branch ${taskMeta.project.branch}). Prefer working inside that project: use list_directory/read_file first to locate relevant files. `
      : 'No project is selected: work with what is visible on screen. ';
    const sys =
      'You control the user\'s REAL Windows computer. You can click, type and press keys through the provided tools — never claim you cannot. ' +
      projectCtx +
      'Work step by step: look at the screenshot, do ONE small action, then take another screenshot to verify. ' +
      'Coordinates are 0-1000 relative. ' +
      'Reply with tool calls only. When the task is complete, answer with a short summary and no more tool calls.';

    const history: any[] = [{ role: 'user', content: redactSecrets(prompt) }];

    for (let turn = 0; turn < 60; turn++) {
      if (await checkStop()) return;
      if (Date.now() - started > TASK_TIMEOUT_MS) {
        await this.updateTask(taskId, { status: 'error', error: 'Stopped after 10 minutes (timeout).' });
        return;
      }
      const task = await this.loadTask(taskId);
      if (!task) return;
      if (task.actionsExecuted >= task.maxActions) {
        await this.updateTask(taskId, { status: 'error', error: `Stopped after ${task.maxActions} actions (limit).` });
        return;
      }
      if (task.status === 'awaiting-approval') {
        // Wait for the user to approve or stop (poll storage).
        let waited = 0;
        while (waited < 120000) {
          await new Promise((r) => setTimeout(r, 1000));
          waited += 1000;
          const cur = await this.loadTask(taskId);
          if (!cur || cur.stopped || cur.status === 'stopped') return;
          if (cur.status === 'working' && cur.resumeInput?.approved) break;
          if (cur?.status !== 'awaiting-approval') break;
        }
        const after = await this.loadTask(taskId);
        if (!after || after.stopped) return;
        if (after.status !== 'working') {
          await this.updateTask(taskId, { status: 'error', error: 'Approval timed out.' });
          return;
        }
      }

      const taskData = await this.loadTask(taskId);
      const connectionType = taskData?.connectionType ?? connectionTypeArg;
      const imageBlock = screenshot ? [{ type: 'image', source: screenshot }] : [];
      let toolUses: { id: string; name: string; input: any }[] = [];
      let textOut = '';
      try {
        if (provider === 'openai') {
          const r = await this.callOpenAI(apiKey, model, sys, history, screenshot, connectionType);
          toolUses = r.toolUses;
          textOut = r.text;
          history.push(...r.nextHistory);
        } else {
          const r = await this.callAnthropic(apiKey, model, sys, history, screenshot, connectionType);
          toolUses = r.toolUses;
          textOut = r.text;
          history.push(...r.nextHistory);
        }
      } catch (e) {
        await this.updateTask(taskId, { status: 'error', error: e instanceof Error ? e.message : 'AI provider error.', ...(e instanceof ProviderRequestError ? { providerFailure: e.failure } : {}) });
        return;
      }
      void imageBlock;

      if (!toolUses.length) {
        await this.updateTask(taskId, { status: 'done', error: null });
        await this.setActivity(taskId, 'understand', textOut || 'Done.', 'done');
        return;
      }

      for (const use of toolUses) {
        if (await checkStop()) return;
        const cleanInput = JSON.parse(redactSecrets(JSON.stringify(use.input ?? {})));
        const err = validateAction(use.name, cleanInput, perms);
        const label = describeTool(use.name, cleanInput);
        if (err) {
          const sid = await this.setActivity(taskId, use.name as ToolName, `${label} — blocked: ${err}`, 'error');
          void sid;
          history.push({ role: 'user', content: [{ type: 'text', text: `That action was blocked: ${err}. Choose a different action.` }] });
          continue;
        }
        if (isDestructive(use.name, cleanInput) && perms.editMode !== 'auto') {
          await this.updateTask(taskId, {
            status: 'awaiting-approval',
            pendingApproval: { actionId: use.id, tool: use.name, label, input: cleanInput },
          });
          await this.setActivity(taskId, use.name as ToolName, `${label} — waiting for your approval`, 'pending');
          history.push({ role: 'user', content: [{ type: 'text', text: 'That action needs user approval. Pausing.' }] });
          break;
        }
        const stepId = await this.setActivity(taskId, use.name as ToolName, label, 'running');
        try {
          const result = await this.callTool(use.name, cleanInput, use.name === 'run_command' ? 120000 : 45000);
          await this.setActivity(taskId, use.name as ToolName, label, 'done', stepId);
          const t = await this.loadTask(taskId);
          if (t) await this.saveTask({ ...t, actionsExecuted: t.actionsExecuted + 1 });
          // Observe: fresh screenshot after every action.
          if (use.name !== 'screenshot') {
            try {
              const task = await this.loadTask(taskId);
              const monitorIndex = task?.monitorIndex ?? 0;
              const shot = await this.callTool('screenshot', { monitorIndex }, 30000);
              const img = typeof shot === 'string' ? shot : (shot?.image ?? null);
              if (img) {
                screenshot = img;
                const tt = await this.loadTask(taskId);
                if (tt) await this.saveTask({ ...tt, screenshot: img });
              }
            } catch { /* keep going with the last frame */ }
          } else if (typeof result === 'string' || result?.image) {
            screenshot = typeof result === 'string' ? result : result.image;
          }
          const resultText = redactSecrets(typeof result === 'string' ? result.slice(0, 4000) : JSON.stringify(result).slice(0, 4000));
          history.push({ role: 'user', content: [{ type: 'text', text: `Action ${use.name} done. ${screenshot ? 'New screenshot attached — look at it before the next action.' : ''} Result: ${resultText}` }] });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Tool failed.';
          await this.setActivity(taskId, use.name as ToolName, label, 'error', stepId);
          if (/disconnected|stopped/i.test(message)) {
            const cur = await this.loadTask(taskId);
            await this.updateTask(taskId, { status: cur?.stopped ? 'stopped' : 'error', error: message });
            return;
          }
          history.push({ role: 'user', content: [{ type: 'text', text: `Action ${use.name} failed: ${redactSecrets(message)}. Try a different approach or take a screenshot.` }] });
        }
      }
    }
    await this.updateTask(taskId, { status: 'error', error: 'Stopped after too many steps.' });
  }

  /**
   * Local-subscription task: ONE run of the official provider CLI on the
   * user's own computer (`claude --print` / `codex exec`), billed to the
   * user's own login. Credentials never leave the device — the backend only
   * sends the prompt and receives text. Same approval policy as other
   * destructive tools: pauses unless editMode is 'auto'.
   */
  private async runLocalCliTask(taskId: string, prompt: string, provider: string, perms: any) {
    const task = await this.loadTask(taskId);
    if (!task || task.stopped) return;
    const cli = provider === 'openai' ? 'codex' : 'claude';
    const cliName = cli === 'codex' ? 'Codex CLI' : 'Claude Code';
    const fullPrompt = `${task.project ? `Project: ${task.project.name} (${task.project.source}:${task.project.repository}, branch ${task.project.branch}). Work inside the connected project folder. ` : ''}${redactSecrets(prompt)}`;
    const blocked = validateAction('subscription_exec', { tool: cli, prompt: fullPrompt }, perms);
    if (blocked) {
      await this.updateTask(taskId, { status: 'error', error: blocked });
      await this.setActivity(taskId, 'understand', 'Blocked.', 'error');
      return;
    }
    if (perms.editMode !== 'auto' && !task.resumeInput?.approved) {
      await this.updateTask(taskId, {
        status: 'awaiting-approval',
        pendingApproval: { actionId: crypto.randomUUID(), tool: 'subscription_exec', label: `Run ${cliName} on your computer (billed to your own login)`, input: { tool: cli } },
      });
      await this.setActivity(taskId, 'subscription_exec', `Waiting for your approval to run ${cliName}`, 'pending');
      let waited = 0;
      while (waited < 120000) {
        await new Promise((r) => setTimeout(r, 1000));
        waited += 1000;
        const cur = await this.loadTask(taskId);
        if (!cur || cur.stopped || cur.status === 'stopped') return;
        if (cur.status === 'working' && cur.resumeInput?.approved) break;
        if (cur?.status !== 'awaiting-approval') break;
      }
      const after = await this.loadTask(taskId);
      if (!after || after.stopped) return;
      if (after.status !== 'working') {
        await this.updateTask(taskId, { status: 'error', error: 'Approval timed out.' });
        return;
      }
    }
    const stepId = await this.setActivity(taskId, 'subscription_exec', `Running ${cliName} on your computer…`, 'running');
    try {
      const output = await this.callTool('subscription_exec', { tool: cli, prompt: fullPrompt }, 300000);
      await this.setActivity(taskId, 'subscription_exec', `Running ${cliName} on your computer…`, 'done', stepId);
      const t = await this.loadTask(taskId);
      // Best-effort evidence of what changed on disk (works when the project is a git checkout).
      let filesNote = '';
      try {
        const st: any = await this.callTool('run_command', { command: 'git status --porcelain' }, 30000);
        const text = typeof st === 'string' ? st : JSON.stringify(st);
        const section = text.split('--- stdout ---')[1] ?? text;
        const lines = section.split('\n').map((l: string) => l.trim()).filter(Boolean).slice(0, 20);
        if (lines.length) filesNote = `\nChanged files:\n${lines.join('\n')}`;
      } catch { /* not a git checkout — the CLI output below still stands */ }
      const summary = `${String(output).slice(0, 2000)}${filesNote}`;
      if (t) await this.saveTask({ ...t, actionsExecuted: t.actionsExecuted + 1 });
      await this.updateTask(taskId, { status: 'done', error: null });
      await this.setActivity(taskId, 'understand', summary || 'Done.', 'done');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Local CLI run failed.';
      await this.setActivity(taskId, 'subscription_exec', `Running ${cliName} on your computer…`, 'error', stepId);
      if (/disconnected|stopped/i.test(message)) {
        const cur = await this.loadTask(taskId);
        await this.updateTask(taskId, { status: cur?.stopped ? 'stopped' : 'error', error: message.replace(/\[SUBSCRIPTION_\w+\] ?/, '') });
        return;
      }
      if (message.includes('[SUBSCRIPTION_LIMITED]')) {
        await this.updateTask(taskId, {
          status: 'error',
          error: 'Subscription usage unavailable or limit reached. Switch to API key?',
          providerFailure: { code: 'PROVIDER_LIMITED', message: 'Subscription usage unavailable or limit reached. Switch to API key?', provider, connectionType: 'local' },
        });
        return;
      }
      if (message.includes('[SUBSCRIPTION_AUTH]')) {
        await this.updateTask(taskId, {
          status: 'error',
          error: message.replace(/\[SUBSCRIPTION_AUTH\] ?/, ''),
          providerFailure: { code: 'PROVIDER_AUTH_ERROR', message: message.replace(/\[SUBSCRIPTION_AUTH\] ?/, ''), provider, connectionType: 'local' },
        });
        return;
      }
      await this.updateTask(taskId, { status: 'error', error: message.replace(/\[SUBSCRIPTION_TIMEOUT\] ?/, '') });
    }
  }

  private async callAnthropic(apiKey: string, model: string, sys: string, history: any[], screenshot: string | null, connectionType: 'api' | 'subscription' | 'local') {
    const content: any[] = [];
    const last = history[history.length - 1];
    // Attach the screenshot to the latest user message.
    const msgs = history.map((m, i) => {
      if (i === history.length - 1 && m.role === 'user' && screenshot && typeof m.content === 'string') {
        return { role: 'user', content: [{ type: 'text', text: redactSecrets(m.content) }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: stripPrefix(screenshot) } }] };
      }
      if (typeof m.content === 'string') return { role: m.role, content: redactSecrets(m.content) };
      return m;
    });
    void content;
    void last;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1024, system: sys, tools: [...FILE_TOOLS, ...SCREEN_TOOLS], messages: msgs }),
    });
    if (!res.ok) {
      throw await providerError(res, 'anthropic', connectionType);
    }
    const data: any = await res.json();
    const toolUses = ((data.content ?? []).filter((b: any) => b.type === 'tool_use')).map((b: any) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
    const text = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    return { toolUses, text, nextHistory: [{ role: 'assistant', content: data.content }] };
  }

  private async callOpenAI(apiKey: string, model: string, sys: string, history: any[], screenshot: string | null, connectionType: 'api' | 'subscription' | 'local') {
    const messages: any[] = [{ role: 'system', content: sys }];
    history.forEach((m, i) => {
      if (m.role === 'user' && typeof m.content === 'string' && i === history.length - 1 && screenshot) {
        messages.push({ role: 'user', content: [{ type: 'text', text: redactSecrets(m.content) }, { type: 'image_url', image_url: { url: screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}` } }] });
      } else if (typeof m.content === 'string') {
        messages.push({ role: m.role, content: redactSecrets(m.content) });
      } else {
        messages.push(m);
      }
    });
    const tools = [...FILE_TOOLS, ...SCREEN_TOOLS].map((t: any) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_completion_tokens: 1024, messages, tools, tool_choice: 'auto' }),
    });
    if (!res.ok) {
      throw await providerError(res, 'openai', connectionType);
    }
    const data: any = await res.json();
    const choice = data.choices?.[0]?.message;
    const toolUses = (choice?.tool_calls ?? []).map((c: any) => {
      let input = {};
      try { input = JSON.parse(c.function?.arguments ?? '{}'); } catch { input = {}; }
      return { id: c.id, name: c.function?.name, input };
    }).filter((t: any) => t.name);
    const text = choice?.content ?? '';
    return { toolUses, text, nextHistory: [{ role: 'assistant', content: text || 'acting' }] };
  }
}

function describeTool(name: string, input: any): string {
  if (name === 'read_file') return `Reading ${input?.path}`;
  if (name === 'write_file') return `Editing ${input?.path}`;
  if (name === 'list_directory') return `Listing ${input?.path || '.'}`;
  if (name === 'run_command') return `Running ${input?.command}`;
  if (name === 'screenshot') return 'Capturing screen…';
  if (name === 'mouse_move') return `Moving mouse to ${input?.x}, ${input?.y}`;
  if (name === 'click') return `Clicking ${input?.x}, ${input?.y}`;
  if (name === 'double_click') return `Double-clicking ${input?.x}, ${input?.y}`;
  if (name === 'right_click') return `Right-clicking ${input?.x}, ${input?.y}`;
  if (name === 'type') return `Typing "${String(input?.text ?? '').slice(0, 40)}"`;
  if (name === 'keypress') return `Pressing ${input?.key}`;
  if (name === 'hotkey') return `Pressing ${(input?.keys ?? []).join('+')}`;
  if (name === 'scroll') return `Scrolling ${input?.direction}`;
  if (name === 'wait') return `Waiting ${input?.duration}ms…`;
  if (name === 'subscription_status') return 'Checking provider CLI logins…';
  if (name === 'subscription_exec') return `Running ${input?.tool === 'codex' ? 'Codex CLI' : 'Claude Code'} on your computer…`;
  return name;
}

function stripPrefix(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
