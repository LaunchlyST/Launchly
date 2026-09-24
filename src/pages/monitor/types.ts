/**
 * Monitor Control — shared types.
 *
 * Monitor Control lets a user connect a Windows computer, running the future
 * "Launchly Desktop Agent", and drive it in natural language through an AI
 * provider. None of this exists yet: this module defines the shape the
 * frontend, the backend and the desktop agent will all speak once it does.
 */

/** AI providers Monitor Control can reason with. More can be added here. */
export type AIProvider = 'openai' | 'claude';

export const AI_PROVIDERS: Array<{ id: AIProvider; label: string }> = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Claude' },
];

/** Where the desktop-agent handshake currently stands. */
export type MonitorConnectionState =
  | 'agent-not-installed'
  | 'agent-detected'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface MonitorConnection {
  state: MonitorConnectionState;
  /** Set once a real agent has answered a handshake. Never fabricated. */
  agentVersion?: string;
  computerName?: string;
  error?: string;
}

/** The control session's own lifecycle, distinct from the transport state above. */
export type MonitorControlState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'active'
  | 'paused'
  | 'stopping'
  | 'connection-lost';

export interface MonitorSession {
  id: string;
  status: MonitorControlState;
  provider: AIProvider;
  computerName?: string;
  startedAt?: string;
}

/** One step the AI took (or is taking) on the remote computer. */
export interface MonitorAction {
  id: string;
  type: 'click' | 'type' | 'scroll' | 'open_app' | 'screenshot' | 'move_cursor' | 'key_press';
  payload: Record<string, unknown>;
  status: 'pending' | 'in-progress' | 'done' | 'failed';
  timestamp: string;
}

/** A natural-language instruction sent toward the AI provider / desktop agent. */
export interface MonitorCommand {
  type: 'control.command';
  sessionId: string;
  message: string;
}

export interface MonitorChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  timestamp: string;
  actions?: MonitorAction[];
}

/** Per-capability permissions. Each will eventually be grantable independently. */
export interface MonitorPermissions {
  screenViewing: boolean;
  mouseControl: boolean;
  keyboardControl: boolean;
}

export interface AICursorPosition {
  x: number;
  y: number;
}
