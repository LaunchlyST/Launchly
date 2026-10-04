#!/usr/bin/env node
// Launchly local agent — run this on your own computer.
//
// It opens one outbound, authenticated WebSocket to the Launchly backend and
// waits for tool calls from the AI you selected in Monitor:
//   files: read_file, write_file, list_directory, run_command
//   screen: screenshot, mouse_move, click, double_click, right_click,
//           type, keypress, hotkey, scroll, wait
//   provider CLIs (your own logins, credentials never leave this computer):
//           subscription_status, subscription_exec (official `claude` / `codex`)
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
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
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
const monitorIndex = Number(arg('monitor', '0')) || 0; // 0 = primary, 1 = secondary, etc.

if (!token || !server) {
  console.error('Missing --token or --server. Pair this computer from Monitor first, then run:');
  console.error('  node agent.js --root "<your project folder>" --token <token> --server <wss://... from Monitor> [--monitor <index>]');
  process.exit(1);
}

const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';

/** macOS input control.
 *
 * Stock macOS ships no CLI for the mouse, so this uses two native mechanisms:
 * - AppleScript (System Events) via `osascript` — built in. Handles typing,
 *   key presses and hotkeys. Requires Accessibility permission for the
 *   terminal/Node process; without it macOS refuses with error -1743.
 * - `cliclick` (https://github.com/BlueM/cliclick, `brew install cliclick`)
 *   when installed — handles move/click/double-click/right-click/scroll.
 * Without cliclick, mouse actions fail with an explicit install message
 * instead of pretending to work.
 */
function osa(script) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(classifyMacError(stderr.trim() || err.message)));
      else resolve(stdout.trim());
    });
  });
}

/** Maps a macOS authorization failure to an actionable message. Pure (tested). */
function classifyMacError(message) {
  const m = String(message ?? '');
  if (/-1743|-1719|not authorized|not authorised|accessibility/i.test(m)) {
    return 'macOS blocked the action: grant Accessibility permission to your terminal/Node app in System Settings → Privacy & Security → Accessibility, then retry.';
  }
  if (/screen recording/i.test(m)) {
    return `${m} (grant Screen Recording permission in System Settings → Privacy & Security → Screen Recording if captures fail)`;
  }
  return m;
}

/** AppleScript string escaping. Pure (tested). */
function escApple(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Main-display bounds as {x, y, w, h} via Finder (origin usually 0,0). */
async function macDisplayBounds() {
  const out = await osa('tell application "Finder" to get bounds of window of desktop');
  const parts = out.split(',').map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) throw new Error('Could not read the display size.');
  const [x0, y0, x1, y1] = parts;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 0-1000 relative → absolute pixels. Pure (tested). */
function macAbs(rel, total, origin) {
  const r = Math.min(1000, Math.max(0, Number(rel)));
  if (!Number.isFinite(r)) throw new Error('Coordinates must be 0-1000.');
  return Math.round(origin + (r / 1000) * total);
}

/** True when the optional cliclick helper is installed. */
async function hasCliclick() {
  return new Promise((resolve) => {
    execFile('cliclick', ['m:.'], { timeout: 10000 }, (err) => resolve(!err));
  });
}

/** Build cliclick args for one action. Pure (tested). */
function cliclickArgs(name, input, ax, ay) {
  if (name === 'mouse_move') return [`m:${ax},${ay}`];
  if (name === 'click') return [`c:${ax},${ay}`];
  if (name === 'double_click') return [`dc:${ax},${ay}`];
  if (name === 'right_click') return [`rc:${ax},${ay}`];
  if (name === 'scroll') {
    const dir = String(input?.direction ?? '').toLowerCase();
    if (dir !== 'up' && dir !== 'down') throw new Error('Scroll direction must be up or down.');
    const amount = Math.min(10, Math.max(1, Math.round(Number(input?.amount) || 3)));
    return [`w:${dir === 'up' ? '+' : '-'}${amount * 120}`];
  }
  throw new Error(`Unknown mouse action: ${name}`);
}

async function macMouse(name, input) {
  if (!(await hasCliclick())) {
    throw new Error('Mouse control on Mac needs the free cliclick tool: run `brew install cliclick`, then retry. (Typing and hotkeys work without it once Accessibility permission is granted.)');
  }
  const b = await macDisplayBounds();
  const ax = macAbs(input?.x ?? 500, b.w, b.x);
  const ay = macAbs(input?.y ?? 500, b.h, b.y);
  await new Promise((resolve, reject) => {
    execFile('cliclick', cliclickArgs(name, input, ax, ay), { timeout: 30000 }, (err, _o, stderr) => {
      if (err) reject(new Error(classifyMacError(stderr.trim() || err.message)));
      else resolve(undefined);
    });
  });
  return name === 'mouse_move' ? `Moved to ${input.x}, ${input.y}` : `${name} at ${input.x}, ${input.y}`;
}

/** macOS virtual key codes for `key code`. Pure map (tested). */
const MAC_KEYCODES = {
  enter: 36, tab: 48, escape: 53, backspace: 51, delete: 117, home: 115, end: 119,
  pageup: 116, pagedown: 121, arrowup: 126, arrowdown: 125, arrowleft: 123, arrowright: 124, space: 49,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
};

async function macType(text) {
  const t = String(text ?? '');
  if (!t) throw new Error('Nothing to type.');
  if (t.length > 500) throw new Error('Text too long (max 500 chars).');
  // keystroke mishandles newlines: type line by line, pressing Return between them.
  const lines = t.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) await osa(`tell application "System Events" to keystroke "${escApple(lines[i])}"`);
    if (i < lines.length - 1) await osa('tell application "System Events" to key code 36');
  }
  return `Typed ${t.length} chars`;
}

