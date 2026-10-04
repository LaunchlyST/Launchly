import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const auth = vi.hoisted(() => ({ token: 'token' as string | null }));
vi.mock('../../../auth-store', () => ({
  useAuthStore: (sel: (s: any) => any) => sel({ session: auth.token ? { access_token: auth.token } : null, user: null }),
}));
vi.mock('../screenReader', async (orig) => ({
  ...await orig() as any,
  readScreen: vi.fn(async () => ({ width: 1000, height: 500, text: 'Launchly Settings', words: [{ text: 'Settings', x0: 880, y0: 20, x1: 960, y1: 40, confidence: 92 }] })),
}));
import { MonitorPanel, interpret } from '../MonitorPanel';
import { extractTarget, locate, describeArea } from '../screenReader';

class FakeTrack extends EventTarget {
  stopped = false;
  readyState = 'live';
  stop() { this.stopped = true; this.readyState = 'ended'; }
  getSettings() { return { displaySurface: 'window', width: 1920, height: 1080 }; }
}
function fakeStream(track: FakeTrack) {
  return Object.assign(new EventTarget(), { getVideoTracks: () => [track], getTracks: () => [track] }) as unknown as MediaStream;
}
let track: FakeTrack;
let resolveShare: (s: MediaStream) => void;
let saved: Record<string, any>;
let chatResponse: () => Response;
let verifyResponse: ((provider: string) => Promise<Response>) | null;
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const connection = (provider: string) => ({ provider, connected: true, keyLast4: '1234', connectionType: 'api', state: 'connected' });

