/**
 * Types for the AI conversation shown in the left sidebar.
 *
 * The conversation is deliberately modelled as a flat, append-only list of
 * messages. Every visual state the sidebar can show — thinking, streaming,
 * failed, retryable — is a property of a message rather than a separate
 * branch of the layout, so the container renders the same shape from the
 * empty state through to hundreds of messages.
 */

export type MessageRole = 'user' | 'assistant';

/**
 * Lifecycle of a single message.
 *
 * user:      sending → sent | failed
 * assistant: thinking → streaming → complete | error | stopped
 */
export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'failed'
  | 'thinking'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'stopped';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  text: string;
  /** Epoch ms — rendered as a time only, and only where it aids scanning. */
  createdAt: number;
  status: MessageStatus;
  /** Present on failed/error messages; shown inline above the retry action. */
  error?: string;
  /** Model that produced an assistant message, for the metadata line. */
  model?: string;
}

/** Coarse status of the conversation as a whole, used to drive the composer. */
export type ConversationStatus = 'idle' | 'sending' | 'thinking' | 'responding';

export interface ConversationState {
  messages: ConversationMessage[];
  status: ConversationStatus;
  /** True while an assistant turn can still be interrupted. */
  canStop: boolean;
}

/** A message is still in flight if it has not reached a terminal status. */
export function isPending(status: MessageStatus): boolean {
  return status === 'sending' || status === 'thinking' || status === 'streaming';
}

/** Terminal statuses that the user can act on with a retry. */
export function isRetryable(status: MessageStatus): boolean {
  return status === 'failed' || status === 'error';
}
