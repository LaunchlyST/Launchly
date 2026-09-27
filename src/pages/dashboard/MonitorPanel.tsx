import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Octagon, Send } from 'lucide-react';

/**
 * Monitor: share your whole screen into the box, then type a command under
 * it. Commands run right here in the browser — no AI model or API key.
 */

type Line = { from: 'you' | 'system'; text: string };

const HELP =
  'Commands: screenshot · record · stop recording · pause · resume · fullscreen · zoom in · zoom out · reset zoom · stop · help';

export function MonitorPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<Line[]>([]);
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  useEffect(() => () => stop(), []);

  const say = (text: string) => setLog((l) => [...l.slice(-7), { from: 'system', text }]);

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
      say('Connected. Type "help" to see what I can do.');
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
    if (typeof MediaRecorder === 'undefined') return say('Recording is not supported in this browser.');
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, { mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '' });
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      download(new Blob(chunksRef.current, { type: 'video/webm' }), `launchly-recording-${Date.now()}.webm`);
      setRecording(false);
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
    say('Recording started. Type "stop recording" to save it.');
  }

  function run(raw: string) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    setLog((l) => [...l.slice(-7), { from: 'you', text: raw.trim() }]);
    setInput('');
    if (cmd === 'help' || cmd === '?') return say(HELP);
    if (!connected) return say('Press Connect first.');
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
      return say('Live again.');
    }
    if (/^full ?screen/.test(cmd)) {
      boxRef.current?.requestFullscreen?.().catch(() => say('Fullscreen was blocked by the browser.'));
      return;
    }
    if (/^zoom in/.test(cmd)) return setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)));
    if (/^zoom out/.test(cmd)) return setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)));
    if (/^(reset zoom|zoom reset)/.test(cmd)) return setZoom(1);
    if (/^(stop|disconnect|end)/.test(cmd)) {
      stop();
      return say('Stopped.');
    }
    say(`I don't know "${raw.trim()}". ${HELP}`);
  }

  return (
    <div className="monitor-simple">
      <div className="monitor-simple__head">
        <h1>Monitor</h1>
        {connected && (
          <button className="monitor-stop" onClick={() => { stop(); say('Stopped.'); }}>
            <Octagon size={16} /> Stop
          </button>
        )}
      </div>

      <div ref={boxRef} className="monitor-box">
        <video ref={videoRef} muted playsInline hidden={!connected} style={{ transform: `scale(${zoom})` }} />
        {!connected && (
          <div className="monitor-connect">
            <span>
              <Monitor size={28} strokeWidth={1.5} />
            </span>
            <button className="research-primary" onClick={connect} disabled={!canShare}>
              {canShare ? 'Connect' : 'Screen sharing not supported in this browser'}
            </button>
          </div>
        )}
        {connected && (recording || paused) && (
          <span className="monitor-badge">{recording ? '● REC' : 'Paused'}</span>
        )}
      </div>

      <form
        className="monitor-bar"
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='Type a command, e.g. "screenshot" or "record"' maxLength={200} />
        <button className="research-primary" disabled={!input.trim()} aria-label="Send">
          <Send size={16} />
        </button>
      </form>

      {log.length > 0 && (
        <div className="monitor-log">
          {log.map((l, i) => (
            <p key={i} className={l.from === 'you' ? 'is-you' : ''}>
              {l.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
