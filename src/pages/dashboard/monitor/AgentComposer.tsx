import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Paperclip, Zap, GitBranch, ArrowUp, Square, ChevronDown, Settings } from 'lucide-react';
import type { ModelSelection, ModelInfo, ConnectedProject, MonitorPermissions, ProviderId } from './types';
import { PROVIDERS, type LocalCliStatus } from './monitorApi';
import { getHandle, supportsLocalProjects } from './localProjects';

interface AgentComposerProps {
  disabled: boolean;
  placeholder: string;
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  modelSelection: ModelSelection;
  models: ModelInfo[];
  providers: Array<{ provider: ProviderId; connected: boolean; connectionType?: 'api' | 'subscription' | 'local' }>;
  onModelChange: (selection: ModelSelection) => void;
  project: ConnectedProject | null;
  projects: ConnectedProject[];
  onProjectChange: (project: ConnectedProject | null) => void;
  onConnectProject: () => void;
  localCli?: LocalCliStatus | null;
  permissions: MonitorPermissions;
  onPermissionsChange: (permissions: MonitorPermissions) => void;
}

export interface AgentComposerHandle {
  focus: () => void;
}

const BOOL_PERMISSIONS: Array<keyof MonitorPermissions> = [
  'readFiles', 'searchFiles', 'editFiles', 'createFiles', 'runDevCommands',
  'installPackages', 'autoCommit', 'autoPush', 'autoDeploy',
  'viewScreen', 'controlMouse', 'controlKeyboard',
];

