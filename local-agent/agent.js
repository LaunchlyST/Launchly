#!/usr/bin/env node
// Launchly local agent — run this on your own computer.
//
// It opens one outbound, authenticated WebSocket to the Launchly backend and
// waits for tool calls from the AI you selected in Monitor: read_file,
// write_file, list_directory, run_command. Every path is resolved against
// --root and rejected if it would escape that folder — this agent will
// never touch anything outside the project you connected.
//
// Usage:
//   node agent.js --root "C:\Users\you\Launchly" --token <paste from Monitor> [--server wss://launchly-subscription-worker.<account>.workers.dev]
//
// Get --token and --server from Monitor → Connect project → Connect a folder
// on this computer → "Connect this computer" (device pairing).

import WebSocket from 'ws';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const root = path.resolve(arg('root', process.cwd()));
const token = arg('token', process.env.LAUNCHLY_AGENT_TOKEN);
const server = arg('server', process.env.LAUNCHLY_AGENT_SERVER);

if (!token || !server) {
  console.error('Missing --token or --server. Pair this computer from Monitor first, then run:');
  console.error('  node agent.js --root "<your project folder>" --token <token> --server <wss://... from Monitor>');
  process.exit(1);
}

/** Resolves a tool-supplied relative path and refuses anything that would escape `root`. */
function resolveScoped(rel) {
  const target = path.resolve(root, rel || '.');
  const withSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(withSep)) throw new Error(`"${rel}" is outside the connected project folder.`);
  return target;
}

async function runCommand(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, timeout: 120000 });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ code, stdout: out.slice(-8000), stderr: err.slice(-4000) }));
    child.on('error', (e) => resolve({ code: -1, stdout: out, stderr: String(e) }));
  });
}

async function handleTool(name, input) {
  if (name === 'read_file') {
    const p = resolveScoped(input.path);
    return await readFile(p, 'utf8');
  }
  if (name === 'write_file') {
    const p = resolveScoped(input.path);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, input.content ?? '', 'utf8');
    return `Wrote ${input.path} (${(input.content ?? '').length} bytes)`;
  }
  if (name === 'list_directory') {
    const p = resolveScoped(input.path || '.');
    const entries = await readdir(p, { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n') || '(empty)';
  }
  if (name === 'run_command') {
    const result = await runCommand(input.command, root);
    return `exit ${result.code}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`;
  }
  throw new Error(`Unknown tool: ${name}`);
}

function connect() {
  const url = `${server.replace(/\/$/, '')}/api/monitor/device/connect?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  ws.on('open', () => {
    console.log(`Connected. Serving project root: ${root}`);
  });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== 'tool_call') return;
    console.log(`→ ${msg.name} ${JSON.stringify(msg.input)}`);
    try {
      const result = await handleTool(msg.name, msg.input || {});
      ws.send(JSON.stringify({ type: 'tool_result', callId: msg.callId, result }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'tool_result', callId: msg.callId, error: e instanceof Error ? e.message : String(e) }));
    }
  });

  ws.on('close', () => {
    console.log('Disconnected. Reconnecting in 3s…');
    setTimeout(connect, 3000);
  });

  ws.on('error', (e) => {
    console.error('Connection error:', e.message);
  });
}

connect();
