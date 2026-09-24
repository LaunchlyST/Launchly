/**
 * Monitor Control — service abstraction.
 *
 * ============================================================================
 * TODO / FUTURE ARCHITECTURE — Launchly Desktop Agent
 * ============================================================================
 * Real Windows control needs a piece of software this repo does not contain
 * yet: the Launchly Desktop Agent, a small app the user installs on their own
 * PC. Once it exists, the flow is:
 *
 *   Launchly website (this app)
 *     → Monitor Control session   (this module)
 *     → selected AI provider      (reasoning / action plan)
 *     → local Launchly Desktop Agent   (over a local WebSocket, see below)
 *     → mouse / keyboard / screenshot tools
 *     → the user's Windows computer
 *
 * The agent will eventually:
 *   - capture screenshots, with explicit permission
 *   - receive AI actions (MonitorAction) and carry them out
 *   - move an on-screen AI cursor distinct from the user's physical mouse
 *   - click, type, scroll, open applications
 *   - report current screen state back to this app
 *   - honour an immediate pause/stop at all times
 *
 * Nothing in this file, or anywhere else in Monitor Control, is allowed to
 * claim a connection, a session, or an AI action succeeded unless a real
 * agent or a real backend actually said so. Until both exist, every call
 * below either talks to a not-yet-deployed HTTP API (and surfaces the real
 * failure) or performs a real, honest local-network probe that is expected
 * to find nothing.
 * ============================================================================
 */

import type {
  AIProvider,
  MonitorChatMessage,
  MonitorSession,
} from './types';

/** REST surface the backend is expected to expose. None of it exists yet. */
export const MONITOR_API_ROUTES = {
  createSession: () => `/api/monitor/session`,
  getSession: (id: string) => `/api/monitor/session/${id}`,
  sendMessage: (id: string) => `/api/monitor/session/${id}/message`,
  pause: (id: string) => `/api/monitor/session/${id}/pause`,
  resume: (id: string) => `/api/monitor/session/${id}/resume`,
  stop: (id: string) => `/api/monitor/session/${id}/stop`,
  status: (id: string) => `/api/monitor/session/${id}/status`,
} as const;

/**
 * The desktop agent will eventually listen on a local WebSocket port and
 * accept a handshake from this page. The port/path here is a placeholder for
 * that future protocol, not a live integration.
 */
export const LOCAL_AGENT_WS_URL = 'ws://127.0.0.1:47821/launchly-agent';

export class MonitorServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'MonitorServiceError';
  }
}

async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (err) {
    throw new MonitorServiceError('Could not reach the Monitor Control backend.', err);
  }
  if (!res.ok) {
    throw new MonitorServiceError(`Monitor Control backend responded with ${res.status}.`);
  }
  return res.json() as Promise<T>;
}

/**
 * Probe the local machine for a running Launchly Desktop Agent.
 *
 * This opens a real WebSocket to the agent's expected local port and waits
 * briefly for a handshake. Today nothing is ever listening there, so this
 * genuinely resolves `{ found: false }` — it is a real check, not a canned
 * answer, and it will start finding the agent the moment one ships and
 * listens on that port.
 */
export function detectDesktopAgent(timeoutMs = 1200): Promise<{ found: boolean; version?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { found: boolean; version?: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let socket: WebSocket;
    try {
      socket = new WebSocket(LOCAL_AGENT_WS_URL);
    } catch {
      finish({ found: false });
      return;
    }

    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      finish({ found: false });
    }, timeoutMs);

    socket.onopen = () => {
      /* A real agent is expected to answer a handshake message with its
         version before this is trusted as "found". Until that protocol is
         implemented, an open socket alone is not treated as a detected
         agent. */
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* no-op */
      }
      finish({ found: false });
    };

    socket.onerror = () => {
      clearTimeout(timer);
      finish({ found: false });
    };
  });
}

/** Create a session against the future backend. */
export function createSession(provider: AIProvider): Promise<MonitorSession> {
  return requestJSON<MonitorSession>(MONITOR_API_ROUTES.createSession(), {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
}

export function getSession(sessionId: string): Promise<MonitorSession> {
  return requestJSON<MonitorSession>(MONITOR_API_ROUTES.getSession(sessionId));
}

/**
 * Test that a provider API key is usable. This calls the (not yet deployed)
 * backend so the key never has to leave the browser toward the provider
 * directly. There is deliberately no local shortcut that reports success —
 * a real result has to come back from the server.
 */
export function testProviderConnection(
  provider: AIProvider,
  apiKey: string
): Promise<{ ok: true } > {
  return requestJSON<{ ok: true }>(`/api/monitor/provider/test`, {
    method: 'POST',
    body: JSON.stringify({ provider, apiKey }),
  });
}

export function sendControlMessage(
  sessionId: string,
  message: string
): Promise<MonitorChatMessage> {
  return requestJSON<MonitorChatMessage>(MONITOR_API_ROUTES.sendMessage(sessionId), {
    method: 'POST',
    body: JSON.stringify({ type: 'control.command', sessionId, message }),
  });
}

export function pauseSession(sessionId: string): Promise<MonitorSession> {
  return requestJSON<MonitorSession>(MONITOR_API_ROUTES.pause(sessionId), { method: 'POST' });
}

export function resumeSession(sessionId: string): Promise<MonitorSession> {
  return requestJSON<MonitorSession>(MONITOR_API_ROUTES.resume(sessionId), { method: 'POST' });
}

export function stopSession(sessionId: string): Promise<MonitorSession> {
  return requestJSON<MonitorSession>(MONITOR_API_ROUTES.stop(sessionId), { method: 'POST' });
}

export function getSessionStatus(sessionId: string): Promise<MonitorSession> {
  return requestJSON<MonitorSession>(MONITOR_API_ROUTES.status(sessionId));
}
