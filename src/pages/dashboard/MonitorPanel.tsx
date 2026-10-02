import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Mic, MessageSquare, Plus, Square, X } from 'lucide-react';
import { useMonitorWorkspace } from './monitor/useMonitorWorkspace';
import { restoreLocalPermission } from './monitor/localProjects';
import { monitorApi } from './monitor/monitorApi';
import { ProjectSelector } from './monitor/ProjectSelector';
import { ProjectConnectionModal } from './monitor/ProjectConnectionModal';
import { CodingConnectionModal } from './monitor/CodingConnectionModal';
import { DeviceConnectionModal } from './monitor/DeviceConnectionModal';
import { MonitorPermissions } from './monitor/MonitorPermissions';
import { AgentActivity, ChangeSummary } from './monitor/AgentActivity';
import { MonitorTopBar } from './monitor/MonitorTopBar';
import { ComputerPanel } from './monitor/ComputerPanel';
import { AgentPanel } from './monitor/AgentPanel';
import { ApprovalCard } from './monitor/ApprovalCard';
import type { AgentTask } from './monitor/types';
import './monitor/monitor-project.css';
import { useStore } from '../../store';
import './monitor.css';
import { describeArea, extractTarget, locate, readScreen, summariseText } from './screenReader';

/**
 * Monitor — share your screen into the display, then talk to the assistant
 * underneath it.
 *
 * The assistant understands plain sentences ("can you take a screenshot",
 * "start recording", "zoom in a bit") without any AI model. When an OpenAI
 * key is saved in Settings, anything it can't handle locally is answered by
 * looking at the current screen frame. Without a key it says so plainly.
 *
 * Connection state is the single source of truth for the UI:
 *   idle → connecting → connected → (Stop / browser "Stop sharing") → idle
 * Going back to idle clears the conversation and every active-monitor element.
 */

type Conn = 'idle' | 'connecting' | 'connected';
type Role = 'you' | 'assistant';
type Msg = { id: number; role: Role; text: string; status?: 'pending' | 'error'; task?: AgentTask };

export type Intent =
  | 'screenshot'
  | 'record'
  | 'stop-recording'
  | 'pause'
  | 'resume'
  | 'fullscreen'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'disconnect'
  | 'help'
  | 'greeting'
  | null;

/** Plain-language → action. Order matters: the more specific phrases first. */
export function interpret(text: string): Intent {
  const t = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/\b(help|what can you do|commands?|how does this work)\b/.test(t)) return 'help';
  if (/^(hi|hey|hello|yo|hiya)\b/.test(t) && t.split(' ').length <= 3) return 'greeting';
  if (/\b(stop|end|finish|save)\b.*\b(record|recording|video)\b/.test(t)) return 'stop-recording';
  if (/\b(screenshot|screen shot|capture|snap|snapshot|take a picture|save (the|this) screen)\b/.test(t)) return 'screenshot';
  if (/\b(record|recording|start a video|film)\b/.test(t)) return 'record';
  if (/\b(reset|normal|default)\b.*\bzoom\b|\bzoom\b.*\b(reset|normal)\b|\bunzoom\b/.test(t)) return 'zoom-reset';
  if (/\bzoom (in|closer)\b|\b(enlarge|bigger|magnify|closer)\b/.test(t)) return 'zoom-in';
  if (/\bzoom out\b|\b(smaller|further)\b/.test(t)) return 'zoom-out';
  if (/\b(full ?screen|maximi[sz]e)\b/.test(t)) return 'fullscreen';
  if (/\b(pause|freeze|hold)\b/.test(t)) return 'pause';
  if (/\b(resume|unpause|unfreeze|continue|go live|play)\b/.test(t)) return 'resume';
  if (/\b(disconnect|stop sharing|stop monitor|close (the )?monitor|end (the )?session)\b/.test(t) || t === 'stop') return 'disconnect';
  return null;
}

const HELP_TEXT =
  'I can take a screenshot, start or stop a recording, pause or resume the view, zoom in or out, go fullscreen, or disconnect. Just ask in your own words.';

let nextId = 1;