async function macKeypress(key) {
  const k = String(key ?? '').toLowerCase();
  if (!(k in MAC_KEYCODES)) throw new Error(`Key "${key}" is not allowed.`);
  await osa(`tell application "System Events" to key code ${MAC_KEYCODES[k]}`);
  return `Pressed ${key}`;
}

/** Modifier name → AppleScript `using` term. Pure (tested). */
function macModifier(k) {
  const lk = String(k).toLowerCase();
  if (lk === 'ctrl') return 'control down';
  if (lk === 'alt') return 'option down';
  if (lk === 'shift') return 'shift down';
  if (lk === 'win' || lk === 'cmd' || lk === 'command') return 'command down';
  return null;
}

async function macHotkey(keys) {
  const list = Array.isArray(keys) ? keys : [];
  if (list.length < 1 || list.length > 3) throw new Error('Hotkey must have 1-3 keys.');
  const combo = list.join('+').toLowerCase();
  if (/ctrl\+alt\+(del|delete)/.test(combo)) throw new Error('That key combination is blocked.');
  const mods = [];
  let main = null;
  for (const k of list) {
    const mod = macModifier(k);
    if (mod && !main) { mods.push(mod); continue; }
    if (mod && main) { mods.push(mod); continue; }
    const lk = String(k).toLowerCase();
    if (/^f\d{1,2}$/.test(lk) && lk in MAC_KEYCODES) { main = { code: MAC_KEYCODES[lk] }; continue; }
    if (lk.length === 1) { main = { char: lk }; continue; }
    if (lk in MAC_KEYCODES) { main = { code: MAC_KEYCODES[lk] }; continue; }
    throw new Error(`Key "${k}" is not allowed in hotkeys.`);
  }
  if (!main) throw new Error('Hotkey needs a main key.');
  const using = mods.length ? ` using {${mods.join(', ')}}` : '';
  if (main.char) await osa(`tell application "System Events" to keystroke "${escApple(main.char)}"${using}`);
  else await osa(`tell application "System Events" to key code ${main.code}${using}`);
  return `Pressed ${(keys || []).join('+')}`;
}

/** macOS screen capture via the built-in `screencapture` tool (no dependencies).
 * Captures the main display to a temp file, returns a data URL, cleans up. */
