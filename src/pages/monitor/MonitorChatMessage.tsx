import React from 'react';
import { Sparkles, User, Info } from 'lucide-react';
import type { MonitorChatMessage as MonitorChatMessageT } from './types';

export function MonitorChatMessage({ message }: { message: MonitorChatMessageT }) {
  return (
    <div className={`mc-msg mc-msg--${message.role}`}>
      <span className="mc-msg__icon">
        {message.role === 'user' ? (
          <User size={13} />
        ) : message.role === 'ai' ? (
          <Sparkles size={13} />
        ) : (
          <Info size={13} />
        )}
      </span>
      <p className="mc-msg__text">{message.text}</p>
    </div>
  );
}
