#!/usr/bin/env node
// Launchly local agent — run this on your own computer.
//
// It opens one outbound, authenticated WebSocket to the Launchly backend and
// waits for tool calls from the AI you selected in Monitor:
//   files: read_file, write_file, list_directory, run_command
//   screen: screenshot, mouse_move, click, double_click, right_click,
//           type, keypress, hotkey, scroll, wait
//
// Every file path is resolved against --root and rejected if it would escape
// that folder. Screen input only runs when the matching permission is on
// (the backend validates first; this agent enforces single-flight too).
//
// Usage:
//   node agent.js --root "C:\Users\you\Launchly" --token <paste from Monitor> [--server wss://...]
//
// Requires Windows PowerShell for screen control (mouse/keyboard/screenshot).

import WebSocket from 'ws';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

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

const isWindows = os.platform() === 'win32';

/** Resolves a tool-supplied relative path and refuses anything that would escape `root`. */
function resolveScoped(rel) {
  const target = path.resolve(root, rel || '.');
  const withSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(withSep)) throw new Error(`"${rel}" is outside the connected project folder.`);
  return target;
}

function runCommand(command, cwd) {
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

function ps(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 30000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

const PS_PREAMBLE = `
Add-Type -AssemblyName System.Windows.Forms, System.Drawing;
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinIn {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
}
"@;
function To-Abs($rel, $total) { return [int]($rel / 1000 * $total); }
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$VK = @{ backspace=8; tab=9; enter=13; escape=27; home=36; end=35; pageup=33; pagedown=34; delete=46;
  arrowup=38; arrowdown=40; arrowleft=37; arrowright=39;
  f1=112; f2=113; f3=114; f4=115; f5=116; f6=117; f7=118; f8=119; f9=120; f10=121; f11=122; f12=123 };
`;

function escPs(s) {
  return String(s ?? '').replace(/'/g, "''");
}

async function screenshot() {
  if (!isWindows) throw new Error('Screenshots need Windows PowerShell on this computer.');
  const out = await ps(`${PS_PREAMBLE}
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height);
$g = [System.Drawing.Graphics]::FromImage($bmp);
$g.CopyFromScreen($b.Location, (New-Object System.Drawing.Point(0,0)), $b.Size);
$ms = New-Object System.IO.MemoryStream;
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
$g.Dispose(); $bmp.Dispose();
[Convert]::ToBase64String($ms.ToArray());`);
  if (!out) throw new Error('Screenshot came back empty.');
  return `data:image/png;base64,${out.replace(/\s+/g, '')}`;
}

async function mouseAt(x, y) {
  const xi = Math.min(1000, Math.max(0, Number(x)));
  const yi = Math.min(1000, Math.max(0, Number(y)));
  if (!Number.isFinite(xi) || !Number.isFinite(yi)) throw new Error('Coordinates must be 0-1000.');
  await ps(`${PS_PREAMBLE}
[WinIn]::SetCursorPos((To-Abs ${xi} $bounds.Width), (To-Abs ${yi} $bounds.Height)) | Out-Null;`);
}

async function mouseClick(kind) {
  const map = { left: [0x02, 0x04], right: [0x08, 0x10] };
  const [down, up] = map[kind] || map.left;
  await ps(`${PS_PREAMBLE}
[WinIn]::mouse_event(${down}, 0, 0, 0, 0); Start-Sleep -Milliseconds 60; [WinIn]::mouse_event(${up}, 0, 0, 0, 0);`);
}

async function typeText(text) {
  const t = String(text ?? '');
  if (!t) throw new Error('Nothing to type.');
  if (t.length > 500) throw new Error('Text too long (max 500 chars).');
  await ps(`${PS_PREAMBLE}
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait('${escPs(t).replace(/([+^%~{}()])/g, '{$1}')}');`);
}

const KEYMAP = { enter: '{ENTER}', tab: '{TAB}', escape: '{ESC}', backspace: '{BACKSPACE}', delete: '{DELETE}', home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}', arrowup: '{UP}', arrowdown: '{DOWN}', arrowleft: '{LEFT}', arrowright: '{RIGHT}', f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}', f5: '{F5}', f6: '{F6}', f7: '{F7}', f8: '{F8}', f9: '{F9}', f10: '{F10}', f11: '{F11}', f12: '{F12}' };

async function keypress(key) {
  const k = String(key ?? '').toLowerCase();
  if (!KEYMAP[k]) throw new Error(`Key "${key}" is not allowed.`);
  await ps(`${PS_PREAMBLE}
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait('${KEYMAP[k]}');`);
}

async function hotkey(keys) {
  const list = Array.isArray(keys) ? keys : [];
  if (list.length < 1 || list.length > 3) throw new Error('Hotkey must have 1-3 keys.');
  const combo = list.join('+').toLowerCase();
  if (/ctrl\+alt\+(del|delete)/.test(combo)) throw new Error('That key combination is blocked.');
  const parts = list.map((k) => {
    const lk = String(k).toLowerCase();
    if (lk === 'ctrl') return '^';
    if (lk === 'alt') return '%';
    if (lk === 'shift') return '+';
    if (lk === 'win') return '^({ESC})';
    if (/^f\d{1,2}$/.test(lk)) return `{${lk.toUpperCase()}}`;
    if (lk.length === 1) return lk;
    if (KEYMAP[lk]) return KEYMAP[lk];
    throw new Error(`Key "${k}" is not allowed in hotkeys.`);
  });
  await ps(`${PS_PREAMBLE}
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait('${escPs(parts.join(''))}');`);
}

async function scroll(direction, amount) {
  const dir = String(direction ?? '').toLowerCase();
  if (dir !== 'up' && dir !== 'down') throw new Error('Scroll direction must be up or down.');
  const clicks = Math.min(10, Math.max(1, Math.round(Number(amount) || 3)));
  const data = dir === 'up' ? 120 : -120;
  await ps(`${PS_PREAMBLE}
for ($i = 0; $i -lt ${clicks}; $i++) { [WinIn]::mouse_event(0x0800, 0, 0, ${data}, 0); Start-Sleep -Milliseconds 40; }`);
}

let busy = false;

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
  if (name === 'screenshot') return await screenshot();
  if (['mouse_move', 'click', 'double_click', 'right_click', 'type', 'keypress', 'hotkey', 'scroll', 'wait'].includes(name)) {
    if (busy) throw new Error('Another input action is still running.');
    busy = true;
    try {
      if (name === 'mouse_move') { await mouseAt(input.x, input.y); return `Moved to ${input.x}, ${input.y}`; }
      if (name === 'click') { await mouseAt(input.x, input.y); await mouseClick('left'); return `Clicked ${input.x}, ${input.y}`; }
      if (name === 'double_click') { await mouseAt(input.x, input.y); await mouseClick('left'); await mouseClick('left'); return `Double-clicked ${input.x}, ${input.y}`; }
      if (name === 'right_click') { await mouseAt(input.x, input.y); await mouseClick('right'); return `Right-clicked ${input.x}, ${input.y}`; }
      if (name === 'type') { await typeText(input.text); return `Typed ${String(input.text).length} chars`; }
      if (name === 'keypress') { await keypress(input.key); return `Pressed ${input.key}`; }
      if (name === 'hotkey') { await hotkey(input.keys); return `Pressed ${(input.keys || []).join('+')}`; }
      if (name === 'scroll') { await scroll(input.direction, input.amount); return `Scrolled ${input.direction}`; }
      if (name === 'wait') {
        const d = Math.min(10000, Math.max(100, Number(input.duration) || 500));
        await new Promise((r) => setTimeout(r, d));
        return `Waited ${d}ms`;
      }
    } finally {
      busy = false;
    }
  }
  throw new Error(`Unknown tool: ${name}`);
}

function connect() {
  const url = `${server.replace(/\/$/, '')}/api/monitor/device/connect?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  ws.on('open', () => {
    console.log(`Connected. Serving project root: ${root}`);
    console.log(`Screen control: ${isWindows ? 'enabled (Windows PowerShell)' : 'UNAVAILABLE (needs Windows)'}`);
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
