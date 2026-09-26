import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, LoaderCircle, Mic, MicOff, Monitor, MousePointer2, Octagon, Send } from 'lucide-react';
import { useStore } from '../../store';

/**
 * Automation → Monitor.
 *
 * Connect shares a screen/window through the browser's own permission prompt
 * (getDisplayMedia). The AI sees a frame of what you share, answers your
 * request, and points at the spot on screen with the AI cursor.
 *
 * Honest limit: a web page cannot move your real mouse or type on your PC —
 * that needs a desktop helper app. The AI cursor is drawn over the preview
 * only, and Stop ends sharing, listening and any running request at once.
 */

type Msg = { role: 'user' | 'ai'; text: string };

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRec) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

async function askVision(apiKey: string, image: string, question: string, signal: AbortSignal) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a screen assistant. You see a screenshot of the user\'s screen. Answer their request briefly and practically. ' +
            'If a specific place on screen is relevant (a button, field, link), return its position as fractions of the image width/height. ' +
            'Reply as JSON: {"answer": string, "point": {"x": number, "y": number} | null}. Only describe what is actually visible.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: image, detail: 'low' } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`);
  }
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  const p = parsed.point;
  const point = p && typeof p.x === 'number' && typeof p.y === 'number' && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? { x: p.x, y: p.y } : null;
  return { answer: String(parsed.answer || 'No answer.'), point };
}

export function MonitorPanel({ onSettings }: { onSettings: () => void }) {
  const openaiKey = useStore((s) => s.openaiKey);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const Speech = getSpeechRecognition();

  useEffect(() => () => stopAll(), []);

  async function connect() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopAll());
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : 'Could not start screen sharing.');
    }
  }

  function stopAll() {
    requestRef.current?.abort();
    requestRef.current = null;
    recRef.current?.stop();
    recRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    window.speechSynthesis?.cancel();
    setConnected(false);
    setListening(false);
    setBusy(false);
    setCursor(null);
  }

  function frame(): string | null {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const scale = Math.min(1, 1280 / v.videoWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const image = frame();
    if (!image) {
      setError('Connect a screen first so the AI can see it.');
      return;
    }
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    setError('');
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const { answer, point } = await askVision(openaiKey, image, q, controller.signal);
      setMessages((m) => [...m, { role: 'ai', text: answer }]);
      setCursor(point);
      if (speak && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer));
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      clearTimeout(timer);
      if (requestRef.current === controller) requestRef.current = null;
      setBusy(false);
    }
  }

  function toggleListen() {
    if (!Speech) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Speech();
    rec.lang = navigator.language || 'en-GB';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const said = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(' ');
      if (said.trim()) ask(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const active = connected || busy || listening;

  return (
    <>
      <div className="research-page-heading">
        <div>
          <span className="eyebrow">Automation</span>
          <h1>Monitor</h1>
          <p>Share your screen, then ask the AI what to do — by typing or talking.</p>
        </div>
      </div>

      {!openaiKey && (
        <div className="research-notice">
          <KeyRound size={15} /> Add your OpenAI key in Settings so the AI can see your screen.
          <button onClick={onSettings}>Open Settings</button>
        </div>
      )}

      <div className="monitor-layout">
        <section className="research-panel monitor-screen-panel">
          <div className="panel-heading">
            <div>
              <h2>Your screen</h2>
              <p>{connected ? 'Live — only you and the AI can see this.' : 'Nothing is shared until you press Connect.'}</p>
            </div>
            <span className={`monitor-status ${connected ? 'is-live' : ''}`}>
              <i /> {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          <div className="monitor-screen">
            <video ref={videoRef} muted playsInline hidden={!connected} />
            {!connected && (
              <div className="monitor-connect">
                <span>
                  <Monitor size={28} strokeWidth={1.5} />
                </span>
                <h3>Connect your screen</h3>
                <p>Choose a window, tab or your whole screen in the browser prompt.</p>
                <button className="research-primary" onClick={connect} disabled={!canShare}>
                  {canShare ? 'Connect' : 'Screen sharing not supported in this browser'}
                </button>
              </div>
            )}
            {connected && cursor && (
              <div className="monitor-ai-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }} aria-label="AI cursor">
                <MousePointer2 size={22} fill="currentColor" />
                <span>AI</span>
              </div>
            )}
          </div>

          <div className="monitor-ask">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={connected ? 'Ask the AI what to do on this screen…' : 'Connect your screen first'}
                disabled={!connected || !openaiKey}
                maxLength={500}
              />
              {Speech && (
                <button
                  type="button"
                  className={`monitor-icon-btn ${listening ? 'is-on' : ''}`}
                  onClick={toggleListen}
                  disabled={!connected || !openaiKey}
                  aria-label={listening ? 'Stop listening' : 'Talk to the AI'}
                  title={listening ? 'Listening… click to stop' : 'Talk to the AI'}
                >
                  {listening ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
              )}
              <button className="research-primary" disabled={!connected || !openaiKey || busy || !input.trim()}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Ask
              </button>
            </form>
            <label className="monitor-speak">
              <input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} /> Read answers aloud
            </label>
          </div>
          {error && (
            <div className="research-notice" role="alert">
              {error}
            </div>
          )}
        </section>

        <aside className="research-panel monitor-side">
          <div className="monitor-ai-mouse">
            <span className={`monitor-ai-mouse__icon ${active ? 'is-active' : ''}`}>
              <MousePointer2 size={20} fill="currentColor" />
            </span>
            <div>
              <strong>AI mouse</strong>
              <small>{busy ? 'Looking at your screen…' : listening ? 'Listening…' : cursor ? 'Pointing on your screen' : connected ? 'Waiting for your request' : 'Idle'}</small>
            </div>
          </div>
          <button className="monitor-stop" onClick={stopAll} disabled={!active}>
            <Octagon size={18} /> Stop
          </button>
          <p className="monitor-note">Stop ends screen sharing, listening and any running AI request immediately.</p>

          <div className="monitor-chat">
            {messages.length === 0 ? (
              <p className="monitor-note">Your conversation with the AI appears here.</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`monitor-msg monitor-msg--${m.role}`}>
                  <small>{m.role === 'ai' ? 'AI' : 'You'}</small>
                  <p>{m.text}</p>
                </div>
              ))
            )}
          </div>
          <p className="monitor-note">
            The AI can see and point, but a website can’t move your real mouse or type on your PC. Full control needs the Launchly desktop app.
          </p>
        </aside>
      </div>
    </>
  );
}
