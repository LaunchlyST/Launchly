/**
 * DeviceSession — one Durable Object instance per paired computer.
 *
 * Holds the live WebSocket to that computer's local agent (`local-agent/agent.js`)
 * in memory, runs the AI tool-calling loop for coding tasks, and forwards each
 * tool call (read_file / write_file / run_command / list_directory) to the agent
 * over that socket, waiting for its real result before continuing. If the
 * agent isn't connected, tool calls fail with a real error and the task ends
 * in 'error' — nothing here is simulated.
 *
 * One instance per device (idFromName(deviceId)), so a device's connection
 * and its tasks always live in the same isolate — no cross-user or
 * cross-device leakage is possible through this object.
 *
 * The exposed task shape matches the frontend's AgentTask/ToolActivity types
 * (src/pages/dashboard/monitor/types.ts) exactly, so MonitorPanel needs no
 * changes to consume it.
 */

export interface DeviceSessionEnv {}

type AgentStatus = 'idle' | 'working' | 'awaiting-approval' | 'done' | 'error';
type ToolStatus = 'pending' | 'running' | 'done' | 'error';
type ToolName = 'read_file' | 'write_file' | 'list_directory' | 'run_command';

interface ToolActivity {
  id: string;
  tool: ToolName | 'understand';
  label: string;
  status: ToolStatus;
}

interface Task {
  id: string;
  prompt: string;
  status: AgentStatus;
  activity: ToolActivity[];
  changes: null;
  error: string | null;
}

const TOOLS: { name: ToolName; description: string; input_schema: any }[] = [
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
    description: 'Run a shell command in the connected project root (e.g. npm run dev, git status). Use sparingly, and never destructive commands.',
    input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
  },
];

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
      server.addEventListener('message', (ev) => this.onAgentMessage(ev));
      server.addEventListener('close', () => {
        if (this.agentSocket === server) this.agentSocket = null;
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/status') {
      return json({ online: !!this.agentSocket });
    }

    if (url.pathname === '/tasks' && request.method === 'POST') {
      const body = (await request.json()) as { taskId: string; prompt: string; apiKey: string; model: string };
      if (!this.agentSocket) return json({ error: 'Computer disconnected' }, 409);
      const task: Task = { id: body.taskId, prompt: body.prompt, status: 'idle', activity: [], changes: null, error: null };
      await this.saveTask(task);
      this.runTask(body.taskId, body.prompt, body.apiKey, body.model).catch(() => {});
      return json({ taskId: body.taskId });
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
  }

  /** Sends a tool call to the connected agent and waits for its real result. Throws if no agent is connected. */
  private callTool(name: ToolName, input: any, timeoutMs = 45000): Promise<any> {
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

  /** Appends a step, or (with sameId) flips the last step's status in place — this is what MonitorPanel renders as "Reading src/pages/Dashboard.tsx", etc. */
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

  /** The real AI tool-calling loop: Anthropic Messages API, tools dispatched to the live agent socket. */
  private async runTask(taskId: string, prompt: string, apiKey: string, model: string) {
    if (!this.agentSocket) {
      await this.updateTask(taskId, { status: 'error', error: 'Computer disconnected' });
      return;
    }
    await this.updateTask(taskId, { status: 'working' });
    await this.setActivity(taskId, 'understand', 'Understanding request…', 'running');
    const messages: any[] = [{ role: 'user', content: prompt }];

    for (let turn = 0; turn < 20; turn++) {
      let res: Response;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            system:
              "You are editing a real project on the user's computer through the connected tools. Only touch files inside the project root. Explain briefly, then act.",
            tools: TOOLS,
            messages,
          }),
        });
      } catch {
        await this.updateTask(taskId, { status: 'error', error: 'Could not reach the AI provider.' });
        return;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        await this.updateTask(taskId, { status: 'error', error: `AI provider error (${res.status}): ${body.slice(0, 300)}` });
        return;
      }
      const data: any = await res.json();
      messages.push({ role: 'assistant', content: data.content });

      const toolUses = (data.content ?? []).filter((b: any) => b.type === 'tool_use');
      if (!toolUses.length) {
        const text = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
        await this.updateTask(taskId, { status: 'done', error: null });
        await this.setActivity(taskId, 'understand', text || 'Done.', 'done');
        return;
      }

      const toolResults: any[] = [];
      for (const use of toolUses) {
        if (!this.agentSocket) {
          await this.updateTask(taskId, { status: 'error', error: 'Computer disconnected mid-task' });
          return;
        }
        const label = describeTool(use.name, use.input);
        const stepId = await this.setActivity(taskId, use.name, label, 'running');
        try {
          const result = await this.callTool(use.name, use.input);
          toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: typeof result === 'string' ? result : JSON.stringify(result) });
          await this.setActivity(taskId, use.name, label, 'done', stepId);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Tool failed.';
          toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: message, is_error: true });
          await this.setActivity(taskId, use.name, label, 'error', stepId);
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }
    await this.updateTask(taskId, { status: 'error', error: 'Stopped after too many steps.' });
  }
}

function describeTool(name: ToolName, input: any): string {
  if (name === 'read_file') return `Reading ${input?.path}`;
  if (name === 'write_file') return `Editing ${input?.path}`;
  if (name === 'list_directory') return `Listing ${input?.path || '.'}`;
  if (name === 'run_command') return `Running ${input?.command}`;
  return name;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
