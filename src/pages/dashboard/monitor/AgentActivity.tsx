import React, { useState } from 'react';
import { Check, Circle, LoaderCircle, Undo2, X } from 'lucide-react';
import type { AgentTask, ChangeSet } from './types';
import { DiffViewer } from './DiffViewer';

/** Inline activity rows for a project task — not cards. */
export function AgentActivity({ task }: { task: AgentTask }) {
  return (
    <div className="ma">
      {task.activity.map((a) => (
        <div key={a.id} className={`ma-row ma-row--${a.status}`}>
          <span className="ma-row__icon">
            {a.status === 'done' ? <Check size={12} /> : a.status === 'running' ? <LoaderCircle size={12} className="spin" /> : a.status === 'error' ? <X size={12} /> : <Circle size={9} />}
          </span>
          {a.label}
        </div>
      ))}
      {task.error && <p className="ma-error">{task.error}</p>}
    </div>
  );
}

/** "✓ Changes ready · 3 files changed · Build passed" with View / Undo / Apply. */
export function ChangeSummary({ changes, onApply, onUndo, busy }: { changes: ChangeSet; onApply: () => void; onUndo: () => void; busy: boolean }) {
  const [viewing, setViewing] = useState(false);
  const build = changes.checks.find((c) => /build/i.test(c.name));
  return (
    <div className="mc">
      <p className="mc-title">
        <Check size={13} /> {changes.applied ? 'Changes applied' : 'Changes ready'}
      </p>
      <p className="mc-meta">
        {changes.files.length} {changes.files.length === 1 ? 'file' : 'files'} changed
        {build && <> · Build {build.passed ? 'passed' : 'failed'}</>}
      </p>
      <div className="mc-actions">
        <button type="button" className="mm-btn" onClick={() => setViewing(true)}>
          View changes
        </button>
        <button type="button" className="mm-btn" onClick={onUndo} disabled={busy}>
          <Undo2 size={13} /> Undo
        </button>
        {!changes.applied && (
          <button type="button" className="mm-btn mm-btn--primary" onClick={onApply} disabled={busy}>
            Apply
          </button>
        )}
      </div>
      {viewing && <DiffViewer files={changes.files} onClose={() => setViewing(false)} />}
    </div>
  );
}