function macScreenshot() {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `launchly-shot-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`);
    execFile('screencapture', ['-x', '-t', 'png', tmp], { timeout: 30000 }, async (err, _stdout, stderr) => {
      if (err) return reject(new Error(((stderr || '').trim() || err.message) + ' (grant Screen Recording permission to Terminal/Node if captures fail)'));
      try {
        const bytes = await readFile(tmp);
        await unlink(tmp).catch(() => {});
        if (!bytes.length) return reject(new Error('Screenshot came back empty.'));
        resolve(`data:image/png;base64,${bytes.toString('base64')}`);
      } catch (e) {
        reject(new Error(e instanceof Error ? e.message : String(e)));
      }
    });
  });
}

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

/** Local provider-CLI subscription support.
 *
 * When the user has the OFFICIAL Claude Code (`claude`) or Codex (`codex`)
 * CLI installed AND logged in with their own account/subscription on THIS
 * computer, Launchly can run coding tasks through it. Authentication stays
 * entirely on the user's machine: Launchly never sees provider passwords,
 * browser cookies, or OAuth tokens — it only sends the task prompt and
 * receives the CLI's text output.
 *
 * Subscription-first is enforced in the child environment: API-key variables
 * that would silently switch billing to API usage are removed for the CLI
 * subprocess only (the user's shell is untouched).
 */
function cliRun(bin, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(bin, args, { cwd: root, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err?.code ?? 0, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), error: err ? String(err.message || err) : null });
    });
  });
}

function isMissingBinary(r) {
  return !!r.error && /ENOENT|not recognized|not found/i.test(`${r.error} ${r.stderr}`);
}

async function subscriptionStatus() {
  const status = {
    claude: { installed: false, authenticated: false },
    codex: { installed: false, authenticated: false },
  };
  const claudeVersion = await cliRun('claude', ['--version'], 15000);
  if (!isMissingBinary(claudeVersion)) {
    status.claude.installed = true;
    // `claude auth status` exits 0 when logged in (any account type).
    const auth = await cliRun('claude', ['auth', 'status'], 15000);
    status.claude.authenticated = auth.ok;
    if (!auth.ok && !/unknown command|flag/i.test(auth.stderr)) status.claude.detail = auth.stderr.slice(0, 300);
  }
  const codexVersion = await cliRun('codex', ['--version'], 15000);
  if (!isMissingBinary(codexVersion)) {
    status.codex.installed = true;
    // `codex login status` exits 0 when credentials are present.
    const auth = await cliRun('codex', ['login', 'status'], 15000);
    status.codex.authenticated = auth.ok;
  }
  return status;
}

/** Classify a failed CLI run into a machine-readable bucket. Pure (tested). */
function classifyCliError(tool, r) {
  const text = `${r.stderr}\n${r.stdout}\n${r.error}`;
  if (/rate.?limit|usage.?limit|quota|too many requests|429|credit balance|overloaded/i.test(text)) return 'limited';
  if (/not logged in|login required|unauthori|invalid.*(token|key)|expired|forbidden|401|403/i.test(text)) return 'auth';
  if (isMissingBinary(r)) return 'missing';
  return 'error';
}

