import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('../screenReader', async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    readScreen: vi.fn(async () => ({
      width: 1000,
      height: 500,
      text: 'Launchly Dashboard\nSettings\nWinning products',
      words: [
        { text: 'Launchly', x0: 10, y0: 10, x1: 90, y1: 30, confidence: 95 },
        { text: 'Settings', x0: 880, y0: 20, x1: 960, y1: 40, confidence: 92 },
      ],
    })),
  };
});
import { MonitorPanel, interpret } from '../MonitorPanel';
import { extractTarget, locate, describeArea } from '../screenReader';
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
  it('always replies without a key: commands locally, "where is" points at on-screen text', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as any);
    render(<MonitorPanel />);
    await connect();
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 1000 });
    Object.defineProperty(video, 'videoHeight', { value: 500 });
    sendMessage('zoom in');
    expect(screen.getByText('Zoomed in.')).toBeTruthy();
    sendMessage('where is the settings button');
    expect(await screen.findByText(/Found “Settings” at the top right/)).toBeTruthy();
    sendMessage('what is on my screen');
    expect(await screen.findByText(/Launchly Dashboard · Settings · Winning products/)).toBeTruthy();
    sendMessage('where is billing');
    expect(await screen.findByText(/couldn’t see “billing”/)).toBeTruthy();
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

    sendMessage('why is this chart going down');
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () =>
      resolveFetch(new Response(JSON.stringify({ choices: [{ message: { content: 'Top right, the gear icon.' } }] }), { status: 200 }))
    );
    expect(await screen.findByText('Top right, the gear icon.')).toBeTruthy();

    sendMessage('explain this page to me');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => resolveFetch(new Response(JSON.stringify({ error: { message: 'Invalid API key.' } }), { status: 401 })));
    expect(await screen.findByText('Invalid API key.')).toBeTruthy();
    vi.unstubAllGlobals();
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
