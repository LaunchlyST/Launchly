import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, FileText, Terminal, GitBranch, Check, X, LoaderCircle, AlertTriangle, ChevronDown, Clock, Zap, Square } from 'lucide-react';
import type { AgentTask, ToolActivity, FileDiff, ChangeSet, PendingApproval } from './types';

export type ConvMsg = {
  id: number;
  role: 'you' | 'assistant';
  text: string;
  status?: 'pending' | 'error';
  task?: AgentTask;
};

interface Props {
  messages: ConvMsg[];
  activeTask: AgentTask | null;
  busy: boolean;
  onApprove: (taskId: string, msgId: number) => void;
  onCancel: () => void;
  onApplyChanges: (msgId: number, task: AgentTask) => void;
  onUndoChanges: (msgId: number, task: AgentTask) => void;
  onSuggest?: (text: string) => void;
}

const toolIcons: Record<string, React.ReactNode> = {
  read_file: <FileText size={14} />,
  write_file: <FileText size={14} />,
  list_directory: <GitBranch size={14} />,
  run_command: <Terminal size={14} />,
  screenshot: <MessageSquare size={14} />,
  mouse_move: <Zap size={14} />,
  click: <Zap size={14} />,
  double_click: <Zap size={14} />,
  right_click: <Zap size={14} />,
  type: <Zap size={14} />,
  keypress: <Zap size={14} />,
  hotkey: <Zap size={14} />,
  scroll: <Zap size={14} />,
  wait: <Clock size={14} />,
  understand: <MessageSquare size={14} />,
};

const statusColors: Record<ToolActivity['status'], string> = {
  pending: '#98a2b3',
  running: '#2563eb',
  done: '#12b76a',
  error: '#e03e3e',
};

export function AgentConversation({ messages, activeTask, busy, onApprove, onCancel, onApplyChanges, onUndoChanges, onSuggest }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, activeTask, busy]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderStep = (a: ToolActivity) => {
    const open = expanded.has(a.id);
    const color = statusColors[a.status];
    const Icon = toolIcons[a.tool] || <Square size={14} />;
    return (
      <div key={a.id} className="mv-tool-step" style={{ borderLeftColor: color }}>
        <button type="button" className="mv-tool-step__header" onClick={() => toggle(a.id)}>
          <span className="mv-tool-step__icon" style={{ color }}>{Icon}</span>
          <span className="mv-tool-step__label">{a.label}</span>
          <span className="mv-tool-step__status" style={{ color }}>
            {a.status === 'running' && <LoaderCircle size={12} className="spin" />}
            {a.status === 'done' && <Check size={12} />}
            {a.status === 'error' && <X size={12} />}
            {a.status === 'pending' && <Clock size={12} />}
          </span>
          <ChevronDown size={12} className={open ? 'expanded' : ''} />
        </button>
        {open && (
          <div className="mv-tool-step__details">
            <span className="mv-tool-step__tool">{a.tool}</span>
            <span className="mv-tool-step__state">{a.status}</span>
          </div>
        )}
      </div>
    );
  };

  const renderDiffs = (msgId: number, task: AgentTask, changes: ChangeSet) => (
    <div className="mv-changes">
      <div className="mv-changes__header">
        <span><Check size={14} /> {changes.files.length} file{changes.files.length !== 1 ? 's' : ''} changed</span>
        <div className="mv-changes__actions">
          <button type="button" className="mv-btn mv-btn--ghost" onClick={() => onApplyChanges(msgId, task)}>Apply</button>
          <button type="button" className="mv-btn mv-btn--ghost" onClick={() => onUndoChanges(msgId, task)}>Undo</button>
        </div>
      </div>
      {changes.files.map((f: FileDiff) => (
        <div key={f.path} className="mv-file-diff">
          <div className="mv-file-diff__header">
            <FileText size={14} />
            <span>{f.path}</span>
            <span className="mv-file-diff__stats">+{f.added} −{f.removed}</span>
          </div>
          <pre className="mv-file-diff__patch">{f.patch}</pre>
        </div>
      ))}
      {changes.checks.length > 0 && (
        <div className="mv-checks">
          {changes.checks.map((c, i) => (
            <div key={i} className={`mv-check ${c.passed ? 'passed' : 'failed'}`}>
              <span>{c.passed ? <Check size={12} /> : <X size={12} />}</span>
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderApproval = (taskId: string, msgId: number, approval: PendingApproval) => (
    <div className="mv-approval">
      <AlertTriangle size={16} className="mv-approval__icon" />
      <div className="mv-approval__content">
        <strong>Approval required</strong>
        <p>{approval.label}</p>
        <pre>{JSON.stringify(approval.input, null, 2)}</pre>
      </div>
      <div className="mv-approval__actions">
        <button type="button" className="mv-btn mv-btn--danger" onClick={onCancel}>Cancel</button>
        <button type="button" className="mv-btn mv-btn--primary" onClick={() => onApprove(taskId, msgId)}>Allow</button>
      </div>
    </div>
  );

  if (messages.length === 0) {
    const suggestions = ['Explain this project', 'Find the file responsible for the login page', 'What changed in the project recently?'];
    return (
      <div className="mv-conv__empty">
        <span className="mv-conv__empty-icon"><MessageSquare size={26} strokeWidth={1.4} aria-hidden="true" /></span>
        <strong>What should the agent do?</strong>
        <p>Describe the task — e.g. “Open the project and fix the login bug”. The agent works on your connected computer and project.</p>
        {onSuggest && (
          <div className="mv-suggest">
            {suggestions.map((s) => (
              <button key={s} type="button" className="mv-suggest__chip" onClick={() => onSuggest(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mv-conv" ref={listRef} role="log" aria-label="Agent conversation" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`mv-msg mv-msg--${m.role} ${m.status ? `is-${m.status}` : ''}`}>
          {m.role === 'you' ? (
            <div className="mv-msg__user">{m.text}</div>
          ) : m.task ? (
            <>
              {m.task.prompt && <div className="mv-task__prompt">{m.task.prompt}</div>}
              <div className="mv-task-activity">
                {m.task.activity.map(renderStep)}
              </div>
              {m.task.error && (
                <div className="mv-task__error" role="alert">
                  <X size={13} /> {m.task.error}
                </div>
              )}
              {m.task.status === 'awaiting-approval' && m.task.pendingApproval && renderApproval(m.task.id, m.id, m.task.pendingApproval)}
              {m.task.changes && renderDiffs(m.id, m.task, m.task.changes)}
              {(m.task.status === 'working' || m.task.status === 'awaiting-approval') && (
                <div className="mv-task__progress">
                  <LoaderCircle size={12} className="spin" />
                  <span>{m.task.actionsExecuted}/{m.task.maxActions} actions · {m.task.status === 'awaiting-approval' ? 'waiting for approval' : 'working'}</span>
                </div>
              )}
              {m.task.status === 'done' && <div className="mv-task__done"><Check size={13} /> Done</div>}
              {m.task.status === 'stopped' && <div className="mv-task__stopped">Stopped{ m.task.error ? ` — ${m.task.error}` : ''}</div>}
            </>
          ) : m.status === 'pending' ? (
            <div className="mv-thinking"><LoaderCircle size={15} className="spin" /> Thinking…</div>
          ) : (
            <div className="mv-msg__assistant">{m.text}</div>
          )}
        </div>
      ))}
      {busy && !activeTask && (
        <div className="mv-msg mv-msg--assistant">
          <div className="mv-thinking"><LoaderCircle size={15} className="spin" /> Starting…</div>
        </div>
      )}
    </div>
  );
}
