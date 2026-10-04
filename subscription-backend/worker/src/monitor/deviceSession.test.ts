import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceSession } from './deviceSession.ts';

test('preserves provider limits through asynchronous device-task polling', async () => {
  const store = new Map();
  const state: any = { storage: { get: async (key: string) => store.get(key), put: async (key: string, value: any) => store.set(key, value) } };
  const device: any = new DeviceSession(state, {});
  device.agentSocket = {};
  await device.saveTask({ id: 't1', prompt: 'Click', status: 'idle', activity: [], changes: null, error: null, actionsExecuted: 0, maxActions: 30 });
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { type: 'rate_limit_error' } }), { status: 429 });
    await device.runControlLoop('t1', 'Click', 'sk-test-key', 'claude-test-model', 'anthropic', 'data:image/png;base64,AAAA', {});
    const task = await device.loadTask('t1');
    assert.equal(task.status, 'error');
    assert.equal(task.providerFailure.code, 'PROVIDER_LIMITED');
    assert.equal(task.providerFailure.connectionType, 'api');
    assert.equal(task.providerFailure.provider, 'anthropic');
  } finally { globalThis.fetch = original; }
});

test('live frames are counted and the latest is served to the browser', async () => {
  const store = new Map();
  const state: any = { storage: { get: async (key: string) => store.get(key), put: async (key: string, value: any) => store.set(key, value) } };
  const device: any = new DeviceSession(state, {});
  const waiting = await device.fetch(new Request('https://device-session/frames/latest'));
  assert.equal((await waiting.json()).waiting, true);
  device.onAgentMessage({ data: JSON.stringify({ type: 'frame', seq: 1, ts: 1000, monitor: 0, width: 960, image: 'data:image/png;base64,AAAA', bytes: 3000 }) } as any);
  device.onAgentMessage({ data: JSON.stringify({ type: 'frame', seq: 2, ts: 2000, monitor: 0, width: 960, image: 'data:image/png;base64,BBBB', bytes: 3100 }) } as any);
  const latest = await device.fetch(new Request('https://device-session/frames/latest'));
  const body: any = await latest.json();
  assert.equal(body.waiting, false);
  assert.equal(body.received, 2);
  assert.equal(body.frame.seq, 2);
  assert.equal(body.frame.bytes, 3100);
});

test('stream control reaches the device agent as a tool call', async () => {
  const { device, sent } = fakeDevice();
  const startedP = device.fetch(new Request('https://device-session/stream', { method: 'POST', body: JSON.stringify({ on: true, fps: 0.5, width: 960, monitor: 1 }) }));
  const startCall = await waitForCall(sent, 'stream_start');
  assert.deepEqual(startCall.input, { fps: 0.5, width: 960, monitor: 1 });
  startCall.answered = true;
  device.onAgentMessage({ data: JSON.stringify({ type: 'tool_result', callId: startCall.callId, result: 'Streaming 0.5 fps' }) } as any);
  assert.equal((await startedP).status, 200);
  const stoppedP = device.fetch(new Request('https://device-session/stream', { method: 'POST', body: JSON.stringify({ on: false }) }));
  const stopCall = await waitForCall(sent, 'stream_stop');
  stopCall.answered = true;
  device.onAgentMessage({ data: JSON.stringify({ type: 'tool_result', callId: stopCall.callId, result: 'Stream stopped.' }) } as any);
  assert.equal((await stoppedP).status, 200);
});