async function subscriptionExec(tool, prompt, timeoutMs = 300000) {
  if (tool !== 'claude' && tool !== 'codex') throw new Error('Unknown subscription tool. Use "claude" or "codex".');
  const p = String(prompt ?? '').trim();
  if (!p) throw new Error('Nothing to ask.');
  if (p.length > 8000) throw new Error('Prompt too long (max 8000 characters).');
  const ms = Math.min(600000, Math.max(30000, Number(timeoutMs) || 300000));
  // Child-only env: drop API-key variables so a stray key can't silently
  // convert the subscription run into billed API usage.
  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY;
  delete childEnv.ANTHROPIC_AUTH_TOKEN;
  delete childEnv.OPENAI_API_KEY;
  delete childEnv.CODEX_API_KEY;
  const run = (bin, args) => new Promise((resolve) => {
    execFile(bin, args, { cwd: root, timeout: ms, maxBuffer: 16 * 1024 * 1024, env: childEnv }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), error: err ? String(err.message || err) : null, timedOut: !!err && /timed out|ETIMEDOUT|SIGTERM/i.test(String(err.message || err)) });
    });
  });
  let r;
  if (tool === 'claude') {
    // --print = non-interactive; --max-turns bounds the agentic loop.
    r = await run('claude', ['--print', '--output-format', 'text', '--max-turns', '25', p]);
  } else {
    // workspace-write lets Codex edit inside the project; approvals that need
    // a human cannot be answered non-interactively and surface as errors.
    r = await run('codex', ['exec', '--sandbox', 'workspace-write', p]);
  }
  if (r.timedOut) throw new Error(`[SUBSCRIPTION_TIMEOUT] The ${tool} run timed out after ${Math.round(ms / 1000)}s.`);
  if (!r.ok) {
    const bucket = classifyCliError(tool, r);
    const tail = (r.stderr || r.error || 'run failed').slice(-1500);
    if (bucket === 'limited') throw new Error(`[SUBSCRIPTION_LIMITED] ${tool} reported a usage/rate limit. ${tail}`);
    if (bucket === 'auth') throw new Error(`[SUBSCRIPTION_AUTH] ${tool} is not authenticated. Run \`${tool === 'claude' ? 'claude auth login' : 'codex login'}\` on this computer. ${tail}`);
    if (bucket === 'missing') throw new Error(`[SUBSCRIPTION_AUTH] The \`${tool}\` CLI is not installed on this computer.`);
    throw new Error(`${tool} failed: ${tail}`);
  }
  const out = (r.stdout || '').slice(0, 12000);
  if (!out.trim()) throw new Error(`${tool} finished with no output.`);
  return out;
}

