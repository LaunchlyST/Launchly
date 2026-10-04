import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MonitorUp, AlertTriangle, Maximize2, Camera, Circle, Unplug, RefreshCw, Monitor, ChevronDown, LoaderCircle, GitBranch, Cpu, Radio } from 'lucide-react';
import { useMonitorWorkspace } from './monitor/useMonitorWorkspace';
import { monitorApi } from './monitor/monitorApi';
import type { AgentTask } from './monitor/types';
import './monitor/monitor-project.css';
import { attachWindowPreview } from './monitor/windowPreview';
import { CodingConnectionModal } from './monitor/CodingConnectionModal';
import { AIProviderModal } from './monitor/AIProviderModal';
import { DeviceConnectionModal } from './monitor/DeviceConnectionModal';
import { ProjectConnectionModal } from './monitor/ProjectConnectionModal';
import { AgentConversation, type ConvMsg } from './monitor/AgentConversation';
import { AgentComposer, type AgentComposerHandle } from './monitor/AgentComposer';
import './monitor.css';
import { describeArea, extractTarget, locate, readScreen, summariseText } from './screenReader';

type Conn = 'idle' | 'connecting' | 'connected' | 'error';
type Role = 'you' | 'assistant';
type Msg = ConvMsg;

export type Intent =
  | 'screenshot' | 'record' | 'stop-recording' | 'pause' | 'resume'
  | 'fullscreen' | 'zoom-in' | 'zoom-out' | 'zoom-reset'
  | 'disconnect' | 'help' | 'greeting' | null;

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

const HELP_TEXT = 'I can take a screenshot, start or stop a recording, pause or resume the view, zoom in or out, go fullscreen, or disconnect. For coding work, connect your computer and describe the task.';

let nextId = 1;