async function askOpenAI(apiKey: string, image: string, question: string, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You help the user with what is on their shared screen. Be brief and practical. Describe what is actually visible and what you are doing.',
        },
        { role: 'user', content: [{ type: 'text', text: question }, { type: 'image_url', image_url: { url: image, detail: 'low' } }] },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `The assistant couldn’t answer (error ${res.status}).`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('The assistant returned an empty answer.');
  return text;
}

function getSpeechRecognition(): any {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const MAX_CHARS = 1000;

export function MonitorPanel() {
  const openaiKey = useStore((s) => s.openaiKey);
  const ws = useMonitorWorkspace();
  const [dialog, setDialog] = useState<null | 'project' | 'ai' | 'perms' | 'device'>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Server-side task currently driving real mouse/keyboard control. */
  const activeTaskRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = ws.token;

  const [conn, setConn] = useState<Conn>('idle');
  const [connectError, setConnectError] = useState('');
  const [source, setSource] = useState('');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  /** True only when the user asked to pause — any other pause (fullscreen, tab switch) is undone. */
  const userPausedRef = useRef(false);
  useEffect(() => {
    userPausedRef.current = paused;
  }, [paused]);
  const [zoom, setZoom] = useState(1);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  /** Where the AI mouse is pointing, as fractions of the shared frame. */
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const Speech = typeof window !== 'undefined' ? getSpeechRecognition() : null;
  const connected = conn === 'connected';

  // Browsers pause a <video> when it moves in or out of fullscreen (and
  // sometimes when the tab is hidden). The preview must stay live unless the
  // user paused it, so resume on those events.
  useEffect(() => {
    if (!connected) return;
    const v = videoRef.current;
    if (!v) return;
    const resume = () => {
      if (!userPausedRef.current && streamRef.current && v.paused) v.play?.()?.catch?.(() => {});
    };
    const onFs = () => setTimeout(resume, 50);
    v.addEventListener('pause', resume);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('visibilitychange', resume);
    return () => {
      v.removeEventListener('pause', resume);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [connected]);
  /** Chat works with a shared screen, a connected project, or both. */
  const selectedProvider = ws.selection.mode === 'auto' ? null : ws.selection.provider;
  const aiReady = !!selectedProvider && ws.providers.some(p => p.provider === selectedProvider && p.connected);
  const projectReady = !!ws.project && ws.project.status === 'synced' && aiReady && !!ws.backend?.capabilities.agent;
  const chatReady = connected || projectReady;

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(160, field.scrollHeight)}px`;
  }, [input]);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  /** Tear down everything tied to the active connection, synchronously.
   * Stopping screen share also immediately stops any running AI control. */
  const disconnect = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    const taskId = activeTaskRef.current;
    activeTaskRef.current = null;
    if (taskId && tokenRef.current) void monitorApi.stopTask(tokenRef.current, taskId).catch(() => {});
    setMessages((list) =>
      list.map((m) =>
        m.task && (m.task.status === 'working' || m.task.status === 'awaiting-approval')
          ? { ...m, task: { ...m.task, status: 'stopped', error: 'Stopped — screen sharing ended.' } }
          : m
      )
    );
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null; // closing the monitor discards an unsaved recording
      rec.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (typeof document !== 'undefined' && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setConn('idle');
    setSource('');
    setRecording(false);
    setPaused(false);
    setZoom(1);
    setBusy(false);
    setListening(false);
    setMessages([]);
    setPointer(null);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  async function connect() {
    if (conn !== 'idle') return;
    setConnectError('');
    setConn('connecting');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'window', frameRate: 30 } as MediaTrackConstraints,
        selfBrowserSurface: 'exclude',
        preferCurrentTab: false,
        audio: false,
      } as DisplayMediaStreamOptions);
      const track = stream.getVideoTracks()[0];
      // The browser's own "Stop sharing" bar ends the track — mirror it at once.
      track?.addEventListener('ended', disconnect);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play?.()?.catch?.(() => {});
      }
      const s = track?.getSettings?.() as (MediaTrackSettings & { displaySurface?: string }) | undefined;
      const surface =
        s?.displaySurface === 'monitor' ? 'Entire screen' : s?.displaySurface === 'window' ? 'Window' : s?.displaySurface === 'browser' ? 'Browser tab' : 'Screen';
      setSource(s?.width && s?.height ? `${surface} · ${s.width}×${s.height}` : surface);
      setConn('connected');
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) {
      setConn('idle');
      const name = e instanceof Error ? e.name : '';
      setConnectError(name === 'NotAllowedError' ? '' : 'Screen sharing couldn’t start. Check your browser permissions and try again.');
    }
  }

  const add = (role: Role, text: string, status?: Msg['status']) => {
    const m = { id: nextId++, role, text, status };
    setMessages((list) => [...list.slice(-80), m]);
    return m.id;
  };
  const update = (id: number, patch: Partial<Msg>) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function screenshot(): string {
    const v = videoRef.current;
    if (!v?.videoWidth) return 'There’s nothing on screen to capture yet.';
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && download(b, `launchly-screenshot-${Date.now()}.png`), 'image/png');
    return 'Screenshot saved to your downloads.';
  }

  function startRecording(): string {
    if (!streamRef.current) return 'Connect your screen first.';
    if (recorderRef.current) return 'Already recording.';
    if (typeof MediaRecorder === 'undefined') return 'Recording isn’t supported in this browser.';
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, MediaRecorder.isTypeSupported('video/webm') ? { mimeType: 'video/webm' } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => download(new Blob(chunksRef.current, { type: 'video/webm' }), `launchly-recording-${Date.now()}.webm`);
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
    return 'Recording. Ask me to stop when you’re done and I’ll save it.';
  }

  function stopRecording(): string {
    const rec = recorderRef.current;
    if (!rec) return 'Nothing is being recorded.';
    recorderRef.current = null;
    rec.stop();
    setRecording(false);
    return 'Recording saved to your downloads.';
  }

  function runIntent(intent: Exclude<Intent, null>): string {
    switch (intent) {
      case 'help':
        return HELP_TEXT;
      case 'greeting':
        return 'Hi! ' + HELP_TEXT;
      case 'screenshot':
        return screenshot();
      case 'record':
        return startRecording();
      case 'stop-recording':
        return stopRecording();
      case 'pause':
        userPausedRef.current = true;
        videoRef.current?.pause();
        setPaused(true);
        return 'Paused. The view is frozen until you resume.';
      case 'resume':
        userPausedRef.current = false;
        videoRef.current?.play?.()?.catch?.(() => {});
        setPaused(false);
        return 'Live again.';
      case 'zoom-in':
        setZoom((z) => Math.min(3, z + 0.5));
        return 'Zoomed in.';
      case 'zoom-out':
        setZoom((z) => Math.max(1, z - 0.5));
        return 'Zoomed out.';
      case 'zoom-reset':
        setZoom(1);
        return 'Zoom reset.';
      case 'fullscreen':
        setZoom(1);
        setPointer(null);
        if (!screenRef.current?.requestFullscreen) return 'Fullscreen is not available in this browser.';
        if (streamRef.current?.getVideoTracks()[0]?.getSettings?.().displaySurface === 'monitor') return 'To avoid capturing this preview repeatedly, share a separate Edge window before opening fullscreen.';
        screenRef.current.requestFullscreen().catch(() => add('assistant', 'Fullscreen could not start. Try the Fullscreen button again.'));
        return 'Opening fullscreen. Press Esc to exit.';
      case 'disconnect':
        return '';
    }
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy || !chatReady) return;
    setInput('');
    setPointer(null);
    add('you', text);

    const intent = connected ? interpret(text) : null;
    if (intent === 'disconnect') return disconnect();
    // Project connected and this isn't a screen command or a "where is…" question → project agent.
    if (ws.project && !intent && !(connected && extractTarget(text))) return runAgent(text);
    if (intent) {
      add('assistant', runIntent(intent));
      return;
    }

    const v = videoRef.current;
    if (!v?.videoWidth) {
      add('assistant', 'I can’t see your screen yet. Give it a second and try again.', 'error');
      return;
    }

    const target = extractTarget(text);
    const wantsRead = /\b(what(?:'s| is) on (?:my|the) screen|read (?:my |the )?screen|what do you see|what can you see|describe)\b/i.test(text);
    const wantsClick = /\b(click|press|tap)\b/i.test(text);

    const id = add('assistant', '', 'pending');
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const stillCurrent = () => requestRef.current === controller && !controller.signal.aborted;
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      // 1) Read the screen on-device (no key, nothing uploaded).
      const scale = Math.min(1, 1600 / v.videoWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      const ocr = await readScreen(c);
      if (!stillCurrent()) return;

      if (target) {
        const hit = locate(ocr, target);
        if (hit) {
          setPointer({ x: hit.x, y: hit.y });
          update(id, {
            text:
              `Found “${hit.text}” at the ${describeArea(hit.x, hit.y)} of your screen.` +
              (wantsClick ? ' Tell me what to do there and I will do it on your computer.' : ''),
            status: undefined,
          });
          return;
        }
        if (!openaiKey) {
          update(id, { text: `I read your screen but couldn’t see “${target}”. Make sure it’s visible, or try the exact word shown on screen.`, status: undefined });
          return;
        }
      } else if (wantsRead || !openaiKey) {
        const summary = summariseText(ocr.text);
        update(id, {
          text: summary
            ? (wantsRead ? 'Here’s what I can read on your screen: ' : 'I read your screen. I can point to anything you name — try “where is …”. Visible text: ') + summary
            : 'I couldn’t read any text on your screen right now.',
          status: undefined,
        });
        return;
      }

      // 2) Optional: with an OpenAI key, answer free-form questions about the screen.
      const answer = await askOpenAI(openaiKey, c.toDataURL('image/png'), text, controller.signal);
      if (stillCurrent()) update(id, { text: answer, status: undefined });
    } catch (e) {
      if (requestRef.current === controller) {
        update(id, {
          text: controller.signal.aborted ? 'That took too long. Please try again.' : e instanceof Error ? e.message : 'Something went wrong.',
          status: 'error',
        });
      }
    } finally {
      clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  /** Capture the live shared-screen frame to send to the model. Null when not sharing. */
  function captureFrame(): string | null {
    const v = videoRef.current;
    if (!v?.videoWidth) return null;
    try {
      const scale = Math.min(1, 1280 / v.videoWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  /** Emergency Stop: cancels the model request, clears queued actions, blocks further input. */
  async function emergencyStop() {
    const taskId = activeTaskRef.current;
    requestRef.current?.abort();
    requestRef.current = null;
    activeTaskRef.current = null;
    setBusy(false);
    setMessages((list) =>
      list.map((m) =>
        m.task && (m.task.status === 'working' || m.task.status === 'awaiting-approval')
          ? { ...m, task: { ...m.task, status: 'stopped', error: 'Stopped — no further mouse/keyboard actions will run.' } }
          : m
      )
    );
    if (taskId && ws.token) {
      try { await monitorApi.stopTask(ws.token, taskId); } catch { /* already stopped */ }
    }
    add('assistant', 'Stopped. All mouse and keyboard control is off.');
  }

  async function approvePending(taskId: string, msgId: number) {
    const r = await monitorApi.approveTask(ws.token, taskId);
    if (!r.ok) {
      setMessages((list) => list.map((m) => (m.id === msgId && m.task ? { ...m, task: { ...m.task, error: r.message ?? 'Could not approve.' } } : m)));
    }
  }

  /** Send a task to the selected AI with the live screen. The model sees the
   * screenshot and performs REAL mouse/keyboard/file actions on the paired
   * computer through the local agent, in an observe → act → observe loop. */
  async function runAgent(prompt: string) {
    if (!ws.project) { add('assistant', 'Connect a project first.'); return; }
    if (!aiReady) { add('assistant', 'Connect AI first — pick a provider and save a key.'); return; }
    if (!ws.backend?.capabilities.agent) { add('assistant', 'The project agent isn’t available on the server yet.'); return; }
    if (!ws.device.online) { add('assistant', ws.device.paired ? 'Computer disconnected. Start the local agent on your computer to run this — Monitor will detect when it is back online.' : 'Connect this computer first so the AI has somewhere real to run.'); return; }
    if (!projectReady) { add('assistant', 'Connect a project and AI with an available coding runtime before sending a task.'); return; }
    const project = ws.project!;
    const frame = captureFrame();
    const task: AgentTask = {
      id: `local-${nextId}`,
      prompt,
      status: 'working',
      activity: [{ id: 'u', tool: 'understand', label: frame ? 'Looking at your screen…' : 'Starting — no shared screen, the computer will capture one…', status: 'running' }],
      changes: null,
      error: null,
      screenshot: null,
      actionsExecuted: 0,
      maxActions: 30,
    };
    const id = add('assistant', '', undefined);
    update(id, { task });
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const setTask = (t: AgentTask) => requestRef.current === controller && update(id, { task: t });
    try {
      const started = await monitorApi.runTask(ws.token, { projectId: project.id, prompt, model: ws.selection, permissions: ws.permissions, screenshot: frame, maxActions: 30 });
      if (!started.ok) {
        activeTaskRef.current = null;
        setTask({
          ...task,
          status: 'error',
          activity: [{ ...task.activity[0], status: 'error' }],
          error: started.reason === 'not_configured' ? 'The project agent isn’t available on the server yet.' : started.message,
        });
        return;
      }
      activeTaskRef.current = started.data.taskId;
      // Follow the server-side task until it finishes, needs approval, or is stopped.
      for (let i = 0; i < 600 && requestRef.current === controller; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        if (requestRef.current !== controller) return;
        if (!ws.device.online && i % 5 === 0) {
          await ws.refreshDevice();
        }
        const r = await monitorApi.getTask(ws.token, started.data.taskId);
        if (!r.ok) {
          setTask({ ...task, status: 'error', error: r.message });
          return;
        }
        setTask(r.data);
        if (r.data.status === 'awaiting-approval' || r.data.status === 'done' || r.data.status === 'error' || r.data.status === 'stopped') {
          if (r.data.status !== 'awaiting-approval') {
            if (requestRef.current === controller) {
              requestRef.current = null;
              activeTaskRef.current = null;
              setBusy(false);
            }
          }
          if (r.data.status === 'awaiting-approval') continue;
          return;
        }
      }
      if (requestRef.current === controller && activeTaskRef.current) {
        try { await monitorApi.stopTask(ws.token, activeTaskRef.current); } catch { /* ignore */ }
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        activeTaskRef.current = null;
        setBusy(false);
      }
    }
  }

  async function applyChanges(msgId: number, task: AgentTask) {
    if (!task.changes) return;
    const r = await monitorApi.applyChanges(ws.token, task.changes.id);
    update(msgId, { task: r.ok ? { ...task, changes: r.data } : { ...task, error: r.message } });
  }

  async function undoChanges(msgId: number, task: AgentTask) {
    if (!task.changes) return;
    const r = await monitorApi.undo(ws.token, task.changes.checkpointId);
    update(msgId, { task: r.ok ? { ...task, changes: null, activity: [...task.activity, { id: 'undo', tool: 'git_status', label: 'Restored the checkpoint', status: 'done' }] } : { ...task, error: r.message } });
  }

  /** Map a point in the shared frame to the on-screen box (object-fit: contain + zoom). */
  function pointerStyle(): React.CSSProperties | undefined {
    const v = videoRef.current;
    const box = screenRef.current;
    if (!pointer || !v?.videoWidth || !box) return undefined;
    const W = box.clientWidth;
    const H = box.clientHeight;
    const s = Math.min(W / v.videoWidth, H / v.videoHeight) * zoom;
    const left = (W - v.videoWidth * s) / 2 + pointer.x * v.videoWidth * s;
    const top = (H - v.videoHeight * s) / 2 + pointer.y * v.videoHeight * s;
    return { left, top };
  }

  function toggleVoice() {
    if (!Speech || !chatReady) return;
    if (listening) return recognitionRef.current?.stop();
    const rec = new Speech();
    rec.lang = navigator.language || 'en-GB';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const said = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(' ').trim();
      if (said) send(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  const status = conn === 'connecting' ? 'Connecting' : !connected ? 'Offline' : recording ? 'Recording' : paused ? 'Paused' : 'Live';

  /** Which column the single-column (small screen) layout is showing. */
  const [view, setView] = useState<'computer' | 'agent'>('computer');

  /** "Window · 1920×1080" → surface and resolution, both shown separately. */
  const [surfaceName, resolution] = useMemo(() => {
    const i = source.lastIndexOf(' · ');
    if (i === -1) return [source || 'Screen', ''] as const;
    return [source.slice(0, i), source.slice(i + 3)] as const;
  }, [source]);

  /** The task the server is actually driving right now, if any. */
  const liveTask = useMemo(
    () => [...messages].reverse().find((m) => m.task && (m.task.status === 'working' || m.task.status === 'awaiting-approval'))?.task ?? null,
    [messages],
  );
  const awaitingApproval = liveTask?.status === 'awaiting-approval';
  const agentWorking = busy || !!liveTask;
  const agentState = awaitingApproval
    ? { label: 'Waiting for approval', tone: 'warn' as const }
    : agentWorking
      ? { label: 'Working', tone: 'warn' as const }
      : chatReady
        ? { label: 'Ready', tone: 'ok' as const }
        : { label: 'Standby', tone: 'idle' as const };

  /** Real model name from the backend's catalogue, never a hard-coded one. */
  const modelLabel = useMemo(() => {
    if (!aiReady || !selectedProvider) return 'Connect AI';
    const sel = ws.selection;
    if (sel.mode === 'exact') {
      return ws.models.find((m) => m.modelId === sel.modelId)?.displayName ?? sel.modelId;
    }
    const latestId = ws.latest[selectedProvider];
    return (
      ws.models.find((m) => m.modelId === latestId)?.displayName ??
      ws.models.find((m) => m.provider === selectedProvider && m.recommended)?.displayName ??
      (selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'xai' ? 'xAI' : 'Anthropic')
    );
  }, [aiReady, selectedProvider, ws.selection, ws.models, ws.latest]);

  const fullAccess =
    ws.permissions.editMode === 'auto' && ws.permissions.readFiles && ws.permissions.editFiles && ws.permissions.runDevCommands;
  const accessLabel = fullAccess ? 'Full access' : 'Ask before actions';

  return (
    <div className="mv" data-view={view}>
      <span className="mv-visually-hidden" role="status">{status}</span>
      <MonitorTopBar
        serviceOnline={ws.online}
        deviceOnline={ws.device.online}
        deviceName={ws.device.name}
        streamLive={connected}
        onOpenSettings={() => setDialog('perms')}
      >
        <ProjectSelector project={ws.project} projects={ws.projects} loading={ws.projectsLoading} error={ws.projectsError}
          permission={ws.projectPermission}
          onRestorePermission={async () => { if (ws.project) ws.setProjectPermission(await restoreLocalPermission(ws.project.id)); }}
          onRefresh={ws.refreshProjects} onSelect={p => { ws.setProject(p); setMessages([]); }} onConnect={() => setDialog('project')} />
      </MonitorTopBar>

      <div className="mv-viewswitch" role="tablist" aria-label="Workspace panels">
        <button type="button" role="tab" aria-selected={view === 'computer'} className={view === 'computer' ? 'is-active' : ''} onClick={() => setView('computer')}>
          Computer
        </button>
        <button type="button" role="tab" aria-selected={view === 'agent'} className={view === 'agent' ? 'is-active' : ''} onClick={() => setView('agent')}>
          Agent
        </button>
      </div>

      <div className="mv-workspace">
        <ComputerPanel
          conn={conn}
          connected={connected}
          canShare={canShare}
          connectError={connectError}
          surfaceName={surfaceName}
          resolution={resolution}
          deviceName={ws.device.name}
          deviceOnline={ws.device.online}
          devicePaired={ws.device.paired}
          recording={recording}
          paused={paused}
          pointerStyle={pointerStyle()}
          cursorVisible={!!pointer && ws.permissions.controlMouse && ws.permissions.viewScreen}
          cursorPointing={!!pointer}
          videoRef={videoRef}
          stageRef={screenRef}
          zoom={zoom}
          busy={busy}
          onConnect={connect}
          onDisconnect={disconnect}
          onScreenshot={() => send('Take a screenshot')}
          onRecord={() => send(recording ? 'Stop recording' : 'Start recording')}
          onFullscreen={() => send('fullscreen')}
          onOpenDevice={() => setDialog('device')}
          onRefreshDevice={ws.refreshDevice}
        />

        <AgentPanel statusLabel={agentState.label} statusTone={agentState.tone} modelLabel={modelLabel} onOpenModel={() => setDialog('ai')} onOpenMenu={() => setDialog('perms')}>
          <div className="mv-conv" ref={listRef} aria-live="polite">
            {messages.length === 0 ? (
              <div className="mv-conv__empty">
                <span className="mv-conv__icon">
                  <MessageSquare size={17} strokeWidth={1.7} />
                </span>
                <strong>What should we do?</strong>
                <p>{chatReady ? 'Ask Launchly to work with the connected computer.' : 'Connect a computer or a project to get started.'}</p>
                <div className="mv-chips">
                  {['Find a product', 'Fill this form', 'Analyse this page', 'Fix this', 'Continue'].map((c) => (
                    <button key={c} type="button" onClick={() => send(c)} disabled={!chatReady || agentWorking}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`mv-msg mv-msg--${m.role} ${m.status ? `is-${m.status}` : ''}`}>
                  {m.task ? (
                    <>
                      <AgentActivity task={m.task} />
                      {m.task.status === 'awaiting-approval' && (
                        <ApprovalCard task={m.task} onAllow={() => approvePending(activeTaskRef.current ?? '', m.id)} onCancel={emergencyStop} />
                      )}
                      {m.task.changes && (
                        <ChangeSummary changes={m.task.changes} busy={busy} onApply={() => applyChanges(m.id, m.task!)} onUndo={() => undoChanges(m.id, m.task!)} />
                      )}
                    </>
                  ) : m.status === 'pending' ? (
                    <span className="mv-typing" aria-label="Assistant is thinking">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    m.text
                  )}
                </div>
              ))
            )}
          </div>

          <form
            className="mv-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="mv-composer__meta">
              <button type="button" className="mv-chipbtn" onClick={() => setDialog('perms')} aria-label="Monitor permissions" title="Manage permissions">
                {accessLabel}
              </button>
              <button type="button" className="mv-chipbtn" onClick={() => setDialog('ai')} aria-label="AI model" title="Choose the AI model">
                {modelLabel}
              </button>
              <button type="button" className="mv-chipbtn" onClick={() => setDialog('project')} aria-label="Connected project" title="Choose the project">
                {ws.project ? ws.project.name : 'No project'}
              </button>
            </div>
            <div className="mv-composer__row">
              <button type="button" className="mv-iconbtn" onClick={() => setDialog('project')} aria-label="Connect project" title="Connect project">
                <Plus size={16} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask Launchly to do something…"
                disabled={!chatReady}
                rows={1}
                aria-label="Message"
              />
              <button type="button" className={`mv-iconbtn ${listening ? 'is-listening' : ''}`} disabled={!Speech || !chatReady || agentWorking} onClick={toggleVoice}
                aria-label={listening ? 'Stop listening' : 'Voice'} title={Speech ? 'Voice' : 'Voice is unavailable in this browser'}>
                {listening ? <X size={16} /> : <Mic size={16} />}
              </button>
              {agentWorking ? (
                <button type="button" className="mv-iconbtn mv-iconbtn--danger" onClick={emergencyStop} aria-label="Stop agent" title="Stop the agent">
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button type="submit" className="mv-send" disabled={!chatReady || !input.trim()} aria-label="Send">
                  <ArrowUp size={15} strokeWidth={2.4} />
                </button>
              )}
            </div>
          </form>
        </AgentPanel>
      </div>

      {dialog === 'project' && (
        <ProjectConnectionModal
          token={ws.token}
          backend={ws.backend}
          onClose={() => setDialog(null)}
          onConnected={(p) => {
            ws.rememberProject(p);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'ai' && <CodingConnectionModal token={ws.token} providers={ws.providers} onClose={() => setDialog(null)} onChanged={ws.refresh} onSelect={provider => ws.setSelection({ mode: 'latest', provider })} />}
      {dialog === 'perms' && <MonitorPermissions value={ws.permissions} onChange={ws.setPermissions} onClose={() => setDialog(null)} />}
      {dialog === 'device' && (
        <DeviceConnectionModal
          token={ws.token}
          agentAvailable={!!ws.backend?.capabilities.agent}
          online={ws.device.online}
          deviceName={ws.device.name}
          onClose={() => setDialog(null)}
          onPaired={ws.refreshDevice}
        />
      )}
    </div>
  );
}
