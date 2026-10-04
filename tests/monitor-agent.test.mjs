// Automated QA for the Launchly Monitor local device agent (local-agent/agent.js).
// Uses only safe actions: arg validation, path-scoping, file round-trip inside a
// self-cleaning temp dir under the repo, a read-only screenshot, and an unknown-tool check.
// No mouse/keyboard input is ever executed by these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const TMP = path.join(REPO_ROOT, 'tests', '.tmp-monitor-agent');

test('agent refuses to start without pairing token/server and prints pairing help', () => {
  const env = { ...process.env };
  delete env.LAUNCHLY_AGENT_TOKEN;
  delete env.LAUNCHLY_AGENT_SERVER;
  delete env.LAUNCHLY_AGENT_NO_CONNECT;
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'local-agent', 'agent.js')], { encoding: 'utf8', env });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Pair this computer from Monitor/);
});

// Set before importing: the agent module connects on import unless told not to,
// and exits(1) when no pairing token/server is configured.
process.env.LAUNCHLY_AGENT_NO_CONNECT = '1';
if (!process.env.LAUNCHLY_AGENT_TOKEN) process.env.LAUNCHLY_AGENT_TOKEN = 'test-token';
if (!process.env.LAUNCHLY_AGENT_SERVER) process.env.LAUNCHLY_AGENT_SERVER = 'wss://example.invalid';
const { resolveScoped, handleTool, escApple, macAbs, macModifier, MAC_KEYCODES, cliclickArgs, classifyMacError, classifyCliError, subscriptionStatus, subscriptionExec } = await import('../local-agent/agent.js');

test('resolveScoped keeps file tools inside the project root', () => {
  assert.ok(resolveScoped('package.json').startsWith(REPO_ROOT));
  assert.throws(() => resolveScoped('../outside.txt'), /outside the connected project folder/);
  assert.throws(() => resolveScoped('C:\\Windows\\System32\\x'), /outside the connected project folder/);
});

test('file tools round-trip inside a scoped temp dir and reject escapes', async () => {
  mkdirSync(TMP, { recursive: true });
  try {
    const rel = path.relative(REPO_ROOT, TMP).replace(/\\/g, '/');
    const written = await handleTool('write_file', { path: `${rel}/note.txt`, content: 'hello monitor' });
    assert.match(written, /Wrote/);
    assert.equal(await handleTool('read_file', { path: `${rel}/note.txt` }), 'hello monitor');
    assert.match(await handleTool('list_directory', { path: rel }), /note\.txt/);
    await assert.rejects(handleTool('read_file', { path: '../package.json' }), /outside the connected project folder/);
  } finally {
    rmSync(TMP, { recursive: true, force: true });
  }
});

test('run_command executes in the project root and reports exit code', async () => {
  const out = await handleTool('run_command', { command: 'echo qa-ok' });
  assert.match(out, /exit 0/);
  assert.match(out, /qa-ok/);
});

test('unknown tools are rejected, never silently ignored', async () => {
  await assert.rejects(handleTool('delete_everything', {}), /Unknown tool/);
});

test('screenshot tool returns a real PNG data URL (read-only capture)', async () => {
  const shot = await handleTool('screenshot', { monitorIndex: 0 });
  assert.match(shot, /^data:image\/png;base64,[A-Za-z0-9+/=]{100,}$/);
});

test('mac helpers: escaping, coordinate math, modifiers, key codes', () => {
  assert.equal(escApple('say "hi" \\ bye'), 'say \\"hi\\" \\\\ bye');
  assert.equal(macAbs(500, 1920, 0), 960);
  assert.equal(macAbs(0, 1920, 100), 100);
  assert.equal(macAbs(1000, 1080, 0), 1080);
  assert.throws(() => macAbs('left', 100, 0), /0-1000/);
  assert.equal(macModifier('ctrl'), 'control down');
  assert.equal(macModifier('alt'), 'option down');
  assert.equal(macModifier('win'), 'command down');
  assert.equal(macModifier('cmd'), 'command down');
  assert.equal(macModifier('shift'), 'shift down');
  assert.equal(macModifier('x'), null);
  assert.equal(MAC_KEYCODES.enter, 36);
  assert.equal(MAC_KEYCODES.escape, 53);
  assert.equal(MAC_KEYCODES.f5, 96);
});

test('subscription CLI status reports installed/logged-in shape without credentials', async () => {
  const status = await subscriptionStatus();
  assert.equal(typeof status.claude.installed, 'boolean');
  assert.equal(typeof status.claude.authenticated, 'boolean');
  assert.equal(typeof status.codex.installed, 'boolean');
  assert.equal(typeof status.codex.authenticated, 'boolean');
  assert.ok(!JSON.stringify(status).includes('token'));
});

test('subscription exec validates input and classifies CLI failures', async () => {
  await assert.rejects(subscriptionExec('cursor', 'hi'), /claude.*codex/);
  await assert.rejects(subscriptionExec('claude', '   '), /Nothing to ask/);
  assert.equal(classifyCliError('claude', { stderr: 'Error: rate limit reached', stdout: '', error: null }), 'limited');
  assert.equal(classifyCliError('codex', { stderr: 'not logged in', stdout: '', error: null }), 'auth');
  assert.equal(classifyCliError('codex', { stderr: '', stdout: '', error: 'spawn codex ENOENT' }), 'missing');
  // On machines without the CLIs this exercises the real missing/inaccessible path.
  const st = await subscriptionStatus();
  const missingTool = !st.claude.installed ? 'claude' : !st.codex.installed ? 'codex' : null;
  if (missingTool) {
    await assert.rejects(subscriptionExec(missingTool, 'Explain this project'), /not installed|not authenticated/);
  }
  await assert.rejects(handleTool('subscription_exec', { tool: 'nope', prompt: 'hi' }), /Unknown tool|claude.*codex/);
});

test('mac helpers: cliclick args and permission errors', () => {
  assert.deepEqual(cliclickArgs('click', { x: 1, y: 2 }, 10, 20), ['c:10,20']);
  assert.deepEqual(cliclickArgs('mouse_move', {}, 0, 0), ['m:0,0']);
  assert.deepEqual(cliclickArgs('double_click', {}, 5, 6), ['dc:5,6']);
  assert.deepEqual(cliclickArgs('right_click', {}, 5, 6), ['rc:5,6']);
  assert.deepEqual(cliclickArgs('scroll', { direction: 'up', amount: 2 }, 0, 0), ['w:+240']);
  assert.deepEqual(cliclickArgs('scroll', { direction: 'down' }, 0, 0), ['w:-360']);
  assert.throws(() => cliclickArgs('scroll', { direction: 'sideways' }, 0, 0), /up or down/);
  assert.match(classifyMacError('execution error: Not authorised to send Apple events (-1743)'), /Accessibility/);
  assert.match(classifyMacError('some other failure'), /some other failure/);
});
