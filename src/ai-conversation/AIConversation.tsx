import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, Trash2 } from 'lucide-react';
import { ConversationMessage, ConversationStatus } from './conversation.types';
import { AIMessage } from './AIMessage';

interface AIConversationProps {
  messages: ConversationMessage[];
  status: ConversationStatus;
  onRetry: (id: string) => void;
  onClear: () => void;
}

/** Distance from the bottom, in px, still treated as "pinned to latest". */
const PIN_THRESHOLD = 48;

/**
 * The conversation surface. Mounted for the whole life of the editor —
 * including before a single message exists — so that sending message #1
 * appends a row instead of building a new layout.
 */
export function AIConversation({ messages, status, onRetry, onClear }: AIConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  /**
   * Whether new messages should pull the view down. Starts pinned, and only
   * unpins when the user deliberately scrolls up to read history.
   */
  const pinnedRef = useRef(true);
  /**
   * Set while we are scrolling the log ourselves. The scroll events that a
   * programmatic jump emits must not be read as the user scrolling away,
   * which would unpin the view and stop it following new messages.
   */
  const programmaticRef = useRef(false);
  const [showJump, setShowJump] = useState(false);

  const isEmpty = messages.length === 0;
  const busy = status !== 'idle';

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    // Guarded for the length of the animation, so its own scroll events do
    // not unpin the view it is in the middle of pinning.
    programmaticRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
    pinnedRef.current = true;
    setShowJump(false);
    window.setTimeout(() => { programmaticRef.current = false; }, 420);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || programmaticRef.current) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distance <= PIN_THRESHOLD;
    // Only offer the jump affordance once there is real history behind it.
    setShowJump(!pinnedRef.current && el.scrollHeight > el.clientHeight + PIN_THRESHOLD);
  }, []);

  /**
   * Follow the tail as messages arrive or stream, but never yank the view
   * away from someone reading further up.
   */
  useLayoutEffect(() => {
    if (!pinnedRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    // Jump rather than animate: streaming updates arrive faster than a smooth
    // scroll can settle, and each in-flight animation would emit scroll
    // events that look like the user taking over.
    programmaticRef.current = true;
    el.scrollTop = el.scrollHeight;
    const id = requestAnimationFrame(() => { programmaticRef.current = false; });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  // Re-evaluate the jump button when the panel itself is resized.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(handleScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [handleScroll]);

  return (
    <section className="ai-conv" aria-label="AI conversation">
      <header className="ai-conv__header">
        <span className="ai-conv__label">Assistant</span>
        {busy && <span className="ai-conv__status">{status === 'responding' ? 'Responding' : 'Thinking'}</span>}
        {/* Always mounted, only hidden while empty — rendering it on message
            #1 would change the header's height and shrink the scroller. */}
        <button
          type="button"
          className={`ai-conv__clear ${isEmpty ? 'is-hidden' : ''}`}
          onClick={onClear}
          disabled={isEmpty}
          tabIndex={isEmpty ? -1 : 0}
          aria-hidden={isEmpty}
          title="Clear conversation"
          aria-label="Clear conversation"
        >
          <Trash2 size={12} strokeWidth={2.1} />
        </button>
      </header>

      <div
        className={`ai-conv__scroll ${isEmpty ? 'is-empty' : ''}`}
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Messages"
        tabIndex={0}
      >
        {isEmpty ? (
          // Deliberately blank: an empty transcript is an empty box.
          <div className="ai-conv__empty" />
        ) : (
          <div className="ai-conv__list">
            {messages.map((m) => (
              <AIMessage key={m.id} message={m} onRetry={onRetry} busy={busy} />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className={`ai-conv__jump ${showJump ? 'is-visible' : ''}`}
        onClick={() => scrollToLatest()}
        tabIndex={showJump ? 0 : -1}
        aria-hidden={!showJump}
      >
        <ArrowDown size={12} strokeWidth={2.4} />
        Latest
      </button>
    </section>
  );
}