export const AgentComposer = forwardRef<AgentComposerHandle, AgentComposerProps>((props, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState('');
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [input]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setShowModelMenu(false);
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) setShowProjectMenu(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (text && !props.disabled && !props.busy) {
      props.onSend(text);
      setInput('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(e);
    }
  };

  const modelLabel = (sel: ModelSelection): string => {
    if (sel.mode === 'auto') return 'Auto';
    if (sel.mode === 'local') return sel.provider === 'anthropic' ? 'Claude Code (local)' : 'Codex CLI (local)';
    const p = PROVIDERS.find((x) => x.id === sel.provider);
    if (sel.mode === 'latest') return `${p?.name.split(' ').pop() ?? sel.provider} · Latest`;
    return props.models.find((m) => m.modelId === sel.modelId)?.displayName ?? sel.modelId;
  };

  const projectLabel = props.project ? `${props.project.name} · ${props.project.branch}` : 'Select project';
  const canAttach = !!props.project && props.project.source === 'local' && supportsLocalProjects() && !attaching;

  /** Attach the real top-level file listing of the connected local folder so the
   * agent (running with --root pointed at the same folder) can reference it. */
  const attachFolderListing = async () => {
    if (!props.project || props.project.source !== 'local') return;
    setAttaching(true);
    setAttachError('');
    try {
      const handle = await getHandle(props.project.id);
      if (!handle) throw new Error('Launchly lost access to this folder — reconnect the project.');
      const names: string[] = [];
      const iter = (handle as any).values() as AsyncIterable<{ name: string; kind: string }>;
      for await (const entry of iter) {
        names.push(entry.kind === 'directory' ? `${entry.name}/` : entry.name);
        if (names.length >= 25) break;
      }
      if (!names.length) throw new Error('The folder is empty.');
      setInput((prev) => `${prev}${prev.trim() ? '\n\n' : ''}[Attached from ${props.project!.name}: ${names.join(', ')}]`);
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : 'Could not read the folder.');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <form className="mv-composer mv-composer--codex" onSubmit={submit}>
      <div className="mv-composer__toolbar">
        <div className="mv-composer__left">
          <button
            type="button"
            className="mv-composer__tool"
            title={props.project?.source === 'local' ? 'Attach file listing from the connected folder' : 'Attach needs a connected local-folder project'}
            disabled={props.disabled || !canAttach}
            onClick={() => void attachFolderListing()}
            aria-label="Attach file listing from connected folder"
          >
            <Paperclip size={16} />
          </button>
          <div className="mv-composer__selector" ref={modelMenuRef}>
            <button
              type="button"
              className={`mv-composer__select ${showModelMenu ? 'open' : ''}`}
              onClick={() => setShowModelMenu((v) => !v)}
              disabled={props.disabled}
              aria-expanded={showModelMenu}
              aria-haspopup="listbox"
              title="Model / provider"
            >
              <span className="mv-composer__select-icon"><Zap size={14} /></span>
              <span className="mv-composer__select-label">{modelLabel(props.modelSelection)}</span>
              <ChevronDown size={12} className={showModelMenu ? 'rotated' : ''} />
            </button>
            {showModelMenu && (
              <div className="mv-composer__dropdown" role="listbox">
                <div className="mv-composer__dropdown-section">
                  <span className="mv-composer__dropdown-title">Mode</span>
                  <button type="button" role="option" className={props.modelSelection.mode === 'auto' ? 'selected' : ''} onClick={() => { props.onModelChange({ mode: 'auto' }); setShowModelMenu(false); }}>Auto</button>
                  {props.providers.filter((p) => p.connected).map((p) => (
                    <button
                      type="button"
                      key={p.provider}
                      role="option"
                      className={props.modelSelection.mode !== 'auto' && props.modelSelection.provider === p.provider ? 'selected' : ''}
                      onClick={() => { props.onModelChange({ mode: 'latest', provider: p.provider }); setShowModelMenu(false); }}
                    >
                      {PROVIDERS.find((x) => x.id === p.provider)?.name} · Latest{p.connectionType === 'subscription' ? ' · Sub' : ' · API'}
                    </button>
                  ))}
                </div>
                <div className="mv-composer__dropdown-section">
                  <span className="mv-composer__dropdown-title">Your subscription (this computer)</span>
                  {(['anthropic', 'openai'] as const).map((pid) => {
                    const key = pid === 'openai' ? 'codex' : 'claude';
                    const cli = props.localCli?.[key];
                    const label = pid === 'openai' ? 'Codex CLI' : 'Claude Code';
                    return (
                      <button
                        type="button"
                        key={`local-${pid}`}
                        role="option"
                        className={props.modelSelection.mode === 'local' && props.modelSelection.provider === pid ? 'selected' : ''}
                        disabled={!cli?.authenticated}
                        title={!props.localCli ? 'Connect your computer to detect local CLIs' : cli?.authenticated ? `Run through ${label} on your computer` : `${label} not logged in on this computer`}
                        onClick={() => { props.onModelChange({ mode: 'local', provider: pid }); setShowModelMenu(false); }}
                      >
                        <span className="mv-model-name">{label} · local</span>
                        <span className="mv-model-provider">{!props.localCli ? 'unknown' : cli?.authenticated ? 'logged in' : cli?.installed ? 'login needed' : 'not installed'}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mv-composer__dropdown-section">
                  <span className="mv-composer__dropdown-title">Exact models</span>
                  {props.models.filter((m) => m.available).slice(0, 20).map((m) => (
                    <button
                      type="button"
                      key={`${m.provider}:${m.modelId}`}
                      role="option"
                      className={props.modelSelection.mode === 'exact' && props.modelSelection.modelId === m.modelId ? 'selected' : ''}
                      onClick={() => { props.onModelChange({ mode: 'exact', provider: m.provider, modelId: m.modelId }); setShowModelMenu(false); }}
                    >
                      <span className="mv-model-name">{m.displayName}</span>
                      <span className="mv-model-provider">{m.provider}</span>
                    </button>
                  ))}
                  {props.models.filter((m) => m.available).length === 0 && (
                    <span className="mv-composer__dropdown-empty">No models — connect an AI provider first.</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mv-composer__selector" ref={projectMenuRef}>
            <button
              type="button"
              className={`mv-composer__select ${showProjectMenu ? 'open' : ''}`}
              onClick={() => setShowProjectMenu((v) => !v)}
              disabled={props.disabled}
              aria-expanded={showProjectMenu}
              aria-haspopup="listbox"
              title="GitHub project / working context"
            >
              <GitBranch size={14} />
              <span className="mv-composer__select-label">{projectLabel}</span>
              <ChevronDown size={12} className={showProjectMenu ? 'rotated' : ''} />
            </button>
            {showProjectMenu && (
              <div className="mv-composer__dropdown" role="listbox">
                <button type="button" role="option" className={!props.project ? 'selected' : ''} onClick={() => { props.onProjectChange(null); setShowProjectMenu(false); }}>No project</button>
                {props.projects.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    role="option"
                    className={props.project?.id === p.id ? 'selected' : ''}
                    onClick={() => { props.onProjectChange(p); setShowProjectMenu(false); }}
                  >
                    <span>{p.name}</span>
                    <span className="mv-project-meta">{p.source} · {p.branch}</span>
                  </button>
                ))}
                <button type="button" role="option" className="mv-composer__connect" onClick={() => { setShowProjectMenu(false); props.onConnectProject(); }}>
                  Connect a GitHub project…
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mv-composer__right">
          <button type="button" className="mv-composer__tool" title="Task permissions" onClick={() => setShowPermissions((v) => !v)} disabled={props.disabled}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      {attachError && <p className="mv-composer__error" role="alert">{attachError}</p>}
      {showPermissions && (
        <div className="mv-permissions-popover">
          <div className="mv-permissions__header">Task permissions</div>
          {BOOL_PERMISSIONS.map((key) => (
            <label key={key} className="mv-permission">
              <input
                type="checkbox"
                checked={!!props.permissions[key]}
                onChange={(e) => props.onPermissionsChange({ ...props.permissions, [key]: e.target.checked })}
              />
              <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
            </label>
          ))}
          <label className="mv-permission">
            <span>Edit mode</span>
            <select
              value={props.permissions.editMode}
              onChange={(e) => props.onPermissionsChange({ ...props.permissions, editMode: e.target.value as 'ask' | 'auto' })}
            >
              <option value="ask">Ask before edits</option>
              <option value="auto">Auto</option>
            </select>
          </label>
        </div>
      )}

      <div className="mv-composer__input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 8000))}
          onKeyDown={onKeyDown}
          placeholder={props.placeholder}
          disabled={props.disabled || props.busy}
          rows={1}
          maxLength={8000}
          aria-label="Message the coding agent"
          spellCheck={false}
        />
      </div>

      <div className="mv-composer__actions">
        {props.busy ? (
          <button type="button" className="mv-sendbtn is-stop" onClick={props.onStop} aria-label="Stop task" title="Stop the running task">
            <Square size={15} />
          </button>
        ) : (
          <button type="submit" className="mv-sendbtn" disabled={props.disabled || !input.trim() || props.busy} aria-label="Send message" title="Send">
            <ArrowUp size={17} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </form>
  );
});

AgentComposer.displayName = 'AgentComposer';
