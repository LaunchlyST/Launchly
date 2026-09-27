import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Camera, Circle, LoaderCircle, Maximize2, MessageSquare, Mic, Monitor, MonitorUp, RotateCcw, Square, X } from 'lucide-react';
import { useStore } from '../../store';
import './monitor.css';

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
type Msg = { id: number; role: Role; text: string; status?: 'pending' | 'error' };

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

  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const Speech = typeof window !== 'undefined' ? getSpeechRecognition() : null;
  const connected = conn === 'connected';

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
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  async function connect() {
    if (conn !== 'idle') return;
    setConnectError('');
    setConn('connecting');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', frameRate: 30 } as MediaTrackConstraints,
        audio: false,
      });
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

  function currentFrame(maxWidth = 1600): string | null {
    const v = videoRef.current;
    if (!v?.videoWidth) return null;
    const scale = Math.min(1, maxWidth / v.videoWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
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
        screenRef.current?.requestFullscreen?.().catch(() => {});
        return 'Fullscreen on. Press Esc to exit.';
      case 'disconnect':
        return '';
    }
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy || !connected) return;
    setInput('');
    add('you', text);

    const intent = interpret(text);
    if (intent === 'disconnect') return disconnect();
    if (intent) {
      add('assistant', runIntent(intent));
      return;
    }

    if (!openaiKey) {
      add(
        'assistant',
        'I can’t answer open questions without an AI key. I can take screenshots, record, pause, zoom or go fullscreen — or add your OpenAI key in Settings → API Keys and I’ll answer questions about your screen too.'
      );
      return;
    }

    const image = currentFrame();
    if (!image) {
      add('assistant', 'I can’t see your screen yet. Give it a second and try again.', 'error');
      return;
    }
    const id = add('assistant', '', 'pending');
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const answer = await askOpenAI(openaiKey, image, text, controller.signal);
      if (requestRef.current === controller) update(id, { text: answer, status: undefined });
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

  function toggleVoice() {
    if (!Speech || !connected) return;
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
    <div className="mv">
      <header className="mv-head">
        <div>
          <h1 className="mv-title">Monitor</h1>
          <p className="mv-sub">Share a screen and control it by typing or talking.</p>
        </div>
        <span className={`mv-pill mv-pill--${status.toLowerCase()}`} role="status">
          <i />
          {status}
        </span>
      </header>

      <div className="mv-grid">
        {/* ---------------- Screen ---------------- */}
        <section className={`mv-card mv-card--screen ${connected ? 'is-live' : ''}`}>
          <header className="mv-card__head">
            <span className="mv-card__title">
              <Monitor size={16} strokeWidth={1.9} /> Screen
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
                <h2>{conn === 'connecting' ? 'Choose what to share' : 'Share your screen'}</h2>
                <p>
                  {conn === 'connecting'
                    ? 'Pick a screen or window in your browser’s prompt.'
                    : 'Your screen appears here live. Nothing is saved unless you ask for a screenshot or recording.'}
                </p>
                {conn !== 'connecting' && (
                  <button type="button" className="mv-cta" onClick={connect} disabled={!canShare}>
                    <MonitorUp size={16} strokeWidth={2} /> {canShare ? 'Connect screen' : 'Not supported in this browser'}
                  </button>
                )}
                {connectError && <p className="mv-empty__error">{connectError}</p>}
              </div>
            )}
            {connected && (
              <div className="mv-cursor" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <path d="M3.5 2.2c-.5-.2-1 .3-.8.8l5.6 16.1c.2.6 1 .6 1.2 0l2.1-6 6-2.1c.6-.2.6-1 0-1.2z" fill="#0f172a" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
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
        <section className={`mv-card mv-card--chat ${connected ? '' : 'is-disabled'}`}>
          <header className="mv-card__head">
            <span className="mv-card__title">
              <MessageSquare size={16} strokeWidth={1.9} /> Chat
            </span>
            <button
              type="button"
              className="mv-tool"
              onClick={() => setMessages([])}
              disabled={!connected || messages.length === 0}
              title="Clear chat"
              aria-label="Clear chat"
            >
              <RotateCcw size={14} />
            </button>
          </header>

          <div className="mv-thread" ref={listRef} aria-live="polite">
            {!connected || messages.length === 0 ? (
              <div className="mv-thread__empty">
                <span className="mv-thread__icon">
                  <MessageSquare size={20} strokeWidth={1.7} />
                </span>
                <p>{connected ? 'Ask me to take a screenshot, record, zoom or go fullscreen.' : 'Messages appear here once a screen is connected.'}</p>
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
                  {m.status === 'pending' ? (
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
            {Speech && (
              <button
                type="button"
                className={`mv-voice ${listening ? 'is-on' : ''}`}
                disabled={!connected || busy}
                onClick={toggleVoice}
                aria-label={listening ? 'Stop listening' : 'Voice'}
              >
                {listening ? <X size={14} /> : <Mic size={14} />}
                <span>{listening ? 'Listening' : 'Voice'}</span>
              </button>
            )}
            <div className="mv-field">
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
                placeholder={connected ? 'Ask anything…' : 'Connect a screen to chat'}
                disabled={!connected}
                rows={1}
                aria-label="Message"
              />
              <span className="mv-count">
                {input.length}/{MAX_CHARS}
              </span>
              <button type="submit" className="mv-send" disabled={!connected || busy || !input.trim()} aria-label="Send">
                {busy ? <LoaderCircle size={15} className="spin" /> : <ArrowUp size={15} strokeWidth={2.4} />}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