async function waitForCall(sent: any[], name: string, timeoutMs = 5000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const call = sent.find((m) => m.type === 'tool_call' && m.name === name && !m.answered);
    if (call) return call;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for tool call ${name}`);
}

function fakeDevice() {
  const store = new Map();
  const state: any = { storage: { get: async (key: string) => store.get(key), put: async (key: string, value: any) => store.set(key, value) } };
  const device: any = new DeviceSession(state, {});
  const sent: any[] = [];
  device.agentSocket = { send: (text: string) => sent.push(JSON.parse(text)) };
  return { device, sent };
}

const autoPerms = { runDevCommands: true, editMode: 'auto', viewScreen: true, controlMouse: true, controlKeyboard: true };

test('local CLI task runs the official CLI on the device and reports changed files', async () => {
  const { device, sent } = fakeDevice();
  await device.saveTask({ id: 't-local', prompt: 'Fix the login bug', status: 'working', activity: [], changes: null, error: null, screenshot: null, actionsExecuted: 0, maxActions: 30, connectionType: 'local', project: { id: 'p', source: 'github', name: 'demo', repository: 'tester/demo', branch: 'main' } });
  const run = device.runLocalCliTask('t-local', 'Fix the login bug', 'anthropic', autoPerms);
  const exec = await waitForCall(sent, 'subscription_exec');
  assert.deepEqual(exec.input.tool, 'claude');
  assert.match(exec.input.prompt, /tester\/demo/);
  exec.answered = true;
  device.onAgentMessage({ data: JSON.stringify({ type: 'tool_result', callId: exec.callId, result: 'Fixed null check in login.ts' }) } as any);
  const git = await waitForCall(sent, 'run_command');
  git.answered = true;
  device.onAgentMessage({ data: JSON.stringify({ type: 'tool_result', callId: git.callId, result: 'exit 0\n--- stdout ---\n M login.ts\n--- stderr ---\n' }) } as any);
  await run;
  const task = await device.loadTask('t-local');
  assert.equal(task.status, 'done');
  assert.match(task.activity[task.activity.length - 1].label, /Fixed null check/);
  assert.match(task.activity[task.activity.length - 1].label, /login\.ts/);
});

test('local CLI usage limits surface the API-key fallback failure', async () => {
  const { device, sent } = fakeDevice();
  await device.saveTask({ id: 't-limited', prompt: 'Fix it', status: 'working', activity: [], changes: null, error: null, screenshot: null, actionsExecuted: 0, maxActions: 30, connectionType: 'local' });
  const run = device.runLocalCliTask('t-limited', 'Fix it', 'openai', autoPerms);
  const exec = await waitForCall(sent, 'subscription_exec');
  assert.deepEqual(exec.input.tool, 'codex');
  exec.answered = true;
  device.onAgentMessage({ data: JSON.stringify({ type: 'tool_result', callId: exec.callId, error: '[SUBSCRIPTION_LIMITED] quota exhausted' }) } as any);
  await run;
  const task = await device.loadTask('t-limited');
  assert.equal(task.status, 'error');
  assert.equal(task.error, 'Subscription usage unavailable or limit reached. Switch to API key?');
  assert.equal(task.providerFailure.code, 'PROVIDER_LIMITED');
  assert.equal(task.providerFailure.connectionType, 'local');
});

test('local CLI task is blocked without the dev-commands permission', async () => {
  const { device, sent } = fakeDevice();
  await device.saveTask({ id: 't-blocked', prompt: 'Fix it', status: 'working', activity: [], changes: null, error: null, screenshot: null, actionsExecuted: 0, maxActions: 30, connectionType: 'local' });
  await device.runLocalCliTask('t-blocked', 'Fix it', 'anthropic', { ...autoPerms, runDevCommands: false });
  const task = await device.loadTask('t-blocked');
  assert.equal(task.status, 'error');
  assert.equal(sent.length, 0);
});

test('screenshot tool calls carry the task monitor index to the real agent', async () => {
  const store = new Map();
  const state: any = { storage: { get: async (key: string) => store.get(key), put: async (key: string, value: any) => store.set(key, value) } };
  const device: any = new DeviceSession(state, {});
  const sent: any[] = [];
  device.agentSocket = { send: (text: string) => sent.push(JSON.parse(text)) };
  const pending = device.callTool('screenshot', { monitorIndex: 2 }, 5000);
  const call = sent.find((m) => m.type === 'tool_call');
  assert.equal(call.name, 'screenshot');
  assert.deepEqual(call.input, { monitorIndex: 2 });
  device.onAgentMessage({ data: JSON.stringify({ type: 'tool_result', callId: call.callId, result: 'data:image/png;base64,AAAA' }) } as any);
  assert.equal(await pending, 'data:image/png;base64,AAAA');
});