beforeEach(() => {
  localStorage.clear();
  auth.token = 'token';
  saved = {};
  verifyResponse = null;
  chatResponse = () => ok({ text: 'This is the selected provider’s answer.', provider: 'openai', connectionType: 'api' });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  track = new FakeTrack();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getDisplayMedia: vi.fn(() => new Promise<MediaStream>(resolve => { resolveShare = resolve; })),
  } });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith('/status')) return ok({ online: true, capabilities: { agent: false, providerKeys: true } });
    if (path.endsWith('/providers')) return ok(Object.values(saved));
    if (path.endsWith('/models')) return ok({ models: [], latest: {} });
    if (path.endsWith('/projects')) return ok([]);
    if (path.endsWith('/chat')) return chatResponse();
    const match = path.match(/providers\/(openai|anthropic)(\/verify)?$/);
    if (match) {
      if (match[2]) return verifyResponse ? verifyResponse(match[1]) : ok(saved[match[1]] ?? { provider: match[1], connected: false, state: 'disconnected', connectionType: 'api' });
      saved[match[1]] = connection(match[1]);
      return ok(saved[match[1]]);
    }
    return new Response('{}', { status: 404 });
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function connect() {
  fireEvent.click(screen.getByRole('button', { name: 'Connect computer' }));
  expect(screen.getByRole('status', { name: 'Screen connection' }).textContent).toBe('Screen: Connecting');
  const stream = fakeStream(track);
  await act(async () => resolveShare(stream));
  const video = document.querySelector('video')!;
  expect(video.srcObject).toBe(stream);
  expect(video.hidden).toBe(false);
  expect(video.autoplay && video.playsInline && video.muted).toBe(true);
  expect(screen.getByRole('status', { name: 'Screen connection' }).textContent).toBe('Screen: Connecting');
  Object.defineProperties(video, { videoWidth: { configurable: true, value: 1000 }, videoHeight: { configurable: true, value: 500 }, readyState: { configurable: true, value: 2 } });
  await act(async () => { fireEvent.loadedMetadata(video); fireEvent.loadedData(video); });
  await waitFor(() => expect(screen.getByRole('status', { name: 'Screen connection' }).textContent).toBe('Screen: Connected'));
  return video;
}
async function connectAI(provider = 'openai') {
  fireEvent.click(screen.getByRole('button', { name: 'Connect AI' }));
  fireEvent.click(screen.getByRole('button', { name: `Connect API Key for ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API` }));
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-test-key-1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(screen.getByRole('status', { name: 'AI connection' }).textContent).toContain('connected'));
}
function sendMessage(text: string) {
  fireEvent.change(screen.getByLabelText('Message the coding agent'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('interpret', () => {
  it('understands plain sentences', () => {
    expect(interpret('can you take a screenshot please')).toBe('screenshot');
    expect(interpret('start recording')).toBe('record');
    expect(interpret('ok stop the recording now')).toBe('stop-recording');
    expect(interpret('zoom in a bit')).toBe('zoom-in');
    expect(interpret('reset the zoom')).toBe('zoom-reset');
    expect(interpret('go fullscreen')).toBe('fullscreen');
    expect(interpret('stop')).toBe('disconnect');
    expect(interpret('what can you do?')).toBe('help');
    expect(interpret('hello')).toBe('greeting');
    expect(interpret('where is the settings button')).toBeNull();
  });
});

describe('Window capture lifecycle', () => {
  it('attaches the real stream, starts playback on metadata, and gates chat on AI separately', async () => {
    render(<MonitorPanel />);
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(true);
    await connect();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByRole('status', { name: 'AI connection' }).textContent).toContain('disconnected');
    await connectAI();
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(false);
  });
  it('keeps AI connected when browser sharing stops and clears the stream and conversation', async () => {
    render(<MonitorPanel />); await connect(); await connectAI();
    sendMessage('help');
    expect(screen.getByText(/I can take a screenshot/)).toBeTruthy();
    act(() => track.dispatchEvent(new Event('ended')));
    expect(screen.getByRole('status', { name: 'Screen connection' }).textContent).toBe('Screen: Disconnected');
    expect(screen.getByRole('status', { name: 'AI connection' }).textContent).toContain('connected');
    expect(document.querySelector('video')!.srcObject).toBeNull();
    expect(track.stopped).toBe(true);
    expect(screen.queryByText(/I can take a screenshot/)).toBeNull();
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(true);
  });
  it('reports playback failures instead of claiming the black preview is connected', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('Playback blocked'));
    render(<MonitorPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect computer' }));
    await act(async () => resolveShare(fakeStream(track)));
    await act(async () => fireEvent.loadedMetadata(document.querySelector('video')!));
    expect(await screen.findByText(/shared window could not be played/)).toBeTruthy();
    expect(track.stopped).toBe(true);
    expect(screen.getByRole('status', { name: 'Screen connection' }).textContent).toBe('Screen: Error');
  });
  it('ignores a late sharing result after Monitor unmounts', async () => {
    const view = render(<MonitorPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect computer' }));
    view.unmount();
    await act(async () => resolveShare(fakeStream(track)));
    expect(track.stopped).toBe(true);
  });
  it('cancelling the browser picker returns to disconnected and permits retry', async () => {
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(new DOMException('Cancelled', 'NotAllowedError'));
    render(<MonitorPanel />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Connect computer' })));
    expect(screen.getByRole('status', { name: 'Screen connection' }).textContent).toBe('Screen: Disconnected');
    expect(screen.queryByRole('alert')).toBeNull();
    await connect();
  });
  it('does not reconnect from late metadata after sharing has ended', async () => {
    render(<MonitorPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect computer' }));
    await act(async () => resolveShare(fakeStream(track)));
    const video = document.querySelector('video')!;
    act(() => track.dispatchEvent(new Event('ended')));
    await act(async () => { fireEvent.loadedMetadata(video); fireEvent.loadedData(video); });
    expect(screen.getByRole('status', { name: 'Screen connection' }).textContent).toBe('Screen: Disconnected');
    expect(video.srcObject).toBeNull();
  });
  it('shows a muted capture warning and clears it when frames resume', async () => {
    render(<MonitorPanel />); await connect();
    act(() => track.dispatchEvent(new Event('mute')));
    expect(screen.getAllByText(/not sending frames/).length).toBeGreaterThan(0);
    await act(async () => track.dispatchEvent(new Event('unmute')));
    expect(screen.queryByText(/not sending frames/)).toBeNull();
  });
});

describe('AI authorization and requests', () => {
  it.each(['openai', 'anthropic'])('verifies %s then sends the frame and selected provider to the backend', async provider => {
    render(<MonitorPanel />); await connect(); await connectAI(provider);
    const aiStatus = screen.getByRole('status', { name: 'AI connection' }).textContent ?? '';
    expect(aiStatus).toContain(provider === 'openai' ? 'OpenAI' : 'Claude');
    expect(aiStatus).toContain('API');
    sendMessage('Explain the chart trend');
    expect(await screen.findByText('This is the selected provider’s answer.')).toBeTruthy();
    const calls = vi.mocked(fetch).mock.calls;
    const chat = calls.find(([url]) => String(url).endsWith('/chat'))!;
    expect(JSON.parse(chat[1]!.body as string)).toMatchObject({ model: { mode: 'latest', provider }, screenshot: 'data:image/png;base64,AAAA', prompt: 'Explain the chart trend' });
    expect(calls.some(([url]) => /api.openai.com|api.anthropic.com/.test(String(url)))).toBe(false);
    expect(JSON.stringify(localStorage)).not.toContain('sk-test-key');
  });
  it('AI can connect before sharing, but messages still require a live window', async () => {
    render(<MonitorPanel />); await connectAI();
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(true);
    await connect();
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(false);
  });
  it('does not enable messages until saved-key verification completes', async () => {
    let finish!: (response: Response) => void;
    verifyResponse = () => new Promise(resolve => { finish = resolve; });
    render(<MonitorPanel />); await connect();
    fireEvent.click(screen.getByRole('button', { name: 'Connect AI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect API Key for OpenAI API' }));
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-test-key-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'AI connection' }).textContent).toContain('connecting'));
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(true);
    await act(async () => finish(ok({ ...connection('openai'), connected: false, state: 'error', message: 'Key revoked.' })));
    expect(screen.getByRole('status', { name: 'AI connection' }).textContent).toContain('error');
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(true);
  });
  it('uses real backend limits, disables sending and opens the existing API-key fallback', async () => {
    chatResponse = () => new Response(JSON.stringify({ success: false, error: { code: 'PROVIDER_LIMITED', provider: 'openai', connectionType: 'api', message: 'Your API usage is currently limited.' } }), { status: 429 });
    render(<MonitorPanel />); await connect(); await connectAI();
    sendMessage('Explain the chart trend');
    await waitFor(() => expect(screen.getByRole('status', { name: 'AI connection' }).textContent).toContain('limited'));
    expect(screen.queryByText('Your subscription usage is currently limited. Switch to API to continue.')).toBeNull();
    expect((screen.getByLabelText('Message the coding agent') as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to API' }));
    expect(screen.getByRole('dialog', { name: 'Connect AI' })).toBeTruthy();
    expect(screen.getByLabelText('Replace API key')).toBeTruthy();
  });
  it('never authenticates by opening a subscription website', async () => {
    const open = vi.spyOn(window, 'open');
    render(<MonitorPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect AI' }));
    // Local subscription runs on the user's own computer — the modal names the
    // official CLIs and their login commands as plain text, never links.
    expect(screen.getByText(/Codex CLI \(your ChatGPT subscription, on your computer\)/)).toBeTruthy();
    expect(screen.getByText(/Claude Code \(your Claude subscription, on your computer\)/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /sign-in/i })).toBeNull();
    expect(document.querySelector('.mm-stack a[href]')).toBeNull();
    // With no computer connected, local CLIs can't be used — but API key still can.
    expect(screen.getAllByRole('button', { name: 'Use local' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Connect API Key for Anthropic API' }));
    expect(screen.getByPlaceholderText('sk-ant-…')).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'AI connection' }).textContent).toContain('disconnected');
  });
  it('preserves local screen commands and text location after connection', async () => {
    render(<MonitorPanel />); await connect(); await connectAI();
    sendMessage('zoom in'); expect(screen.getByText('Zoomed in.')).toBeTruthy();
    sendMessage('where is the settings button');
    expect(await screen.findByText(/Found “Settings” at the top right/)).toBeTruthy();
  });
});

describe('screenReader helpers', () => {
  it('pulls the target out of a question', () => {
    expect(extractTarget('where is the Settings button?')).toBe('settings');
    expect(extractTarget('can you click on winning products')).toBe('winning products');
    expect(extractTarget('find Search Creator')).toBe('search creator');
    expect(extractTarget('why is this red')).toBeNull();
  });
  it('locates multi-word targets and describes the area', () => {
    const r = { width: 100, height: 100, text: '', words: [
      { text: 'Winning', x0: 70, y0: 5, x1: 80, y1: 10, confidence: 90 },
      { text: 'products', x0: 81, y0: 5, x1: 95, y1: 10, confidence: 90 },
    ] };
    const hit = locate(r, 'winning products')!;
    expect(hit.text).toBe('Winning products');
    expect(describeArea(hit.x, hit.y)).toBe('top right');
    expect(locate(r, 'billing')).toBeNull();
  });
});