function ps(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 30000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

/** PowerShell preamble. The monitor index is baked in as a number (safe: integer
 * clamped by the caller). Written for Windows PowerShell 5.1 — no `?.`/`??`. */
function psPreamble(monitorIdx) {
  const idx = Math.max(0, Math.floor(Number(monitorIdx) || 0));
  return `
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
$screens = [System.Windows.Forms.Screen]::AllScreens;
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
if (${idx} -ge 0 -and ${idx} -lt $screens.Count) { $bounds = $screens[${idx}].Bounds; }
$VK = @{ backspace=8; tab=9; enter=13; escape=27; home=36; end=35; pageup=33; pagedown=34; delete=46;
  arrowup=38; arrowdown=40; arrowleft=37; arrowright=39;
  f1=112; f2=113; f3=114; f4=115; f5=116; f6=117; f7=118; f8=119; f9=120; f10=121; f11=122; f12=123 };
`;
}
const PS_PREAMBLE = psPreamble(monitorIndex);

async function listMonitors() {
  if (!isWindows) return [];
  const out = await ps(`${PS_PREAMBLE}
$screens = [System.Windows.Forms.Screen]::AllScreens;
for ($i = 0; $i -lt $screens.Count; $i++) {
  $b = $screens[$i].Bounds;
  Write-Host "$i|$($screens[$i].DeviceName)|$($b.Width)|$($b.Height)|$($screens[$i].Primary)"
}`);
  return out.trim().split('\n').filter(Boolean).map(line => {
    const [index, name, width, height, primary] = line.split('|');
    return { index: Number(index), name: name || `Monitor ${index}`, width: Number(width), height: Number(height), primary: primary === 'True' };
  });
}

function escPs(s) {
  return String(s ?? '').replace(/'/g, "''");
}

async function screenshot(monitorIdx = monitorIndex, width = 0) {
  if (isMac) return await macScreenshot();
  if (!isWindows) throw new Error('Screenshots need Windows PowerShell or macOS screencapture on this computer.');
  const targetW = Math.floor(Number(width) || 0);
  // NOTE: 1.0/double literals are required — PowerShell 5.1 binds
  // [Math]::Min(1, x) to the int overload and truncates the scale to 0.
  const out = await ps(`${psPreamble(monitorIdx)}
$scale = 1.0; ${targetW > 0 ? `$scale = [Math]::Min(1.0, (1.0 * ${targetW}) / $bounds.Width);` : ''}
$w = [int]($bounds.Width * $scale); if ($w -lt 1) { $w = 1; }
$h = [int]($bounds.Height * $scale); if ($h -lt 1) { $h = 1; }
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height);
$g = [System.Drawing.Graphics]::FromImage($bmp);
$g.CopyFromScreen($bounds.Location, (New-Object System.Drawing.Point(0,0)), $bounds.Size);
$small = New-Object System.Drawing.Bitmap($bmp, $w, $h);
$ms = New-Object System.IO.MemoryStream;
$small.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
$g.Dispose(); $bmp.Dispose(); $small.Dispose();
[Convert]::ToBase64String($ms.ToArray());`);
  if (!out) throw new Error('Screenshot came back empty.');
  return `data:image/png;base64,${out.replace(/\s+/g, '')}`;
}

/** Continuous frame streaming: captures the real desktop at a steady rate and
 * pushes every frame over the existing WebSocket. The backend counts and
 * caches the latest frame; the browser polls it. Numbers at every hop
 * (agent seq, backend received, frontend received/rendered) prove the live
 * pipeline instead of assuming it. */
const stream = { on: false, timer: null, inFlight: false, seq: 0, fps: 0.5, width: 960, monitor: 0 };
function startStream(send, opts = {}) {
  const fps = Math.min(2, Math.max(0.25, Number(opts.fps) || 0.5));
  const width = Math.min(1920, Math.max(320, Math.floor(Number(opts.width) || 960)));
  const monitor = Math.max(0, Math.floor(Number(opts.monitor ?? monitorIndex) || 0));
  stopStream();
  stream.on = true;
  stream.seq = 0;
  stream.fps = fps;
  stream.width = width;
  stream.monitor = monitor;
  const tick = async () => {
    if (!stream.on || stream.inFlight) return;
    stream.inFlight = true;
    try {
      const image = await screenshot(stream.monitor, stream.width);
      if (!stream.on) return;
      stream.seq += 1;
      send({ type: 'frame', seq: stream.seq, ts: Date.now(), monitor: stream.monitor, width: stream.width, image, bytes: Buffer.from(image.split(',')[1], 'base64').length });
    } catch (e) {
      if (stream.on) send({ type: 'frame_error', ts: Date.now(), error: e instanceof Error ? e.message : String(e) });
    } finally {
      stream.inFlight = false;
    }
  };
  void tick();
  stream.timer = setInterval(tick, Math.round(1000 / fps));
  // Never hold the process open for streaming alone (tests, clean shutdowns).
  if (stream.timer.unref) stream.timer.unref();
  return `Streaming ${fps} fps at ${width}px from monitor ${monitor}.`;
}
function stopStream() {
  stream.on = false;
  stream.inFlight = false;
  if (stream.timer) { clearInterval(stream.timer); stream.timer = null; }
  return 'Stream stopped.';
}
function streamState() {
  return { on: stream.on, seq: stream.seq, fps: stream.fps, width: stream.width, monitor: stream.monitor };
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
  if (name === 'screenshot') {
    const monitorIdx = input.monitorIndex !== undefined ? Number(input.monitorIndex) : monitorIndex;
    return await screenshot(monitorIdx);
  }
  if (name === 'subscription_status') return await subscriptionStatus();
  if (name === 'subscription_exec') {
    if (busy) throw new Error('Another input action is still running.');
    busy = true;
    try {
      return await subscriptionExec(input.tool, input.prompt, input.timeoutMs);
    } finally {
      busy = false;
    }
  }
  if (['mouse_move', 'click', 'double_click', 'right_click', 'type', 'keypress', 'hotkey', 'scroll', 'wait'].includes(name)) {
    if (isMac) {
      // macOS path: real input via osascript/cliclick (see helpers above).
      if (busy) throw new Error('Another input action is still running.');
      busy = true;
      try {
        if (['mouse_move', 'click', 'double_click', 'right_click', 'scroll'].includes(name)) return await macMouse(name, input);
        if (name === 'type') return await macType(input.text);
        if (name === 'keypress') return await macKeypress(input.key);
        if (name === 'hotkey') return await macHotkey(input.keys);
        if (name === 'wait') {
          const d = Math.min(10000, Math.max(100, Number(input.duration) || 500));
          await new Promise((r) => setTimeout(r, d));
          return `Waited ${d}ms`;
        }
      } finally {
        busy = false;
      }
    }
    if (!isWindows) throw new Error('Mouse/keyboard control needs the Windows agent (PowerShell) or macOS. On other systems only files and commands are available.');
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

  let monitorListSent = false;
  let heartbeatTimer = null;
  const stopHeartbeat = () => { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } };

  ws.on('open', async () => {
    console.log(`Connected. Serving project root: ${root}`);
    console.log(`Screen control: ${isWindows ? 'enabled (Windows PowerShell)' : isMac ? 'enabled (macOS: typing/keys via Accessibility permission, mouse needs `brew install cliclick`)' : 'UNAVAILABLE (needs Windows or macOS)'}`);
    try {
      ws.send(JSON.stringify({ type: 'hello', root, platform: os.platform(), agent: 'launchly-local-agent', version: '1.0.0' }));
    } catch { /* socket already gone — close handler reconnects */ }
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      try { ws.send(JSON.stringify({ type: 'heartbeat' })); } catch { /* closed — reconnect follows */ }
    }, 20000);
    if (isMac && !monitorListSent) {
      ws.send(JSON.stringify({ type: 'monitor_list', monitors: [{ index: 0, name: 'Main display', width: 0, height: 0, primary: true }] }));
      monitorListSent = true;
    }
    if (isWindows && !monitorListSent) {
      try {
        const monitors = await listMonitors();
        ws.send(JSON.stringify({ type: 'monitor_list', monitors }));
        monitorListSent = true;
        console.log(`Monitors: ${monitors.map(m => `${m.index}:${m.name} ${m.width}x${m.height}`).join(', ')}`);
      } catch (e) {
        console.error('Failed to enumerate monitors:', e.message);
      }
    }
  });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== 'tool_call') return;
    // Stream control bypasses handleTool: frames keep flowing after the call resolves.
    if (msg.name === 'stream_start' || msg.name === 'stream_stop') {
      try {
        const result = msg.name === 'stream_stop' ? stopStream() : startStream((m) => ws.send(JSON.stringify(m)), msg.input || {});
        ws.send(JSON.stringify({ type: 'tool_result', callId: msg.callId, result }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'tool_result', callId: msg.callId, error: e instanceof Error ? e.message : String(e) }));
      }
      return;
    }
    // Never print typed text to the console — it may contain credentials the user typed.
    const safeInput = msg.name === 'type'
      ? { text: `[${String(msg.input?.text ?? '').length} chars, not logged]` }
      : msg.input;
    console.log(`→ ${msg.name} ${JSON.stringify(safeInput)}`);
    try {
      const result = await handleTool(msg.name, msg.input || {});
      ws.send(JSON.stringify({ type: 'tool_result', callId: msg.callId, result }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'tool_result', callId: msg.callId, error: e instanceof Error ? e.message : String(e) }));
    }
  });

  ws.on('close', () => {
    stopHeartbeat();
    stopStream();
    console.log('Disconnected. Reconnecting in 3s…');
    setTimeout(connect, 3000);
  });

  ws.on('error', (e) => {
    console.error('Connection error:', e.message);
  });
}

// Exported for automated tests. The agent still connects on normal launch;
// tests set LAUNCHLY_AGENT_NO_CONNECT=1 to import the pure tool logic.
export { resolveScoped, handleTool, isWindows, isMac, escApple, macAbs, macModifier, MAC_KEYCODES, cliclickArgs, classifyMacError, classifyCliError, subscriptionStatus, subscriptionExec, startStream, stopStream, streamState };
if (process.env.LAUNCHLY_AGENT_NO_CONNECT !== '1') connect();
