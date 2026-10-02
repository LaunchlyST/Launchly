import React from 'react';
import { Bot, ChevronDown, MoreHorizontal } from 'lucide-react';
import type { Tone } from './MonitorTopBar';

/**
 * Right-hand AI panel. Header only — the conversation and composer are passed
 * in as children so all task state stays in MonitorPanel.
 */
export function AgentPanel({
  statusLabel,
  statusTone,
  modelLabel,
  onOpenModel,
  onOpenMenu,
  children,
}: {
  statusLabel: string;
  statusTone: Tone;
  modelLabel: string;
  onOpenModel: () => void;
  onOpenMenu: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mv-panel mv-agent" aria-label="Launchly Agent">
      <header className="mv-panel__head">
        <div className="mv-panel__lead">
          <span className="mv-panel__title">
            <Bot size={15} strokeWidth={1.9} /> Launchly Agent
          </span>
          <span className="mv-status" data-tone={statusTone}>
            <i aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
        <div className="mv-panel__tools">
          <button type="button" className="mv-chipbtn" onClick={onOpenModel} aria-label="AI model" title="Choose the AI model">
            {modelLabel}
            <ChevronDown size={12} />
          </button>
          <button type="button" className="mv-iconbtn" onClick={onOpenMenu} aria-label="Agent settings" title="Agent settings">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </header>
      {children}
    </section>
  );
}