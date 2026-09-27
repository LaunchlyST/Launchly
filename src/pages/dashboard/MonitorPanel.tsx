import React, { useEffect, useRef, useState } from 'react';

/**
 * Monitor: share your whole screen into the display, then send commands in
 * the message panel below. Everything runs in the browser — no AI model.
 */

type Line = { from: 'you' | 'launchly'; text: string };

const HELP = 'Try: screenshot, record, stop recording, pause, resume, fullscreen, zoom in, zoom out, reset zoom, stop.';

export function MonitorPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<Line[]>([]);
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  useEffect(() => () => stop(), []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [log]);

  const push = (from: Line['from'], text: string) => setLog((l) => [...l.slice(-60), { from, text }]);
  const say = (text: string) => push('launchly', text);

  async function connect() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', frameRate: 30 } as MediaTrackConstraints,
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stop());
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setConnected(true);
      setPaused(false);
      setZoom(1);
      say('Screen connected.');
    } catch (e) {
      say(e instanceof Error && e.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : 'Could not start screen sharing.');
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setConnected(false);
    setRecording(false);
    setPaused(false);
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function screenshot() {
    const v = videoRef.current;
    if (!v?.videoWidth) return say('Nothing to capture yet.');
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && download(b, `launchly-screenshot-${Date.now()}.png`), 'image/png');
    say('Screenshot saved to your downloads.');
  }

  function startRecording() {
    if (!streamRef.current) return;
    if (recording) return say('Already recording.');
    if (typeof MediaRecorder === 'undefined') return say('Recording isn’t supported in this browser.');
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, MediaRecorder.isTypeSupported('video/webm') ? { mimeType: 'video/webm' } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      download(new Blob(chunksRef.current, { type: 'video/webm' }), `launchly-recording-${Date.now()}.webm`);
      setRecording(false);
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
    say('Recording. Send “stop recording” to save it.');
  }

  function run(raw: string) {
    const text = raw.trim();
    const cmd = text.toLowerCase();
    if (!cmd) return;
    push('you', text);
    setInput('');
    if (cmd === 'help' || cmd === '?') return say(HELP);
    if (!connected) return say('Connect your screen first.');
    if (/^(screenshot|capture|snap)/.test(cmd)) return screenshot();
    if (/^stop record/.test(cmd)) {
      if (!recording) return say('Not recording.');
      recorderRef.current?.stop();
      return say('Recording saved to your downloads.');
    }
    if (/^record/.test(cmd)) return startRecording();
    if (/^(pause|freeze)/.test(cmd)) {
      videoRef.current?.pause();
      setPaused(true);
      return say('Paused.');
    }
    if (/^(resume|play|unfreeze)/.test(cmd)) {
      videoRef.current?.play();
      setPaused(false);
      return say('Live.');
    }
    if (/^full ?screen/.test(cmd)) {
      screenRef.current?.requestFullscreen?.().catch(() => say('Fullscreen was blocked by the browser.'));
      return;
    }
    if (/^zoom in/.test(cmd)) return setZoom((z) => Math.min(3, z + 0.5));
    if (/^zoom out/.test(cmd)) return setZoom((z) => Math.max(1, z - 0.5));
    if (/^(reset zoom|zoom reset)/.test(cmd)) return setZoom(1);
    if (/^(stop|disconnect|end)/.test(cmd)) {
      stop();
      return say('Disconnected.');
    }
    say(`Unknown command. ${HELP}`);
  }

  const status = !connected ? 'Offline' : recording ? 'Recording' : paused ? 'Paused' : 'Live';

  return (
    <div className="mon">
      <div className="mon-head">
        <h1>Monitor</h1>
        <div className="mon-head__right">
          <span className={`mon-status mon-status--${status.toLowerCase()}`}>{status}</span>
          {connected && (
            <button type="button" className="mon-textbtn" onClick={() => { stop(); say('Disconnected.'); }}>
              Stop
            </button>
          )}
        </div>
      </div>

      <div ref={screenRef} className="mon-screen">
        <video ref={videoRef} muted playsInline hidden={!connected} style={{ transform: `scale(${zoom})` }} />
        {!connected && (
          <div className="mon-screen__idle">
            <p>No screen shared</p>
            <button type="button" className="mon-connect" onClick={connect} disabled={!canShare}>
              {canShare ? 'Connect screen' : 'Screen sharing isn’t supported here'}
            </button>
          </div>
        )}
        {connected && <span className="mon-cursor" aria-label="AI mouse connected" />}
      </div>

      <section className="mon-chat" aria-label="Messages">
        <header className="mon-chat__head">
          <span>Messages</span>
          <button type="button" className="mon-textbtn" onClick={() => run('help')}>
            Commands
          </button>
        </header>
        <div className="mon-chat__list" ref={listRef}>
          {log.length === 0 ? (
            <p className="mon-chat__empty">Send a command once your screen is connected.</p>
          ) : (
            log.map((l, i) => (
              <div key={i} className={`mon-msg mon-msg--${l.from}`}>
                <span>{l.from === 'you' ? 'You' : 'Launchly'}</span>
                <p>{l.text}</p>
              </div>
            ))
          )}
        </div>
        <form
          className="mon-chat__composer"
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Write a message" maxLength={200} aria-label="Message" />
          <button type="submit" disabled={!input.trim()}>
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
