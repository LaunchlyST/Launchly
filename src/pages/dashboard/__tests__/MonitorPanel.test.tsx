import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const auth = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('../../../auth-store', () => ({
  useAuthStore: (sel: (s: any) => any) => sel({ session: auth.token ? { access_token: auth.token } : null, user: null }),
}));

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

  it('avoids fullscreen feedback when sharing the entire screen', async () => {
    render(<MonitorPanel />);
    await connect();
    const request = vi.fn();
    document.querySelector('.mv-screen')!.requestFullscreen = request;
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText(/share a separate Edge window/)).toBeTruthy();
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({ selfBrowserSurface: 'exclude', preferCurrentTab: false }));
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

describe('Monitor projects & models', () => {
  afterEach(() => {
    auth.token = null;
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows the toolbar, stays Offline without a backend and asks to connect something', () => {
    render(<MonitorPanel />);
    expect(screen.getByText('Choose project')).toBeTruthy();
    expect(screen.getByText('Connect AI')).toBeTruthy();
    expect(screen.getByLabelText('Monitor permissions')).toBeTruthy();
    expect(document.querySelector('.mv-pill')!.textContent).toBe('Offline');
    expect(screen.getByText('Connect a project or share your screen to get started.')).toBeTruthy();
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('Connect project opens GitHub first and preserves other connection options', async () => {
    render(<MonitorPanel />);
    fireEvent.click(screen.getByText('Choose project'));
    expect(screen.getByRole('dialog', { name: 'Choose project' })).toBeTruthy();
    expect(screen.getByText('No projects yet')).toBeTruthy();
    fireEvent.click(screen.getByText('Connect a project'));
    expect(screen.getByRole('dialog', { name: 'Connect a project' })).toBeTruthy();
    expect(screen.getByText('Sign in to Launchly to connect your GitHub account.')).toBeTruthy();
    fireEvent.click(screen.getByText('All options'));
    expect(screen.getByText('Connect a repository')).toBeTruthy();
    expect(screen.getByText('Connect a folder on this computer')).toBeTruthy();
    expect(screen.getByText('Import using a repository URL')).toBeTruthy();
    fireEvent.click(screen.getByText('GitHub'));
    expect(screen.getByText('Sign in to Launchly to connect your GitHub account.')).toBeTruthy();
  });

  it('coding connections: unavailable agents stay disconnected and API selection is explicit', async () => {
    auth.token = 'tok';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.endsWith('/status')
        ? { success: true, data: { online: true, capabilities: { github: true, gitUrl: true, localBridge: false, agent: true, providerKeys: true } } }
        : u.endsWith('/providers')
          ? { success: true, data: [{ provider: 'anthropic', connected: true, keyLast4: '82XQ' }] }
          : { success: true, data: { models: [{ provider: 'anthropic', modelId: 'm-1', displayName: 'Model One', family: 'claude', capabilities: ['coding'], recommended: true, available: true }], latest: { anthropic: 'm-1' } } };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    render(<MonitorPanel />);
    await waitFor(() => expect(document.querySelector('.mv-pill')!.textContent).toBe('Online'));
    fireEvent.click(screen.getByText('Connect AI'));
    expect(screen.getByRole('dialog', { name: 'Connect coding agent' })).toBeTruthy();
    expect(screen.getByText('Codex')).toBeTruthy();
    expect(screen.getByText('Claude Code')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Connect', exact: true })[0]);
    expect(screen.getByText('Integration not available')).toBeTruthy();
    expect(screen.queryByText('Codex · Connected')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Use Anthropic API' }));
    expect(document.querySelector('.mv-composer')!.textContent).toContain('Anthropic API');
  });

  it('AI provider modal never shows a stored key and reports server errors honestly', async () => {
    render(<MonitorPanel />);
    fireEvent.click(screen.getByText('Connect AI'));
    fireEvent.click(screen.getAllByRole('button', { name: /Connect API Key for/ })[1]);
    expect(screen.getByRole('dialog', { name: 'Connect AI' })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('sk-ant-…'), { target: { value: 'sk-ant-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('Sign in to use Monitor projects.')).toBeTruthy();
    expect(localStorage.getItem('launchly.monitor.prefs') ?? '').not.toContain('sk-ant');
  });

  it('permissions default to ask-before-applying with push/deploy off', () => {
    render(<MonitorPanel />);
    fireEvent.click(screen.getByLabelText('Monitor permissions'));
    expect((screen.getByLabelText('Ask before applying') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Push changes automatically') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Deploy automatically') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Read project files') as HTMLInputElement).checked).toBe(true);
  });

  it('project mode: connect a repo, ask for a change, see activity, changes and the diff', async () => {
    auth.token = 'tok';
    const task = {
      id: 't1', prompt: 'x', status: 'awaiting-approval', error: null,
      activity: [
        { id: '1', tool: 'search_files', label: 'Searching project', status: 'done' },
        { id: '2', tool: 'read_file', label: 'Found monitor.css', status: 'done' },
        { id: '3', tool: 'run_build', label: 'Running checks', status: 'done' },
      ],
      changes: { id: 'c1', applied: false, checkpointId: 'k1', checks: [{ name: 'build', passed: true }],
        files: [{ path: 'src/monitor.css', added: 1, removed: 1, patch: '@@ -1 +1 @@\n-.halo{background:blue}\n+.halo{display:none}' }] },
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
      if (u.endsWith('/status')) return ok({ online: true, capabilities: { github: true, gitUrl: true, localBridge: false, agent: true, providerKeys: true } });
      if (u.endsWith('/providers')) return ok([{ provider: 'openai', connected: true, keyLast4: '1234' }]);
      if (u.endsWith('/models')) return ok({ models: [], latest: {} });
      if (u.includes('/github/repos')) return ok([{ id: 1, fullName: 'matas/launchly', private: true, defaultBranch: 'main', updatedAt: null }]);
      if (u.includes('/github/branches')) return ok(['main', 'dev']);
      if (u.endsWith('/projects') && !init?.method) return ok([]);
      if (u.endsWith('/projects') && init?.method === 'POST') return ok({ id: 'p1', source: 'github', name: 'launchly', repository: 'matas/launchly', branch: 'main', status: 'synced' });
      if (u.endsWith('/agent/tasks')) return ok({ taskId: 't1' });
      if (u.includes('/agent/tasks/t1')) return ok(task);
      return new Response('{}', { status: 404 });
    }));
    render(<MonitorPanel />);
    await waitFor(() => expect(document.querySelector('.mv-pill')!.textContent).toBe('Online'));
    fireEvent.click(screen.getByText('Choose project'));
    fireEvent.click(screen.getByText('Connect a project'));
    fireEvent.click(await screen.findByText('matas/launchly'));
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(document.querySelector('.mv-composer')!.textContent).toContain('launchlyGitHubmain'));
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Connect AI'));
    fireEvent.click(await screen.findByRole('button', { name: 'Use OpenAI API' }));
    expect(await screen.findByText('Ask for a change in launchly.')).toBeTruthy();
    expect(document.querySelector('.mv-composer')!.textContent).toContain('launchlyGitHubmain');

    sendMessage('Remove the blue background behind the cursor');
    expect(await screen.findByText('Found monitor.css', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Changes ready')).toBeTruthy();
    expect(screen.getByText(/1 file changed · Build passed/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View changes' }));
    expect(screen.getByText('-.halo{background:blue}')).toBeTruthy();
    expect(screen.getByText('+.halo{display:none}')).toBeTruthy();
  });

  it('does not crash when the backend URL returns the website HTML instead of JSON', async () => {
    auth.token = 'tok';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    render(<MonitorPanel />);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.mv-pill')!.textContent).toBe('Offline');
    fireEvent.click(screen.getByText('Connect AI'));
    expect(screen.getByText('Codex')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Connect API Key for/ })[1]);
    expect(screen.getByRole('dialog', { name: 'Connect AI' })).toBeTruthy();
  });
});
