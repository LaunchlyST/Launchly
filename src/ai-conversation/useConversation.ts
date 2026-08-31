import { useCallback, useRef, useState } from 'react';
import {
  ConversationMessage,
  ConversationStatus,
  MessageStatus,
} from './conversation.types';

/**
 * Owns the AI conversation.
 *
 * This lives above the sidebar rather than inside the composer on purpose:
 * the message list has to outlive any single input, and the conversation
 * container must be able to render before the first message exists. Keeping
 * the state here is what stops the layout from being rebuilt on message #1.
 */

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

/**
 * Produces an assistant reply. Replacing this one function is all that is
 * needed to put a real model behind the sidebar — the UI already handles
 * incremental chunks, interruption and failure.
 *
 * `onChunk` may be called any number of times; the promise settles when the
 * turn is done. Rejecting puts the message into its error state.
 */
export type Responder = (
  prompt: string,
  ctx: { model: string; signal: AbortSignal; onChunk: (text: string) => void }
) => Promise<void>;

interface UseConversationOptions {
  model: string;
  respond: Responder;
  /** Called after a user message is accepted, so callers can clear the input. */
  onSent?: (prompt: string) => void;
}

export function useConversation({ model, respond, onSent }: UseConversationOptions) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Mirror of `messages` for reads outside of render. Retry needs to inspect
   * the transcript to decide what to drop, and doing that inside a setState
   * updater would run the side effect twice under StrictMode.
   */
  const messagesRef = useRef<ConversationMessage[]>([]);
  messagesRef.current = messages;

  const patch = useCallback((id: string, next: Partial<ConversationMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
  }, []);

  /**
   * Runs one assistant turn against an already-appended user message.
   * Split out from `send` so retry can re-run it without duplicating the
   * user's message in the transcript.
   */
  const runTurn = useCallback(
    async (prompt: string, userId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      const replyId = nextId('ai');
      setMessages((prev) => [
        ...prev,
        {
          id: replyId,
          role: 'assistant',
          text: '',
          createdAt: Date.now(),
          status: 'thinking' as MessageStatus,
          model,
        },
      ]);
      setStatus('thinking');

      try {
        let acc = '';
        await respond(prompt, {
          model,
          signal: controller.signal,
          onChunk: (chunk) => {
            if (controller.signal.aborted) return;
            acc += chunk;
            setStatus('responding');
            patch(replyId, { text: acc, status: 'streaming' });
          },
        });

        if (controller.signal.aborted) {
          // Keep whatever arrived before the stop — discarding it would lose
          // work the user asked to interrupt, not to erase.
          patch(replyId, { status: 'stopped' });
        } else {
          patch(replyId, { status: 'complete' });
        }
      } catch (err) {
        if (controller.signal.aborted) {
          patch(replyId, { status: 'stopped' });
        } else {
          // The failure belongs to the assistant turn, which carries the
          // message and the retry. Flagging the user's message too would put
          // a second, redundant retry on a message that was sent fine.
          patch(replyId, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Something went wrong.',
          });
        }
      } finally {
        abortRef.current = null;
        setStatus('idle');
      }
    },
    [model, respond, patch]
  );

  /** Appends the user's message immediately, then starts the assistant turn. */
  const send = useCallback(
    (raw: string) => {
      const prompt = raw.trim();
      if (!prompt || status !== 'idle') return;

      const userId = nextId('me');
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', text: prompt, createdAt: Date.now(), status: 'sent' },
      ]);
      setStatus('sending');
      onSent?.(prompt);
      void runTurn(prompt, userId);
    },
    [status, onSent, runTurn]
  );

  /**
   * Retries the failed turn a message belongs to. Drops the errored assistant
   * reply and re-runs from the user's prompt, so a retry never leaves a dead
   * error bubble stranded in the transcript.
   */
  const retry = useCallback(
    (messageId: string) => {
      if (status !== 'idle') return;
      const list = messagesRef.current;
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx === -1) return;

      // Walk back to the user prompt that started this turn.
      let userIdx = idx;
      while (userIdx >= 0 && list[userIdx].role !== 'user') userIdx -= 1;
      if (userIdx < 0) return;

      const user = list[userIdx];
      // Everything after the prompt is the failed attempt, so it goes.
      setMessages(
        list
          .slice(0, userIdx + 1)
          .map((m) => (m.id === user.id ? { ...m, status: 'sent' as MessageStatus } : m))
      );
      void runTurn(user.text, user.id);
    },
    [status, runTurn]
  );

  /** Interrupts the in-flight assistant turn, keeping partial output. */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStatus('idle');
  }, []);

  return {
    messages,
    status,
    canStop: status === 'thinking' || status === 'responding',
    send,
    retry,
    stop,
    clear,
  };
}
