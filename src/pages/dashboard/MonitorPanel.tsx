import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Monitor, Settings, ChevronDown } from 'lucide-react';
import { useMonitorWorkspace } from './monitor/useMonitorWorkspace';
import { monitorApi } from './monitor/monitorApi';
import type { AgentTask } from './monitor/types';
import { attachWindowPreview } from './monitor/windowPreview';
import { CodingConnectionModal } from './monitor/CodingConnectionModal';
import { AgentConversation, type ConvMsg } from './monitor/AgentConversation';
import './monitor.css';

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
  if (/\b(zoom in|enlarge|magnify)\b/.test(t)) return 'zoom-in';
  return null;
}

let nextId = 1;

export function MonitorPanel() {
  const [dialog, setDialog] = useState<'ai' | null>(null);
  const ws = useMonitorWorkspace();
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const captureGeneration = useRef(0);
  const capturePending = useRef(false);
  const previewCleanup = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const activeTaskRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = ws.token;
  /** Last manual screenshot — attached to the next AI request so the agent can inspect it. */
  const lastScreenshotRef = useRef<string | null>(null);

  const [conn, setConn] = useState<Conn>('idle');
  const [connectError, setConnectError] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [videoActive, setVideoActive] = useState(false);
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [, setNow] = useState(Date.now());

  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const connected = conn === 'connected';

  const selectedProvider = ws.selection.mode === 'auto' ? null : ws.selection.provider;
  const isLocalMode = ws.selection.mode === 'local';
  const aiConnection = ws.providers.find((p) => p.provider === selectedProvider);
  const aiReady = !!ws.token && ws.providerState === 'connected' && (isLocalMode || !!aiConnection?.connected);
  const deviceOnline = ws.device.online;

  // Chat input is intentionally independent from screen state.
  // Screen sharing must NEVER disable the composer.
  const composerBusy = busy;
  const placeholder = !ws.token
    ? 'Sign in to message…'
    : !aiReady
      ? 'Message the AI about your computer…'
      : 'Message the AI about your computer…';

  useEffect(() => {
    if (!connected) return;
    const v = videoRef.current;
    if (!v) return;
    const resume = () => {
      if (streamRef.current && v.paused) v.play?.()?.catch?.(() => {});
    };
    v.addEventListener('pause', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      v.removeEventListener('pause', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [connected]);

  const stopStreamOnly = useCallback(() => {
    ++captureGeneration.current;
    capturePending.current = false;
    previewCleanup.current?.();
    previewCleanup.current = null;
    setVideoActive(false);
    setLastFrameAt(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setConn('idle');
  }, []);

  useEffect(() => () => stopStreamOnly(), [stopStreamOnly]);

  async function connect() {
    if (capturePending.current || streamRef.current) return;
    capturePending.current = true;
    const generation = ++captureGeneration.current;
    setConnectError('');
    setConn('connecting');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as MediaTrackConstraints,
        audio: false,
      } as DisplayMediaStreamOptions);
      if (generation !== captureGeneration.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const track = stream.getVideoTracks()[0];
      streamRef.current = stream;
      if (!track || track.readyState === 'ended' || !videoRef.current) throw new Error('No live video track.');
      previewCleanup.current = attachWindowPreview(videoRef.current, stream, {
        ready: () => {
          if (generation !== captureGeneration.current) return;
          capturePending.current = false;
          setConn('connected');
          setVideoActive(true);
        },
        ended: () => { stopStreamOnly(); },
        muted: (muted) => { setVideoActive(!muted); },
        error: (message) => { if (generation === captureGeneration.current) { stopStreamOnly(); setConn('error'); setConnectError(message); } },
      });
      track.addEventListener('ended', () => stopStreamOnly());
    } catch (error) {
      if (generation !== captureGeneration.current) return;
      stopStreamOnly();
      if (!(error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'NotAllowedError')) {
        setConn('error');
        setConnectError('Screen sharing failed. Check browser permissions and try again.');
      } else {
        setConn('idle');
      }
    }
  }

  /** Reload the screen stream WITHOUT touching chat state or messages. */
  function reloadStream() {
    stopStreamOnly();
    setTimeout(() => connect(), 150);
  }

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [connected]);

  const staleCapture = connected && lastFrameAt !== null && Date.now() - lastFrameAt > 45000;

  const add = (role: Role, text: string, status?: Msg['status']) => {
    const m = { id: nextId++, role, text, status };
    setMessages((list) => [...list.slice(-80), m]);
    return m.id;
  };
  const update = (id: number, patch: Partial<Msg>) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

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

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function takeScreenshot() {
    const v = videoRef.current;
    if (!v?.videoWidth) { add('assistant', 'There is nothing on screen to capture yet.'); return; }
    const frame = captureFrame();
    if (frame) lastScreenshotRef.current = frame;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && download(b, `launchly-screenshot-${Date.now()}.png`), 'image/png');
    add('assistant', 'Screenshot captured — I can see the current screen and will use it for your next message.');
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
          ? { ...m, task: { ...m.task, status: 'stopped', error: 'Stopped.' } }
          : m
      )
    );
    if (taskId && ws.token) {
      try { await monitorApi.stopTask(ws.token, taskId); } catch { /* already stopped */ }
    }
    add('assistant', 'Stopped.');
  }

  async function approvePending(taskId: string, msgId: number) {
    const r = await monitorApi.approveTask(ws.token, taskId);
    if (!r.ok) {
      setMessages((list) => list.map((m) => (m.id === msgId && m.task ? { ...m, task: { ...m.task, error: r.message ?? 'Could not approve.' } } : m)));
    }
  }

  async function runAgent(prompt: string) {
    const frame = captureFrame() ?? lastScreenshotRef.current;
    const task: AgentTask = {
      id: `local-${nextId}`,
      prompt,
      status: 'working',
      activity: [{ id: 'u', tool: 'understand', label: frame ? 'Looking at your screen…' : 'Starting…', status: 'running' }],
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
        monitorIndex: 0,
      });
      if (requestRef.current !== controller) {
        if (started.ok) void monitorApi.stopTask(ws.token, started.data.taskId);
        return;
      }
      if (!started.ok) {
        if (started.failure) ws.reportProviderFailure(started.failure);
        activeTaskRef.current = null;
        setTask({ ...task, status: 'error', activity: [{ ...task.activity[0], status: 'error' }], error: started.message ?? 'Could not start the task.' });
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
            if (requestRef.current === controller) { requestRef.current = null; activeTaskRef.current = null; setBusy(false); }
          }
          if (r.data.status === 'awaiting-approval') continue;
          return;
        }
      }
      if (requestRef.current === controller && activeTaskRef.current) {
        try { await monitorApi.stopTask(ws.token, activeTaskRef.current); } catch { /* ignore */ }
      }
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; activeTaskRef.current = null; setBusy(false); }
    }
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    // AI not configured yet — keep the message so nothing is lost, guide to connect.
    if (!aiReady) {
      add('you', text);
      add('assistant', 'Connect an AI provider to chat — click the Model menu or Settings (⚙) in the top-right.');
      setDialog('ai');
      return;
    }
    add('you', text);
    // Prefer the device agent when available; otherwise fall back to vision chat.
    if (deviceOnline && ws.backend?.capabilities.agent) return runAgent(text);

    const v = videoRef.current;
    const frame = captureFrame() ?? lastScreenshotRef.current;
    if (!v?.videoWidth && !frame) {
      add('assistant', 'I can’t see your screen yet. Connect your computer on the left, then ask again.');
      return;
    }
    const id = add('assistant', '', 'pending');
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const stillCurrent = () => requestRef.current === controller && !controller.signal.aborted;
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
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
        update(id, { text: controller.signal.aborted ? 'That took too long. Please try again.' : e instanceof Error ? e.message : 'Something went wrong.', status: 'error' });
      }
    } finally {
      clearTimeout(timer);
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || composerBusy) return;
    setInput('');
    void send(text);
    // keep focus so the user can keep typing while the screen shares
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function onComposerKeyDown(e: React.KeyboardEvent) {
    // Never let global handlers hijack typing; stop propagation here.
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const modelLabel = ws.selection.mode === 'auto'
    ? 'Auto'
    : ws.selection.mode === 'local'
      ? ws.selection.provider === 'anthropic' ? 'Claude Code' : 'Codex CLI'
      : ws.selection.provider === 'anthropic' ? 'Claude' : ws.selection.provider === 'openai' ? 'OpenAI' : 'AI';

  const connectedProviders = ws.providers.filter((p) => p.connected);

  return (
    <div className="mv">
      <div className="mv-workspace">
        {/* LEFT — real computer screen */}
        <section className="mv-panel mv-computer" aria-label="Computer">
          <header className="mv-panel__head">
            <div className="mv-panel__lead">
              <span className="mv-panel__title"><Monitor size={15} strokeWidth={1.9} /> Computer</span>
              <span className="mv-status" data-tone={connected ? 'ok' : 'idle'}>
                <i aria-hidden="true" />
                {connected ? 'Connected' : 'Not connected'}
              </span>
              <p role="status" aria-label="Screen connection" className="mv-visually-hidden">Screen: {conn === 'connecting' ? 'Connecting' : connected ? 'Connected' : conn === 'error' ? 'Error' : 'Disconnected'}</p>
            </div>
            {connected && (
              <div className="mv-panel__tools">
                <button type="button" className="mv-iconbtn" onClick={reloadStream} aria-label="Reload screen stream" title="Reload screen stream (keeps chat connected)">
                  <RefreshCw size={14} />
                </button>
                <button type="button" className="mv-iconbtn" onClick={takeScreenshot} aria-label="Screenshot" title="Capture screenshot for the AI">
                  <Camera size={15} />
                </button>
              </div>
            )}
          </header>

          <div className={`mv-stage ${connected ? 'is-connected' : ''}`} ref={screenRef}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              hidden={conn === 'idle' || conn === 'error'}
              className="mv-stage__video"
              onPlaying={() => { setVideoActive(true); setLastFrameAt(Date.now()); }}
              onTimeUpdate={() => setLastFrameAt(Date.now())}
              onWaiting={() => setVideoActive(false)}
              onStalled={() => setVideoActive(false)}
            />
            {!connected && (
              <div className="mv-blank">
                <strong>{conn === 'connecting' ? 'Waiting for your screen…' : 'Connect your computer'}</strong>
                {conn !== 'connecting' && (
                  <button type="button" className="mv-primary" onClick={connect} disabled={!canShare}>
                    Connect computer
                  </button>
                )}
                {conn === 'error' && connectError && <p className="mv-panel__error" role="alert">{connectError}</p>}
                {!canShare && <p className="mv-blank__note">This browser can’t share a screen. Try Chrome or Edge.</p>}
              </div>
            )}
            {connected && (!videoActive || staleCapture) && (
              <div className="mv-muted-overlay">
                <strong>Stream paused</strong>
                <p>Restore the shared window — or reload the stream. Your chat stays connected.</p>
                <button type="button" className="mv-primary" onClick={reloadStream}>Reload</button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — AI agent */}
        <section className="mv-panel mv-agent" aria-label="AI Agent">
          <header className="mv-panel__head mv-agent__head">
            <span className="mv-panel__title">AI Agent</span>
            <p role="status" aria-label="AI connection" className="mv-visually-hidden">AI: {ws.providerState}</p>
            <div className="mv-agent__head-actions">
              <label className="mv-modelwrap" title="Choose the AI model">
                <select
                  value={ws.selection.mode === 'auto' ? 'auto' : `${ws.selection.mode}:${ws.selection.provider ?? ''}${ws.selection.mode === 'exact' ? `:${(ws.selection as { modelId?: string }).modelId ?? ''}` : ''}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'auto') { ws.setSelection({ mode: 'auto' }); return; }
                    const [mode, provider, modelId] = v.split(':');
                    if (mode === 'local') { ws.setSelection({ mode: 'local', provider: provider as 'anthropic' | 'openai' }); void ws.refreshLocalCli(); return; }
                    if (mode === 'exact' && modelId) { ws.setSelection({ mode: 'exact', provider: provider as 'anthropic' | 'openai', modelId }); return; }
                    ws.setSelection({ mode: 'latest', provider: provider as 'anthropic' | 'openai' });
                  }}
                  className="mv-modelselect"
                  aria-label="AI model"
                >
                  <option value="auto">Model: Auto</option>
                  {connectedProviders.map((p) => (
                    <option key={p.provider} value={`latest:${p.provider}`}>Model: {p.provider === 'anthropic' ? 'Claude' : 'OpenAI'} · Latest</option>
                  ))}
                  <option value="local:anthropic">Claude Code (local)</option>
                  <option value="local:openai">Codex CLI (local)</option>
                  {ws.models.filter((m) => m.available).slice(0, 20).map((m) => (
                    <option key={`${m.provider}:${m.modelId}`} value={`exact:${m.provider}:${m.modelId}`}>{m.displayName}</option>
                  ))}
                </select>
                <ChevronDown size={12} aria-hidden="true" />
              </label>
              {!aiReady && (
                <button type="button" className="mm-btn" onClick={() => setDialog('ai')}>
                  Connect AI
                </button>
              )}
              <button type="button" className="mv-iconbtn" onClick={() => setDialog('ai')} aria-label="AI settings" title="AI settings">
                <Settings size={15} />
              </button>
            </div>
          </header>

          <div className="mv-convwrap">
            {messages.length === 0 ? (
              <div className="mv-conv__empty">
                <p>Ask about what’s on your screen, or tell the agent what to do.</p>
              </div>
            ) : (
              <AgentConversation
                messages={messages}
                activeTask={[...messages].reverse().find((m) => m.task && (m.task.status === 'working' || m.task.status === 'awaiting-approval'))?.task ?? null}
                busy={busy}
                onApprove={(taskId, msgId) => void approvePending(taskId, msgId)}
                onCancel={() => void emergencyStop()}
                onApplyChanges={() => {}}
                onUndoChanges={() => {}}
              />
            )}
          </div>

          {/* ONE permanent composer — never disabled by screen state */}
          <form className="mv-composer" onSubmit={submit}>
            <button
              type="button"
              className="mv-plusbtn"
              aria-label="Attach context"
              title="Attach context"
              onClick={() => { add('assistant', 'Attachments: connect a project from Settings to attach files.'); }}
            >
              +
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 8000))}
              onKeyDown={onComposerKeyDown}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              placeholder={placeholder}
              disabled={composerBusy}
              rows={1}
              maxLength={8000}
              aria-label="Message the coding agent"
              spellCheck={false}
              autoComplete="off"
              data-testid="ai-composer-input"
            />
            <button
              type="submit"
              className="mv-sendbtn"
              disabled={!input.trim() || composerBusy}
              aria-label="Send message"
              title="Send"
              data-testid="ai-composer-send"
            >
              ↑
            </button>
          </form>
          <span className="mv-visually-hidden" aria-hidden="true">{modelLabel}</span>
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
          onOpenDevice={() => setDialog(null)}
        />
      )}
    </div>
  );
}
