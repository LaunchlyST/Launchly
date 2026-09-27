import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MonitorPanel, interpret } from '../MonitorPanel';
import { useStore } from '../../../store';

class FakeTrack extends EventTarget {
  stopped = false;
  stop() {
    this.stopped = true;
  }
  getSettings() {
    return { displaySurface: 'monitor', width: 1920, height: 1080 };
  }
}

function fakeStream(track: FakeTrack) {
  return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

let track: FakeTrack;
let resolveShare: ((s: MediaStream) => void) | null;

beforeEach(() => {
  track = new FakeTrack();
  resolveShare = null;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia: vi.fn(() => new Promise<MediaStream>((r) => (resolveShare = r))) },
  });
  useStore.setState({ openaiKey: '' });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function connect() {
  fireEvent.click(screen.getByRole('button', { name: 'Connect screen' }));
  expect(screen.getByRole('status').textContent).toBe('Connecting');
  expect(screen.getByText('Choose what to share')).toBeTruthy();
  await act(async () => resolveShare!(fakeStream(track)));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Live'));
}

function sendMessage(text: string) {
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } });
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

describe('Monitor connection state', () => {
  it('idle shows no connected UI; connecting shows a loader; connected shows the label', async () => {
    render(<MonitorPanel />);
    expect(screen.getByTestId('connection-label').textContent).toBe('Not connected');
    expect(screen.queryByRole('button', { name: 'Stop sharing' })).toBeNull();
    await connect();
    expect(screen.getByTestId('connection-label').textContent).toContain('Connected');
    expect(screen.getByTestId('connection-label').textContent).toContain('Entire screen · 1920×1080');
  });

  it('Stop clears the connected label and the whole conversation immediately', async () => {
    render(<MonitorPanel />);
    await connect();
    sendMessage('help');
    expect(screen.getByText(/I can take a screenshot/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(screen.getByTestId('connection-label').textContent).toBe('Not connected');
    expect(screen.queryByText(/I can take a screenshot/)).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Offline');
    expect(track.stopped).toBe(true);
  });

  it('closing sharing from the browser bar resets everything too', async () => {
    render(<MonitorPanel />);
    await connect();
    sendMessage('hello');
    act(() => {
      track.dispatchEvent(new Event('ended'));
    });
    expect(screen.getByTestId('connection-label').textContent).toBe('Not connected');
    expect(screen.queryByText(/Hi!/)).toBeNull();
  });

  it('cancelling the share prompt returns to idle without an error', async () => {
    (navigator.mediaDevices.getDisplayMedia as any).mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    );
    render(<MonitorPanel />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect screen' }));
    });
    expect(screen.getByRole('status').textContent).toBe('Offline');
    expect(screen.getByRole('button', { name: 'Connect screen' })).toBeTruthy();
  });
});

describe('Monitor assistant', () => {
  it('always replies: commands locally, open questions explain the missing key', async () => {
    render(<MonitorPanel />);
    await connect();
    sendMessage('zoom in');
    expect(screen.getByText('Zoomed in.')).toBeTruthy();
    sendMessage('where is the settings button');
    expect(screen.getByText(/add your OpenAI key in Settings/)).toBeTruthy();
  });

  it('with a key: shows a thinking state then the answer, or a clear error', async () => {
    useStore.setState({ openaiKey: 'sk-test' });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAA');
    let resolveFetch!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (resolveFetch = r))));

    render(<MonitorPanel />);
    await connect();
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 1280 });
    Object.defineProperty(video, 'videoHeight', { value: 720 });

    sendMessage('where is the settings button');
    expect(screen.getByLabelText('Assistant is thinking')).toBeTruthy();
    await act(async () =>
      resolveFetch(new Response(JSON.stringify({ choices: [{ message: { content: 'Top right, the gear icon.' } }] }), { status: 200 }))
    );
    expect(await screen.findByText('Top right, the gear icon.')).toBeTruthy();

    sendMessage('and the logout?');
    await act(async () => resolveFetch(new Response(JSON.stringify({ error: { message: 'Invalid API key.' } }), { status: 401 })));
    expect(await screen.findByText('Invalid API key.')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
