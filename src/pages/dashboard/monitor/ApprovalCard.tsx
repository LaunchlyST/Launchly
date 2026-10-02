import React from 'react';
import type { AgentTask } from './types';

const WAITING = ' — waiting for your approval';

/** The real action the backend paused on — never invented in the UI. */
function pendingLabel(task: AgentTask): string {
  if (task.pendingApproval?.label) return task.pendingApproval.label;
  const row = [...task.activity].reverse().find((a) => a.status === 'pending' || a.status === 'running');
  const text = row?.label ?? '';
  return text.endsWith(WAITING) ? text.slice(0, -WAITING.length) : text;
}

export function ApprovalCard({ task, onAllow, onCancel }: { task: AgentTask; onAllow: () => void; onCancel: () => void }) {
  const label = pendingLabel(task);
  return (
    <div className="mv-approval" role="alert">
      <p className="mv-approval__title">Approval needed</p>
      <p className="mv-approval__action">
        Launchly wants to {label ? label.charAt(0).toLowerCase() + label.slice(1) : 'run an action on your computer'}
      </p>
      <p className="mv-approval__meta">Nothing runs until you allow it.</p>
      <div className="mv-approval__actions">
        <button type="button" className="mv-btn mv-btn--primary" onClick={onAllow}>
          Allow
        </button>
        <button type="button" className="mv-btn mv-btn--danger" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}