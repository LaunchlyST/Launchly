import React from 'react';
import { Camera, ChevronDown, Circle, LoaderCircle, Maximize2, Monitor, MonitorUp, RefreshCw, Unplug } from 'lucide-react';
import type { Tone } from './MonitorTopBar';

export interface ComputerPanelProps {
  conn: 'idle' | 'connecting' | 'connected';
  connected: boolean;
  canShare: boolean;
  connectError: string;
  /** "Window" / "Entire screen" / "Browser tab" */
  surfaceName: string;
  /** "1920×1080", or '' until a track reports its size. */
  resolution: string;
  deviceName: string | null;
  deviceOnline: boolean;
  devicePaired: boolean;
  recording: boolean;
  paused: boolean;
  /** Cursor position over the stream, as fractions of the source frame. */
  pointerStyle: React.CSSProperties | undefined;
  cursorVisible: boolean;
  cursorPointing: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onScreenshot: () => void;
  onRecord: () => void;
  onFullscreen: () => void;
  onOpenDevice: () => void;
  onRefreshDevice: () => void;
}

/**
 * The real shared screen. The <video> only exists while a track is live, so the
 * panel can never show a black rectangle pretending to be a connected computer.
 */
export function ComputerPanel(props: ComputerPanelProps) {
  const {
    conn, connected, canShare, connectError, surfaceName, resolution,
    deviceName, deviceOnline, devicePaired, recording, paused,
    pointerStyle, cursorVisible, cursorPointing, videoRef, stageRef, zoom, busy,
    onConnect, onDisconnect, onScreenshot, onRecord, onFullscreen, onOpenDevice, onRefreshDevice,
  } = props;

  const status: { tone: Tone; label: string } =
    conn === 'connecting' ? { tone: 'warn', label: 'Connecting' }
    : connected ? { tone: 'ok', label: 'Connected' }
    : deviceOnline ? { tone: 'warn', label: 'Agent online' }
    : { tone: 'idle', label: 'Not connected' };

  const detail = connected ? `${surfaceName}${resolution ? ` · ${resolution}` : ''}` : deviceName || 'No computer';

  return (
    <section className="mv-panel mv-computer" aria-label="Computer">
      <header className="mv-panel__head">
        <div className="mv-panel__lead">
          <span className="mv-panel__title">
            <Monitor size={15} strokeWidth={1.9} /> Computer
          </span>
          <span className="mv-status" data-tone={status.tone}>
            <i aria-hidden="true" />
            {status.label}
          </span>
          <span className="mv-panel__meta" data-testid="connection-label">
            {connected && <i className="mv-dot" aria-hidden="true" />}
            {detail}
          </span>
        </div>

        <div className="mv-panel__tools">
          <button
            type="button"
            className="mv-chipbtn"
            onClick={onOpenDevice}
            aria-label="Computer connection"
            title={deviceOnline ? deviceName || 'Paired computer' : devicePaired ? 'Paired computer is offline' : 'Connect the local device agent'}
          >
            <Circle size={7} fill={deviceOnline ? '#12b76a' : '#98a2b3'} stroke="none" />
            {deviceOnline ? deviceName || 'Computer' : devicePaired ? 'Agent offline' : 'Select computer'}
            <ChevronDown size={12} />
          </button>

          <button type="button" className="mv-iconbtn" onClick={onRefreshDevice} aria-label="Refresh computer connection" title="Refresh computer connection">
            <RefreshCw size={14} />
          </button>

          <span className="mv-panel__divider" aria-hidden="true" />

          <button type="button" className="mv-iconbtn" onClick={onScreenshot} disabled={!connected || busy} aria-label="Screenshot" title="Screenshot">
            <Camera size={15} />
          </button>
          <button
            type="button"
            className={`mv-iconbtn ${recording ? 'is-rec' : ''}`}
            onClick={onRecord}
            disabled={!connected || busy}
            aria-label={recording ? 'Stop recording' : 'Record'}
            title={recording ? 'Stop recording' : 'Record'}
          >
            <Circle size={12} fill={recording ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className="mv-iconbtn" onClick={onFullscreen} disabled={!connected || busy} aria-label="Fullscreen" title="Fullscreen">
            <Maximize2 size={15} />
          </button>
          <button type="button" className="mv-iconbtn mv-iconbtn--danger" onClick={onDisconnect} disabled={!connected} aria-label="Disconnect" title="Disconnect computer">
            <Unplug size={15} />
          </button>
        </div>
      </header>

      <div className="mv-stage" ref={stageRef}>
        {connected ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="mv-stage__video"
              style={{ transform: `scale(${zoom})` }}
            />
            {cursorVisible && (
              <div
                className={`mv-aim ${cursorPointing ? 'is-pointing' : 'is-still'}`}
                style={pointerStyle}
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <path
                    d="M3.5 2.2c-.5-.2-1 .3-.8.8l5.6 16.1c.2.6 1 .6 1.2 0l2.1-6 6-2.1c.6-.2.6-1 0-1.2z"
                    fill="#2563eb"
                    stroke="#fff"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
            {recording && (
              <span className="mv-overlay mv-overlay--rec">
                <i aria-hidden="true" /> Recording
              </span>
            )}
            {paused && <span className="mv-overlay mv-overlay--right">Paused</span>}
          </>
        ) : conn === 'connecting' ? (
          <div className="mv-blank">
            <LoaderCircle size={22} className="spin" />
            <strong>Waiting for your screen…</strong>
            <p>Choose a window or screen in the browser prompt.</p>
          </div>
        ) : (
          <div className="mv-blank">
            <span className="mv-blank__icon">
              <MonitorUp size={22} strokeWidth={1.6} />
            </span>
            <strong>Connect your computer</strong>
            <p>Let Launchly see and work inside your selected window.</p>
            {deviceOnline && !connected && (
              <p className="mv-blank__note">
                {deviceName || 'The local agent'} is online and ready to be controlled. Share a screen to see a live preview here.
              </p>
            )}
            <button type="button" className="mv-primary" onClick={onConnect} disabled={!canShare}>
              <MonitorUp size={15} />
              {canShare ? 'Connect computer' : 'Screen sharing unsupported'}
            </button>
            {!canShare && <p className="mv-blank__note">This browser can’t share a screen. Try Chrome, Edge or another Chromium browser.</p>}
          </div>
        )}
      </div>

      {connectError && (
        <p className="mv-panel__error" role="alert">
          {connectError}
        </p>
      )}
    </section>
  );
}