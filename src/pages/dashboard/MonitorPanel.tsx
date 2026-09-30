import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Camera, Circle, LoaderCircle, Maximize2, Mic, Monitor, MonitorUp, RotateCcw, ChevronDown, Plus, ShieldCheck, Square, Terminal, X } from 'lucide-react';
import { useMonitorWorkspace } from './monitor/useMonitorWorkspace';
import { monitorApi } from './monitor/monitorApi';
import { ProjectSelector } from './monitor/ProjectSelector';
import { ProjectConnectionModal } from './monitor/ProjectConnectionModal';
import { CodingConnectionModal } from './monitor/CodingConnectionModal';
import { MonitorPermissions } from './monitor/MonitorPermissions';
import { AgentActivity, ChangeSummary } from './monitor/AgentActivity';
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
            'You help the user with what is on their shared screen. Be brief and practical. You cannot click or type for them — tell them exactly where to click instead. Only describe what is actually visible.',
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
  const [dialog, setDialog] = useState<null | 'project' | 'ai' | 'perms'>(() => new URLSearchParams(window.location.search).get('github') === 'connect' ? 'project' : null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [conn, setConn] = useState<Conn>('idle');
  const [connectError, setConnectError] = useState('');
  const [source, setSource] = useState('');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
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

  /** Tear down everything tied to the active connection, synchronously. */
  const disconnect = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
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
        videoRef.current?.pause();
        setPaused(true);
        return 'Paused. The view is frozen until you resume.';
      case 'resume':
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
              `Found “${hit.text}” at the ${describeArea(hit.x, hit.y)} of your screen — I’m pointing at it.` +
              (wantsClick ? ' I can’t click on your computer from a website, so click where the pointer is.' : ''),
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

  /** Send a coding request to the Monitor backend agent and follow its progress. */
  async function runAgent(prompt: string) {
    if (!projectReady) { add('assistant', 'Connect a project and AI with an available coding runtime before sending a coding task.'); return; }
    const project = ws.project!;
    const task: AgentTask = {
      id: `local-${nextId}`,
      prompt,
      status: 'working',
      activity: [{ id: 'u', tool: 'understand', label: 'Understanding request…', status: 'running' }],
      changes: null,
      error: null,
    };
    const id = add('assistant', '', undefined);
    update(id, { task });
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const setTask = (t: AgentTask) => requestRef.current === controller && update(id, { task: t });
    try {
      const started = await monitorApi.runTask(ws.token, { projectId: project.id, prompt, model: ws.selection, permissions: ws.permissions });
      if (!started.ok) {
        setTask({
          ...task,
          status: 'error',
          activity: [{ ...task.activity[0], status: 'error' }],
          error: started.reason === 'not_configured' ? 'The project agent isn’t available on the server yet.' : started.message,
        });
        return;
      }
      // Follow the server-side task until it finishes or needs approval.
      for (let i = 0; i < 600 && requestRef.current === controller; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const r = await monitorApi.getTask(ws.token, started.data.taskId);
        if (!r.ok) {
          setTask({ ...task, status: 'error', error: r.message });
          return;
        }
        setTask(r.data);
        if (r.data.status !== 'working') return;
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
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

  return (
    <div className={`mv ${conn !== 'idle' ? 'mv--sharing' : 'mv--workspace'}`}>
      <header className="mv-head">
        <div>
          <div className="mv-heading"><span className="mv-heading-icon" aria-hidden="true"><Monitor size={21} strokeWidth={1.6} /></span><h1 className="mv-title">Monitor</h1></div>
          <p className="mv-sub">Your live screen on the left. Your assistant on the right.</p>
        </div>
        <div className="mv-head-actions">
        <span className={`mv-pill ${ws.online ? 'mv-pill--live' : ''}`} title={ws.online ? 'Monitor service is available' : 'Monitor service isn’t reachable'}>
          <i />
          {ws.online ? 'Online' : 'Offline'}
        </span>
        </div>
      </header>
      {connectError && <p className="mv-connection-error" role="alert">{connectError}</p>}

      <div className="mv-grid">
        {/* ---------------- Screen ---------------- */}
        <section className={`mv-card mv-card--screen ${connected ? 'is-live' : ''}`}>
          <header className="mv-card__head">
            <span className="mv-card__title">
              <span className="mv-panel-icon"><Monitor size={16} strokeWidth={1.9} /></span> Screen
              <span className="mv-visually-hidden" role="status">{status}</span>
              {connected && (
                <span className="mv-card__meta" data-testid="connection-label">
                  <i className="mv-live-dot" /> Connected <span className="mv-sep">·</span> {source}
                </span>
              )}
              {!connected && (
                <span className="mv-card__meta mv-card__meta--muted" data-testid="connection-label">
                  {conn === 'connecting' ? 'Connecting…' : 'Not connected'}
                </span>
              )}
            </span>
            <div className="mv-tools">
              {connected && (
                <>
                  <button type="button" className="mv-tool" onClick={() => send('Take a screenshot')} disabled={busy} title="Screenshot" aria-label="Screenshot">
                    <Camera size={15} />
                  </button>
                  <button
                    type="button"
                    className={`mv-tool ${recording ? 'is-rec' : ''}`}
                    onClick={() => send(recording ? 'Stop recording' : 'Start recording')}
                    disabled={busy}
                    title={recording ? 'Stop recording' : 'Record'}
                    aria-label={recording ? 'Stop recording' : 'Record'}
                  >
                    <Circle size={13} fill={recording ? 'currentColor' : 'none'} />
                  </button>
                </>
              )}
              <button type="button" className="mv-tool" onClick={() => connected && send('fullscreen')} disabled={!connected} title="Fullscreen" aria-label="Fullscreen">
                <Maximize2 size={15} />
              </button>
              {connected && (
                <button type="button" className="mv-stop" onClick={disconnect}>
                  <Square size={8} fill="currentColor" /> Stop sharing
                </button>
              )}
            </div>
          </header>

          <div ref={screenRef} className="mv-screen">
            <video ref={videoRef} muted playsInline hidden={!connected} style={{ transform: `scale(${zoom})` }} />
            {!connected && (
              <div className="mv-empty">
                <span className="mv-empty__icon">
                  {conn === 'connecting' ? <LoaderCircle size={26} className="spin" /> : <MonitorUp size={28} strokeWidth={1.5} />}
                </span>
                <span className="mv-empty__eyebrow">YOUR LIVE WORKSPACE</span>
                <h2>{conn === 'connecting' ? 'Choose what to share' : 'Bring your screen into focus'}</h2>
                <p>
                  {conn === 'connecting'
                    ? 'Pick a screen or window in your browser’s prompt.'
                    : 'Share a window or your screen to work alongside your assistant.'}
                </p>
                {conn === 'idle' && <button type="button" className="mv-cta" onClick={connect} disabled={!canShare}><MonitorUp size={16} /> Connect screen</button>}
                <span className="mv-empty__privacy"><ShieldCheck size={13} /> You choose what to share</span>
                {connectError && <p className="mv-empty__error">{connectError}</p>}
              </div>
            )}
            {connected && (
              <div className={`mv-cursor ${pointer ? 'is-pointing' : input.trim() || busy || listening ? 'is-still' : ''}`} style={pointerStyle()} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <path d="M3.5 2.2c-.5-.2-1 .3-.8.8l5.6 16.1c.2.6 1 .6 1.2 0l2.1-6 6-2.1c.6-.2.6-1 0-1.2z" fill="#2563eb" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            {connected && recording && (
              <span className="mv-badge mv-badge--rec">
                <i /> Recording
              </span>
            )}
            {connected && paused && <span className="mv-badge mv-badge--right">Paused</span>}
          </div>
        </section>

        {/* ---------------- Chat ---------------- */}
        <section className={`mv-card mv-card--chat ${chatReady ? '' : 'is-disabled'}`}>
          <header className="mv-card__head mv-assistant-head">
            <div className="mv-assistant-identity">
              <span className="mv-assistant-mark" aria-hidden="true"><Terminal size={20} strokeWidth={1.8} /></span>
              <div className="mv-assistant-copy"><span className="mv-assistant-name">Assistant</span><span className="mv-assistant-caption">{busy ? 'Working on your request' : 'Your workspace companion'}</span></div>
            </div>
            <button
              type="button"
              className="mv-tool"
              onClick={() => setMessages([])}
              disabled={!chatReady || messages.length === 0}
              title="Clear chat"
              aria-label="Clear chat"
            >
              <RotateCcw size={14} />
            </button>
          </header>

          <div className="mv-thread" ref={listRef} aria-live="polite">
            {!chatReady || messages.length === 0 ? (
              <div className="mv-thread__empty">
                <span className="mv-thread__icon">
                  <Terminal size={30} strokeWidth={1.5} />
                </span>
                <strong>{ws.project ? `What should we build in ${ws.project.name}?` : 'What should we build?'}</strong>
                <p>{!chatReady ? ws.project && !ws.backend?.capabilities.agent ? 'Project selected. The coding runtime must be configured before you can start coding.' : 'Connect a project or share your screen to get started.' : connected ? 'Ask me to take a screenshot, record, zoom or go fullscreen.' : `Ask for a change in ${ws.project!.name}.`}</p>
                {connected && (
                  <div className="mv-suggest">
                    {['Take a screenshot', 'Start recording', 'Zoom in'].map((q) => (
                      <button key={q} type="button" onClick={() => send(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`mv-msg mv-msg--${m.role} ${m.status ? `is-${m.status}` : ''}`}>
                  {m.task ? (
                    <>
                      <AgentActivity task={m.task} />
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
            <div className="mv-compose-project">
              <ProjectSelector project={ws.project} projects={ws.projects} loading={ws.projectsLoading} error={ws.projectsError}
                onRefresh={ws.refreshProjects} onSelect={p => { ws.setProject(p); setMessages([]); }} onConnect={() => setDialog('project')} />
            </div>
            <div className="mv-compose-box">
            <textarea ref={inputRef} value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Do anything"
              disabled={!chatReady} rows={2} aria-label="Message" />
            <div className="mv-compose-tools">
              <div className="mv-compose-left">
                <button type="button" className="mv-compose-icon" aria-label="Add project" title="Connect project" onClick={() => inputRef.current?.closest('form')?.querySelector<HTMLButtonElement>('.mp-context > button')?.click()}><Plus size={16} /></button>
                <button type="button" className="mv-compose-text mv-compose-access" onClick={() => setDialog('perms')} aria-label="Monitor permissions" title="Manage project permissions">
                  <ShieldCheck size={15} />
                  {ws.permissions.readFiles && ws.permissions.searchFiles && ws.permissions.editFiles && ws.permissions.createFiles && ws.permissions.runDevCommands ? 'Full access' : 'Limited access'} <ChevronDown size={12} />
                </button>
              </div>
              <div className="mv-compose-right">
                {input.length >= MAX_CHARS * .9 && <span className="mv-count">{input.length}/{MAX_CHARS}</span>}
                <button type="button" className="mv-compose-text mv-compose-ai" onClick={() => setDialog('ai')}>
                  {aiReady ? (selectedProvider === 'openai' ? 'OpenAI API' : 'Anthropic API') : 'Connect AI'} <ChevronDown size={12} />
                </button>
                <button type="button" className={`mv-compose-icon ${listening ? 'is-listening' : ''}`}
                  disabled={!Speech || !chatReady || busy} onClick={toggleVoice}
                  aria-label={listening ? 'Stop listening' : 'Voice'} title={Speech ? 'Voice' : 'Voice is unavailable in this browser'}>
                  {listening ? <X size={16} /> : <Mic size={16} />}
                </button>
                <button type="submit" className="mv-send" disabled={!chatReady || busy || !input.trim()} aria-label="Send">
                  {busy ? <LoaderCircle size={15} className="spin" /> : <ArrowUp size={15} strokeWidth={2.4} />}
                </button>
              </div>
            </div>
            </div>
          </form>
        </section>
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
      {dialog === 'ai' && <CodingConnectionModal token={ws.token} providers={ws.providers} selectedProvider={selectedProvider} onClose={() => setDialog(null)} onChanged={ws.refresh} onSelect={provider => ws.setSelection({ mode: 'latest', provider })} />}
      {dialog === 'perms' && <MonitorPermissions value={ws.permissions} onChange={ws.setPermissions} onClose={() => setDialog(null)} />}
    </div>
  );
}
