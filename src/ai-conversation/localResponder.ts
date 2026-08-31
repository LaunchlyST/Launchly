import { Responder } from './useConversation';

/**
 * Placeholder responder used until a model is wired up.
 *
 * The editor has no AI backend yet — the previous `handleAiSend` only raised
 * a toast. This keeps that "instruction received" behaviour while giving the
 * conversation something real to render, and it exercises every state the UI
 * supports (thinking, incremental chunks, interruption).
 *
 * Swap this for a call to the real endpoint and nothing in the UI changes.
 */

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });

function acknowledgement(prompt: string, model: string): string {
  const label = model === 'claude' ? 'Claude' : 'ChatGPT';
  const short = prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt;
  return `Queued for ${label}: “${short}”. Model execution isn’t connected yet, so nothing on the timeline has changed.`;
}

export const localResponder: Responder = async (prompt, { model, signal, onChunk }) => {
  // A beat of "thinking" before the first token, so the indicator is visible.
  await wait(420, signal);

  const words = acknowledgement(prompt, model).split(' ');
  for (let i = 0; i < words.length; i += 1) {
    if (signal.aborted) return;
    onChunk(i === 0 ? words[i] : ` ${words[i]}`);
    await wait(18, signal);
  }
};
