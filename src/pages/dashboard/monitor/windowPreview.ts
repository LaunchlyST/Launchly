/** Bind one capture to one mounted video. The caller owns stopping its tracks. */
export function attachWindowPreview(video: HTMLVideoElement, stream: MediaStream, handlers: {
  ready: () => void;
  ended: () => void;
  error: (message: string) => void;
  muted: (muted: boolean) => void;
}) {
  let disposed = false;
  let started = false;
  let playing = false;
  const track = stream.getVideoTracks()[0];
  const fail = () => {
    if (!disposed) handlers.error('The shared window could not be played. Reconnect the window and keep it open.');
  };
  const ready = () => {
    if (disposed || started || !playing || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    started = true;
    clearTimeout(timeout);
    handlers.ready();
  };
  const play = () => {
    if (disposed) return;
    video.play().then(() => { playing = true; ready(); }).catch(fail);
  };
  const ended = () => { if (!disposed) handlers.ended(); };
  const mute = () => { if (!disposed) handlers.muted(true); };
  const unmute = () => { if (!disposed) { handlers.muted(false); play(); } };
  const timeout = setTimeout(fail, 20000);
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.addEventListener('loadedmetadata', play);
  video.addEventListener('loadeddata', ready);
  video.addEventListener('playing', ready);
  video.addEventListener('error', fail);
  track?.addEventListener('ended', ended);
  track?.addEventListener('mute', mute);
  track?.addEventListener('unmute', unmute);
  stream.addEventListener('inactive', ended);
  // Assign the actual MediaStream, never a URL, canvas snapshot, or placeholder.
  video.srcObject = stream;
  if (video.readyState >= 1) play();
  return () => {
    disposed = true;
    clearTimeout(timeout);
    video.removeEventListener('loadedmetadata', play);
    video.removeEventListener('loadeddata', ready);
    video.removeEventListener('playing', ready);
    video.removeEventListener('error', fail);
    track?.removeEventListener('ended', ended);
    track?.removeEventListener('mute', mute);
    track?.removeEventListener('unmute', unmute);
    stream.removeEventListener('inactive', ended);
    if (video.srcObject === stream) video.srcObject = null;
  };
}
