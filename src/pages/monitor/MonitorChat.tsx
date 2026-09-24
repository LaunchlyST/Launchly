import React, { useRef, useState } from 'react';
import { Send, Octagon } from 'lucide-react';
import { MonitorChatMessage } from './MonitorChatMessage';
import type { MonitorChatMessage as MonitorChatMessageT, MonitorControlState } from './types';

const SUGGESTIONS = [
  'Open Chrome',
  'Open TikTok Shop',
  'Go to my Downloads folder',
  'Open the latest image',
  'Search for a creator',
];

interface MonitorChatProps {
  messages: MonitorChatMessageT[];
  onSend: (text: string) => void;
  controlState: MonitorControlState;
  onStop: () => void;
}

/** The bottom chat panel: conversation, suggestions, and the send box. */
export function MonitorChat({ messages, onSend, controlState, onStop }: MonitorChatProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const isLive = controlState === 'active' || controlState === 'paused';

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="mc-chat">
      <div className="mc-chat__log" ref={listRef}>
        {messages.length === 0 && (
          <p className="mc-chat__empty">
            Connect your computer to start giving AI instructions here.
          </p>
        )}
        {messages.map((m) => (
          <MonitorChatMessage key={m.id} message={m} />
        ))}
      </div>

      {messages.length === 0 && (
        <div className="mc-chat__suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="mc-chat__suggestion"
              onClick={() => setDraft(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mc-chat__composer">
        <input
          className="mc-chat__input"
          value={draft}
          placeholder="Tell AI what to do…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button type="button" className="mc-btn-primary mc-chat__send" onClick={submit}>
          <Send size={15} />
          Send
        </button>
        {isLive && (
          <button type="button" className="mc-chat__stop" onClick={onStop} title="Stop AI control">
            <Octagon size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