export function MonitorPanel() {
  const [dialog, setDialog] = useState<'ai' | 'api' | 'device' | 'project' | null>(null);
  const ws = useMonitorWorkspace();
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<AgentComposerHandle>(null);
  const captureGeneration = useRef(0);
  const capturePending = useRef(false);
  const previewCleanup = useRef<(() => void) | null>(null);
  const [captureMuted, setCaptureMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const activeTaskRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = ws.token;

  const [conn, setConn] = useState<Conn>('idle');
  const [connectError, setConnectError] = useState('');
  const [source, setSource] = useState('');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [captureMode, setCaptureMode] = useState<'window' | 'screen'>('window');
  const [monitors] = useState([{ index: 0, name: 'Primary Monitor', width: 1920, height: 1080 }]);
  const [selectedMonitor, setSelectedMonitor] = useState(0);
  const userPausedRef = useRef(false);
  useEffect(() => { userPausedRef.current = paused; }, [paused]);
  const [zoom, setZoom] = useState(1);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [videoActive, setVideoActive] = useState(false);
  /** Timestamp of the last rendered video frame (heartbeat for stale detection). */
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [, setNow] = useState(Date.now());
  /** Agent-streamed live desktop (device agent → backend → browser polling). */
  const [agentView, setAgentView] = useState(false);
  const [agentFrame, setAgentFrame] = useState<{ image: string; ts: number; seq: number; monitor: number; width: number; bytes: number } | null>(null);
  const [agentReceived, setAgentReceived] = useState(0);
  const [agentRendered, setAgentRendered] = useState(0);
  const [agentStreamError, setAgentStreamError] = useState('');
  const agentLastSeq = useRef(0);
  const agentStreamWanted = useRef(false);

  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const connected = conn === 'connected';

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

  const selectedProvider = ws.selection.mode === 'auto' ? null : ws.selection.provider;
  const isLocalMode = ws.selection.mode === 'local';
  const aiConnection = ws.providers.find((p) => p.provider === selectedProvider);
  const aiReady = !!ws.token && ws.providerState === 'connected' && (isLocalMode || !!aiConnection?.connected);
  const deviceOnline = ws.device.online;
  const chatReady = aiReady && (connected || deviceOnline);
  const providerLabel = isLocalMode
    ? (selectedProvider === 'anthropic' ? 'Claude Code' : 'Codex CLI')
    : selectedProvider === 'anthropic' ? 'Claude' : selectedProvider === 'openai' ? 'OpenAI' : ws.selection.mode === 'auto' ? 'Auto' : 'AI';

  const disconnect = useCallback(() => {
    ++captureGeneration.current;
    capturePending.current = false;
    previewCleanup.current?.();
    previewCleanup.current = null;
    setCaptureMuted(false);
    setVideoActive(false);
    setLastFrameAt(null);
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
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
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
    setMessages([]);
    setPointer(null);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  async function connect() {
    if (capturePending.current || streamRef.current) return;
    capturePending.current = true;
    const generation = ++captureGeneration.current;
    setConnectError('');
    setConn('connecting');
    try {
      const constraints =
        captureMode === 'screen'
          ? ({ video: { displaySurface: 'monitor', frameRate: 30 } as MediaTrackConstraints, selfBrowserSurface: 'exclude', preferCurrentTab: false, audio: false } as DisplayMediaStreamOptions)
          : ({ video: { displaySurface: 'window', frameRate: 30 } as MediaTrackConstraints, selfBrowserSurface: 'exclude', preferCurrentTab: false, audio: false } as DisplayMediaStreamOptions);
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      if (generation !== captureGeneration.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const track = stream.getVideoTracks()[0];
      streamRef.current = stream;
      if (!track || track.readyState === 'ended' || !videoRef.current) throw new Error('No live video track.');
      const settings = track.getSettings();
      const surface = settings.displaySurface === 'monitor' ? 'Entire screen' : settings.displaySurface === 'browser' ? 'Browser tab' : 'Window';
      setSource(settings.width && settings.height ? `${surface} · ${settings.width}×${settings.height}` : surface);
      previewCleanup.current = attachWindowPreview(videoRef.current, stream, {
        ready: () => {
          if (generation !== captureGeneration.current) return;
          capturePending.current = false;
          setConn('connected');
          setVideoActive(true);
          composerRef.current?.focus();
        },
        ended: () => { disconnect(); },
        muted: (muted) => { setCaptureMuted(muted); setVideoActive(!muted); },
        error: (message) => { if (generation === captureGeneration.current) { disconnect(); setConn('error'); setConnectError(message); } },
      });
    } catch (error) {
      if (generation !== captureGeneration.current) return;
      disconnect();
      if (!(error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'NotAllowedError')) {
        setConn('error');
        setConnectError(captureMode === 'screen' ? 'Screen sharing failed. Try window mode or check permissions.' : 'Window sharing could not start. Check browser permissions and try again.');
      }
    }
  }

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [connected]);

  /** No rendered frame for 45s after at least one frame arrived = stale capture. */
  const staleCapture = connected && lastFrameAt !== null && Date.now() - lastFrameAt > 45000;
  const agentRootBase = ws.device.agentRoot ? ws.device.agentRoot.split(/[\\/]/).filter(Boolean).pop() ?? null : null;
  const rootMismatch = !!ws.project && ws.project.source === 'local' && !!agentRootBase && agentRootBase.toLowerCase() !== ws.project.name.toLowerCase();

  function restartCapture() {
    disconnect();
    // disconnect() is synchronous teardown; queue connect after state settles.
    setTimeout(() => connect(), 150);
  }

  // Agent live view: start the device-side stream once, then poll the latest
  // frame. Counters at every hop (device seq → received → rendered) prove the
  // pipeline instead of assuming it.
  useEffect(() => {
    if (!agentView || !deviceOnline) {
      if (agentStreamWanted.current) {
        agentStreamWanted.current = false;
        if (ws.token) void monitorApi.deviceStream(ws.token, { on: false }).catch(() => {});
      }
      return;
    }
    let cancelled = false;
    agentStreamWanted.current = true;
    setAgentStreamError('');
    void monitorApi.deviceStream(ws.token, { on: true, fps: 0.5, width: 960, monitor: selectedMonitor }).then((r) => {
      if (!cancelled && !r.ok) setAgentStreamError(r.message ?? 'Could not start the agent stream.');
    }).catch(() => { if (!cancelled) setAgentStreamError('Could not start the agent stream.'); });
    const id = setInterval(async () => {
      if (cancelled) return;
      const r = await monitorApi.deviceFrame(ws.token).catch(() => null);
      if (cancelled || !r) return;
      if (!r.ok) { setAgentStreamError(r.message ?? 'Could not load the agent frame.'); return; }
      if (r.data.waiting || !r.data.frame) return;
      const f = r.data.frame;
      if (f.seq !== agentLastSeq.current) {
        agentLastSeq.current = f.seq;
        setAgentFrame(f);
        setAgentReceived((n) => n + 1);
        setAgentStreamError('');
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [agentView, deviceOnline, ws.token, selectedMonitor]);

  useEffect(() => {
    if (!deviceOnline && agentStreamWanted.current) {
      agentStreamWanted.current = false;
      agentLastSeq.current = 0;
      setAgentFrame(null);
    }
  }, [deviceOnline]);

  useEffect(() => () => {
    if (agentStreamWanted.current && tokenRef.current) {
      agentStreamWanted.current = false;
      void monitorApi.deviceStream(tokenRef.current, { on: false }).catch(() => {});
    }
  }, []);

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
      case 'help': return HELP_TEXT;
      case 'greeting': return 'Hi! ' + HELP_TEXT;
      case 'screenshot': return screenshot();
      case 'record': return startRecording();
      case 'stop-recording': return stopRecording();
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
      case 'zoom-in': setZoom((z) => Math.min(3, z + 0.5)); return 'Zoomed in.';
      case 'zoom-out': setZoom((z) => Math.max(1, z - 0.5)); return 'Zoomed out.';
      case 'zoom-reset': setZoom(1); return 'Zoom reset.';
      case 'fullscreen':
        setZoom(1);
        setPointer(null);
        if (!screenRef.current?.requestFullscreen) return 'Fullscreen is not available in this browser.';
        screenRef.current.requestFullscreen().catch(() => add('assistant', 'Fullscreen could not start. Try the Fullscreen button again.'));
        return 'Opening fullscreen. Press Esc to exit.';
      case 'disconnect': return '';
    }
  }

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

  async function runAgent(prompt: string) {
    if (!aiReady) { add('assistant', isLocalMode ? (ws.providerMessage || 'Connect AI first — log the provider CLI in on your computer, or switch to an API key.') : 'Connect AI first — pick a provider and save a key.'); return; }
    if (!ws.backend?.capabilities.agent) { add('assistant', 'The project agent isn’t available on the server yet.'); return; }
    if (!ws.device.online) { add('assistant', ws.device.paired ? 'Computer disconnected. Start the local agent on your computer to run this — Monitor will detect when it is back online.' : 'Connect this computer first so the AI has somewhere real to run.'); return; }
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
      const started = await monitorApi.runTask(ws.token, {
        projectId: ws.project?.id,
        prompt,
        model: ws.selection,
        permissions: ws.permissions,
        screenshot: frame,
        maxActions: 30,
        monitorIndex: captureMode === 'screen' ? selectedMonitor : 0,
      });
      if (requestRef.current !== controller) {
        if (started.ok) void monitorApi.stopTask(ws.token, started.data.taskId);
        return;
      }
      if (!started.ok) {
        if (started.failure) ws.reportProviderFailure(started.failure);
        activeTaskRef.current = null;
        setTask({
          ...task,
          status: 'error',
          activity: [{ ...task.activity[0], status: 'error' }],
          error: started.reason === 'not_configured' ? 'The project agent isn’t available on the server yet.' : started.message ?? 'Could not start the task.',
        });
        return;
      }
      activeTaskRef.current = started.data.taskId;
      for (let i = 0; i < 600 && requestRef.current === controller; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        if (requestRef.current !== controller) return;
        if (!ws.device.online && i % 5 === 0) await ws.refreshDevice();
        const r = await monitorApi.getTask(ws.token, started.data.taskId);
        if (requestRef.current !== controller) return;
        if (!r.ok) {
          if (r.failure) ws.reportProviderFailure(r.failure);
          setTask({ ...task, status: 'error', error: r.message ?? 'Could not load the task.' });
          return;
        }
        setTask(r.data);
        if (r.data.providerFailure) ws.reportProviderFailure(r.data.providerFailure);
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

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy || !chatReady) return;
    setPointer(null);
    add('you', text);

    const intent = connected ? interpret(text) : null;
    if (intent === 'disconnect') return disconnect();
    if (deviceOnline && ws.backend?.capabilities.agent && !intent) return runAgent(text);
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
      if ((target && !wantsClick) || wantsRead) {
        const c = document.createElement('canvas');
        const scale = Math.min(1, 1600 / v.videoWidth);
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
        const ocr = await readScreen(c);
        if (!stillCurrent()) return;
        if (target) {
          const hit = locate(ocr, target);
          if (hit) {
            setPointer({ x: hit.x, y: hit.y });
            update(id, { text: `Found “${hit.text}” at the ${describeArea(hit.x, hit.y)} of your screen.`, status: undefined });
            return;
          }
        } else if (wantsRead && ocr.text.trim()) {
          update(id, { text: 'Here’s what I can read on your screen: ' + summariseText(ocr.text), status: undefined });
          return;
        }
      }
      const frame = captureFrame();
      if (!frame) throw new Error('The shared window is not ready yet. Try again.');
      const result = await monitorApi.chat(ws.token, {
        prompt: text, screenshot: frame, model: ws.selection,
        history: messages.filter((m) => !m.status && !m.task).slice(-12).map((m) => ({ role: m.role === 'you' ? 'user' : 'assistant', content: m.text })),
      }, controller.signal);
      if (!stillCurrent()) return;
      if (!result.ok) {
        if (result.failure) ws.reportProviderFailure(result.failure);
        else ws.reportProviderFailure({ code: result.reason === 'unauthorized' ? 'UNAUTHORIZED' : 'PROVIDER_ERROR', message: result.message ?? 'Request failed.' });
        throw new Error(result.message ?? 'Request failed.');
      }
      update(id, { text: result.data.text, status: undefined });
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

  async function applyChanges(msgId: number, task: AgentTask) {
    if (!task.changes) return;
    const r = await monitorApi.applyChanges(ws.token, task.changes.id);
    update(msgId, { task: r.ok ? { ...task, changes: r.data } : { ...task, error: r.message ?? 'Could not apply.' } });
  }

  async function undoChanges(msgId: number, task: AgentTask) {
    if (!task.changes) return;
    const r = await monitorApi.undo(ws.token, task.changes.checkpointId);
    update(msgId, { task: r.ok ? { ...task, changes: null, activity: [...task.activity, { id: 'undo', tool: 'git_status', label: 'Restored the checkpoint', status: 'done' }] } : { ...task, error: r.message ?? 'Could not undo.' } });
  }

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

  const status = conn === 'connecting' ? 'Connecting' : connected ? 'Connected' : conn === 'error' ? 'Error' : 'Disconnected';

  const liveTask = useMemo(
    () => [...messages].reverse().find((m) => m.task && (m.task.status === 'working' || m.task.status === 'awaiting-approval'))?.task ?? null,
    [messages],
  );
  const agentWorking = busy || !!liveTask;
  const composerPlaceholder = !ws.token
    ? 'Sign in to message…'
    : !aiReady ? 'Connect AI to message…'
    : !connected && !deviceOnline ? 'Connect your screen or computer…'
    : 'Tell the agent what to do… e.g. Open the project and fix the login bug';

  return (
    <div className="mv">
      <div className="mv-topbar" role="status" aria-label="Monitor status">
        <span className="mv-pill" data-tone={deviceOnline ? 'ok' : 'idle'} title="Local agent connection">
          <Cpu size={13} /> Computer: {ws.device.name ?? 'none'}{deviceOnline ? ' · online' : ws.device.paired ? ' · offline' : ''}{ws.device.agentPlatform ? ` · ${ws.device.agentPlatform}` : ''}{ws.device.agentRoot ? ` · ${agentRootBase}` : ''}{rootMismatch ? ' · folder mismatch' : ''}
        </span>
        <span className="mv-pill" data-tone={connected && videoActive ? 'ok' : connected ? 'warn' : 'idle'} title="Screen capture">
          <Monitor size={13} /> Screen: {connected ? (videoActive ? source || 'live' : 'no frames') : status}
        </span>
        <button type="button" className="mv-pill mv-pill--btn" onClick={() => setDialog('project')} title="GitHub project / working context">
          <GitBranch size={13} /> Project: {ws.project ? `${ws.project.name} · ${ws.project.branch}` : 'not connected'}
          <ChevronDown size={12} />
        </button>
        <button type="button" className="mv-pill mv-pill--btn" data-tone={aiReady ? 'ok' : ws.providerState === 'limited' ? 'warn' : 'idle'} onClick={() => setDialog('ai')} title="AI provider">
          <Radio size={13} /> AI: {providerLabel} · {ws.providerState}{isLocalMode ? ' · local sub' : aiConnection ? ` · ${aiConnection.connectionType === 'subscription' ? 'Sub' : 'API'}` : ''}
          <ChevronDown size={12} />
        </button>
        <span className="mv-pill" data-tone={ws.backend?.online ? 'ok' : 'idle'} title="Backend service">
          Service: {ws.backend?.online ? 'online' : 'offline'}
        </span>
      </div>

      <div className="mv-workspace">
        <section className="mv-panel mv-computer" aria-labelledby="monitor-computer-title">
          <header className="mv-panel__head">
            <div className="mv-panel__lead">
              <span className="mv-panel__title"><Monitor size={15} strokeWidth={1.9} /> Computer</span>
              <span className="mv-status" data-tone={connected ? 'ok' : deviceOnline ? 'warn' : 'idle'}>
                <i aria-hidden="true" />
                {connected ? 'Connected' : deviceOnline ? 'Agent online' : 'Not connected'}
              </span>
              <span className="mv-panel__meta" data-testid="connection-label">{connected ? source : ws.device.name ?? 'No computer'}</span>
              <p role="status" aria-label="Screen connection" className="mv-visually-hidden">Screen: {status}</p>
            </div>
            <div className="mv-panel__tools">
              <button type="button" className="mv-chipbtn" onClick={() => setDialog('device')} title={deviceOnline ? ws.device.name ?? 'Paired computer' : 'Connect the local device agent'}>
                <Circle size={7} fill={deviceOnline ? '#12b76a' : '#98a2b3'} stroke="none" />
                {deviceOnline ? ws.device.name ?? 'Computer' : 'Select computer'}
                <ChevronDown size={12} />
              </button>
              <button type="button" className="mv-iconbtn" onClick={() => void ws.refreshDevice()} aria-label="Refresh computer connection" title="Refresh computer connection">
                <RefreshCw size={14} />
              </button>
              <span className="mv-panel__divider" aria-hidden="true" />
              <button type="button" className="mv-iconbtn" onClick={() => add('assistant', screenshot())} disabled={!connected || agentWorking} aria-label="Screenshot" title="Screenshot">
                <Camera size={15} />
              </button>
              <button type="button" className={`mv-iconbtn ${recording ? 'is-rec' : ''}`} onClick={() => add('assistant', recording ? stopRecording() : startRecording())} disabled={!connected || agentWorking} aria-label={recording ? 'Stop recording' : 'Record'} title={recording ? 'Stop recording' : 'Record'}>
                <Circle size={12} fill={recording ? 'currentColor' : 'none'} />
              </button>
              <button type="button" className="mv-iconbtn" onClick={() => add('assistant', runIntent('fullscreen'))} disabled={!connected} aria-label="Fullscreen" title="Fullscreen">
                <Maximize2 size={15} />
              </button>
              <button type="button" className="mv-iconbtn mv-iconbtn--danger" onClick={disconnect} disabled={!connected} aria-label="Disconnect" title="Disconnect screen">
                <Unplug size={15} />
              </button>
            </div>
          </header>
          <div className="mv-capture-controls">
            <div className="mv-capture-mode">
              <label>
                <input type="radio" name="captureMode" value="window" checked={captureMode === 'window'} onChange={() => setCaptureMode('window')} disabled={connected} />
                <span>Window</span>
              </label>
              <label>
                <input type="radio" name="captureMode" value="screen" checked={captureMode === 'screen'} onChange={() => setCaptureMode('screen')} disabled={connected} />
                <span>Full screen</span>
              </label>
              <button
                type="button"
                className={`mv-chipbtn ${agentView ? 'is-on' : ''}`}
                onClick={() => setAgentView((v) => !v)}
                disabled={!deviceOnline}
                title={deviceOnline ? 'Show the live desktop streamed by the device agent itself (works even when browser capture fails)' : 'Connect your computer first'}
                aria-pressed={agentView}
              >
                <Radio size={12} /> Agent view
              </button>
            </div>
            {captureMode === 'screen' && (
              <select value={selectedMonitor} onChange={(e) => setSelectedMonitor(Number(e.target.value))} className="mv-monitor-select" aria-label="Select monitor" disabled={connected}>
                {monitors.map((m) => (
                  <option key={m.index} value={m.index}>{m.name} ({m.width}×{m.height})</option>
                ))}
              </select>
            )}
          </div>
          <div className={`mv-stage ${connected || agentFrame ? 'is-connected' : ''} ${!videoActive && connected && !agentView ? 'muted' : ''}`} ref={screenRef}>
            {agentView && deviceOnline ? (
              agentFrame ? (
                <>
                  <img
                    src={agentFrame.image}
                    alt="Live desktop from your computer"
                    className="mv-stage__video"
                    style={{ transform: `scale(${zoom})` }}
                    onLoad={() => setAgentRendered((n) => n + 1)}
                  />
                  <span className="mv-overlay mv-overlay--agent" data-testid="agent-frame-counters">
                    Agent #{agentFrame.seq} · {Math.max(1, Math.round(agentFrame.bytes / 1024))} KB · received {agentReceived} · rendered {agentRendered} · {Math.max(0, Math.round((Date.now() - agentFrame.ts) / 1000))}s ago
                  </span>
                </>
              ) : (
                <div className="mv-blank">
                  <LoaderCircle size={22} className="spin" />
                  <strong>Starting agent stream…</strong>
                  <p>{agentStreamError || 'Your computer is capturing its desktop — the first frame arrives within seconds.'}</p>
                  <button type="button" className="mv-primary" onClick={() => setAgentView(false)}>Back to window capture</button>
                </div>
              )
            ) : (
            <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              hidden={conn === 'idle' || conn === 'error'}
              className="mv-stage__video"
              style={{ transform: `scale(${zoom})` }}
              onPlaying={() => { setVideoActive(true); setLastFrameAt(Date.now()); }}
              onTimeUpdate={() => setLastFrameAt(Date.now())}
              onWaiting={() => setVideoActive(false)}
              onStalled={() => setVideoActive(false)}
            />
            {!connected && (
              <div className="mv-blank">
                <span className="mv-blank__icon"><MonitorUp size={22} strokeWidth={1.6} /></span>
                <strong>{conn === 'connecting' ? 'Waiting for your screen…' : 'Connect your computer'}</strong>
                <p>{conn === 'connecting' ? 'Choose a window or screen in the browser prompt.' : 'Let Launchly see and work inside your selected window.'}</p>
                {deviceOnline && !connected && (
                  <p className="mv-blank__note">{ws.device.name ?? 'The local agent'} is online and ready to be controlled. Share a screen to see a live preview here.</p>
                )}
                <button type="button" className="mv-primary" onClick={connected ? disconnect : connect} disabled={!canShare || conn === 'connecting'}>
                  {conn === 'connecting' ? <><LoaderCircle size={15} className="spin" /> Connecting…</> : captureMode === 'screen' ? 'Connect screen' : 'Connect computer'}
                </button>
                {!canShare && <p className="mv-blank__note">This browser can’t share a screen. Try Chrome, Edge or another Chromium browser.</p>}
              </div>
            )}
            {connected && (!videoActive || staleCapture) && (
              <div className="mv-muted-overlay">
                <AlertTriangle size={24} strokeWidth={1.5} />
                <strong>No video frames</strong>
                <p>{staleCapture && videoActive ? 'No new frame for a while — the capture may be frozen.' : 'The shared window/screen is minimized, occluded, or not sending frames.'}</p>
                <p className="mv-muted-hint">Restore the window — the black preview is paused until frames arrive.</p>
                <button type="button" className="mv-primary" onClick={restartCapture}>Restart capture</button>
              </div>
            )}
            {connected && pointer && <span className="mv-aim" style={pointerStyle()} aria-hidden="true" />}
            {recording && <span className="mv-overlay mv-overlay--rec"><i aria-hidden="true" /> Recording</span>}
            {paused && <span className="mv-overlay mv-overlay--right">Paused</span>}
            </>
            )}
          </div>
          <footer className="mv-window-footer">
            <span data-testid="connection-label">{agentView && deviceOnline ? (agentFrame ? `Agent view · frame #${agentFrame.seq}` : 'Agent view · waiting for frames') : connected ? `${source}${lastFrameAt ? ` · frame ${Math.max(0, Math.round((Date.now() - lastFrameAt) / 1000))}s ago` : ''}` : 'No screen connected'}</span>
            <button type="button" className="mv-primary" onClick={connected ? disconnect : connect} disabled={!canShare || conn === 'connecting'}>
              {connected ? 'Disconnect' : conn === 'connecting' ? 'Connecting…' : captureMode === 'screen' ? 'Connect Screen' : 'Connect Window'}
            </button>
          </footer>
          {rootMismatch && (
            <p className="mv-panel__error" role="alert">Agent serves folder “{agentRootBase}” but the project is “{ws.project!.name}” — restart the agent with --root at the project folder so file tools land in the right place.</p>
          )}
          {ws.device.agentRoot && !rootMismatch && ws.project?.source === 'local' && (
            <p className="mv-panel__note" role="status">Agent folder matches project “{ws.project.name}”.</p>
          )}
          {!canShare && <p className="mv-panel__error">Screen sharing is unavailable in this browser. Use Chrome or Edge.</p>}
          {captureMuted && <p className="mv-panel__error" role="status">The selected window is not sending frames. Keep it open and unminimized.</p>}
          {connectError && <p className="mv-panel__error" role="alert">{connectError}</p>}
        </section>

        <section className="mv-panel mv-agent" aria-labelledby="monitor-ai-title">
          <header className="mv-panel__head mv-agent__head">
            <div>
              <h2 id="monitor-ai-title">Coding agent</h2>
              <p role="status" aria-label="AI connection">
                {providerLabel} · {ws.providerState}{isLocalMode ? ' · local subscription' : aiConnection ? ` · ${aiConnection.connectionType === 'subscription' ? 'Subscription' : 'API'}` : ''}
                {ws.project ? ` · ${ws.project.name}:${ws.project.branch}` : ' · no project'}
                {liveTask ? ` · ${liveTask.actionsExecuted}/${liveTask.maxActions} actions` : ''}
              </p>
            </div>
            <div className="mv-agent__head-actions">
              <button type="button" className="mm-btn" onClick={() => setDialog('project')}>Project</button>
              <button type="button" className="mm-btn" disabled={agentWorking || ws.providerState === 'connecting'} onClick={() => setDialog('ai')}>Connect AI</button>
            </div>
          </header>
          <AgentConversation
            messages={messages}
            activeTask={liveTask}
            busy={busy}
            onApprove={(taskId, msgId) => void approvePending(taskId, msgId)}
            onCancel={() => void emergencyStop()}
            onApplyChanges={(msgId, task) => void applyChanges(msgId, task)}
            onUndoChanges={(msgId, task) => void undoChanges(msgId, task)}
            onSuggest={(text) => void send(text)}
          />
          {ws.providerMessage && (
            <div className="mv-panel__error" role="alert">
              <p>{ws.providerMessage}</p>
              <button type="button" className="mm-btn" onClick={() => setDialog('api')}>Switch to API</button>
              {selectedProvider && !isLocalMode && <button type="button" className="mm-btn" onClick={() => void ws.verifyProvider(selectedProvider)}>Retry connection</button>}
              {isLocalMode && <button type="button" className="mm-btn" onClick={() => void ws.refreshLocalCli()}>Recheck computer</button>}
            </div>
          )}
          {liveTask && (liveTask.status === 'working' || liveTask.status === 'awaiting-approval') && (
            <div className="mv-taskbar" role="status" aria-label="Task progress">
              <LoaderCircle size={13} className="spin" />
              <div className="mv-taskbar__track">
                <div
                  className="mv-taskbar__fill"
                  style={{ width: `${Math.min(100, Math.round((liveTask.actionsExecuted / Math.max(1, liveTask.maxActions)) * 100))}%` }}
                />
              </div>
              <span>{liveTask.status === 'awaiting-approval' ? 'Waiting for your approval' : `Working · ${liveTask.actionsExecuted}/${liveTask.maxActions} actions`}</span>
              <button type="button" className="mm-btn" onClick={() => void emergencyStop()}>Stop</button>
            </div>
          )}
          <AgentComposer
            ref={composerRef}
            disabled={!chatReady || ws.providerState === 'connecting'}
            placeholder={composerPlaceholder}
            onSend={(text) => void send(text)}
            onStop={() => void emergencyStop()}
            busy={agentWorking}
            modelSelection={ws.selection}
            models={ws.models}
            providers={ws.providers}
            onModelChange={ws.setSelection}
            project={ws.project}
            projects={ws.projects}
            onProjectChange={(p) => { if (p) ws.setProject(p); }}
            onConnectProject={() => setDialog('project')}
            localCli={ws.localCli}
            permissions={ws.permissions}
            onPermissionsChange={ws.setPermissions}
          />
        </section>
      </div>
      {dialog === 'ai' && (
        <CodingConnectionModal
          token={ws.token}
          providers={ws.providers}
          selectedProvider={selectedProvider}
          localCli={ws.localCli}
          localCliLoading={ws.localCliLoading}
          deviceOnline={ws.device.online}
          onClose={() => setDialog(null)}
          onChanged={() => void ws.refresh()}
          onSelect={(p) => { void ws.selectProvider(p).then(() => setDialog(null)); }}
          onSelectLocal={(p) => { ws.setSelection({ mode: 'local', provider: p }); void ws.refreshLocalCli(); setDialog(null); }}
          onRefreshLocal={() => void ws.refreshLocalCli()}
          onOpenDevice={() => setDialog('device')}
        />
      )}
      {dialog === 'api' && (
        <AIProviderModal
          token={ws.token}
          providers={ws.providers}
          initialProvider={selectedProvider ?? 'openai'}
          onClose={() => setDialog(null)}
          onChanged={() => void ws.refresh()}
          onConnected={(p) => { void ws.selectProvider(p).then(() => setDialog(null)); }}
        />
      )}
      {dialog === 'device' && (
        <DeviceConnectionModal
          token={ws.token}
          agentAvailable={!!ws.backend?.capabilities.agent}
          online={ws.device.online}
          deviceName={ws.device.name}
          onClose={() => setDialog('ai')}
          onPaired={() => void ws.refreshDevice()}
        />
      )}
      {dialog === 'project' && (
        <ProjectConnectionModal
          token={ws.token}
          backend={ws.backend}
          onClose={() => setDialog(null)}
          onConnected={(p) => { ws.rememberProject(p); setDialog(null); }}
        />
      )}
    </div>
  );
}
