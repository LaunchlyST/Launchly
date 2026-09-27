import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, FolderOpen, GitBranch, LoaderCircle, Lock, Search } from 'lucide-react';
import { Github } from './GithubMark';
import { Modal, Unavailable } from './Modal';
import { monitorApi } from './monitorApi';
import type { ConnectedProject, GitHubRepo, MonitorBackendStatus } from './types';

type Step = 'choose' | 'github' | 'git-url' | 'local';

interface Props {
  token: string | null;
  backend: MonitorBackendStatus | null;
  onClose: () => void;
  onConnected: (p: ConnectedProject) => void;
}

/** Connect a project: GitHub (primary), local folder via Monitor Bridge, or a git URL. */
export function ProjectConnectionModal({ token, backend, onClose, onConnected }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const caps = backend?.capabilities;

  return (
    <Modal
      title="Connect a project"
      subtitle="Connect a codebase so Monitor can understand, edit, test and update your project."
      onClose={onClose}
      width={480}
    >
      {step !== 'choose' && (
        <button type="button" className="mm-back" onClick={() => setStep('choose')}>
          <ChevronLeft size={14} /> All options
        </button>
      )}
      {step === 'choose' && (
        <div className="mm-options">
          <Option icon={<Github size={17} />} title="GitHub" text="Connect a repository" onClick={() => setStep('github')} />
          <Option icon={<FolderOpen size={17} />} title="Local project" text="Connect a folder on this computer" onClick={() => setStep('local')} />
          <Option icon={<GitBranch size={17} />} title="Git repository" text="Import using a repository URL" onClick={() => setStep('git-url')} />
        </div>
      )}
      {step === 'github' && <GitHubFlow token={token} enabled={!!caps?.github} onConnected={onConnected} />}
      {step === 'git-url' && <GitUrlFlow token={token} enabled={!!caps?.gitUrl} onConnected={onConnected} />}
      {step === 'local' && (
        <div className="mm-stack">
          <p className="mm-note">
            Local folders connect through <strong>Monitor Bridge</strong>, a small app on your computer. The website never gets direct access to your files —
            the bridge only exposes the folder you choose.
          </p>
          <Unavailable>{caps?.localBridge ? 'Open Monitor Bridge on this computer to pick a folder.' : 'Monitor Bridge isn’t available yet.'}</Unavailable>
        </div>
      )}
    </Modal>
  );
}

function Option({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" className="mm-option" onClick={onClick}>
      <span className="mm-option__icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </button>
  );
}

function GitHubFlow({ token, enabled, onConnected }: { token: string | null; enabled: boolean; onConnected: (p: ConnectedProject) => void }) {
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    monitorApi.githubRepos(token).then((r) => (r.ok ? setRepos(r.data) : r.reason === 'unauthorized' ? setRepos(null) : setError(r.message)));
  }, [enabled, token]);

  async function authorize() {
    setBusy(true);
    const r = await monitorApi.githubStart(token);
    setBusy(false);
    if (r.ok) window.location.href = r.data.authorizeUrl;
    else setError(r.message);
  }

  if (!enabled) return <Unavailable>GitHub connection isn’t set up on the server yet.</Unavailable>;
  if (repo) return <BranchSelector token={token} repo={repo} onBack={() => setRepo(null)} onConnected={onConnected} />;
  return (
    <div className="mm-stack">
      {repos === null && !error && (
        <button type="button" className="mm-btn mm-btn--primary mm-btn--block" onClick={authorize} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="spin" /> : <Github size={14} />} Connect GitHub
        </button>
      )}
      {error && <p className="mm-note mm-note--error">{error}</p>}
      {repos && <RepositorySelector repos={repos} query={query} setQuery={setQuery} onPick={setRepo} />}
    </div>
  );
}

export function RepositorySelector({ repos, query, setQuery, onPick }: { repos: GitHubRepo[]; query: string; setQuery: (q: string) => void; onPick: (r: GitHubRepo) => void }) {
  const list = useMemo(() => repos.filter((r) => r.fullName.toLowerCase().includes(query.toLowerCase())).slice(0, 50), [repos, query]);
  return (
    <>
      <div className="mm-input">
        <Search size={14} />
        <input placeholder="Search repositories" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>
      <div className="mm-list">
        {list.map((r) => (
          <button key={r.id} type="button" className="mm-list__item" onClick={() => onPick(r)}>
            <span>{r.fullName}</span>
            {r.private && <Lock size={12} />}
          </button>
        ))}
        {list.length === 0 && <p className="mm-note mm-note--muted">No repositories match.</p>}
      </div>
    </>
  );
}

export function BranchSelector({ token, repo, onBack, onConnected }: { token: string | null; repo: GitHubRepo; onBack: () => void; onConnected: (p: ConnectedProject) => void }) {
  const [branches, setBranches] = useState<string[]>([repo.defaultBranch]);
  const [branch, setBranch] = useState(repo.defaultBranch);
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' });
  useEffect(() => {
    monitorApi.githubBranches(token, repo.fullName).then((r) => r.ok && r.data.length && setBranches(r.data));
  }, [token, repo.fullName]);
  async function connect() {
    setState({ busy: true, error: '' });
    const r = await monitorApi.connectProject(token, { source: 'github', repository: repo.fullName, branch });
    if (r.ok) onConnected(r.data);
    else setState({ busy: false, error: r.message });
  }
  return (
    <div className="mm-stack">
      <div className="mm-row">
        <span className="mm-row__label">{repo.fullName}</span>
        <button type="button" className="mm-link" onClick={onBack}>
          Change
        </button>
      </div>
      <label className="mm-field">
        <span>Branch</span>
        <select className="mm-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
          {branches.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      {state.error && <p className="mm-note mm-note--error">{state.error}</p>}
      <div className="mm-actions">
        <button type="button" className="mm-btn mm-btn--primary" onClick={connect} disabled={state.busy}>
          {state.busy && <LoaderCircle size={13} className="spin" />} Connect
        </button>
      </div>
    </div>
  );
}

function GitUrlFlow({ token, enabled, onConnected }: { token: string | null; enabled: boolean; onConnected: (p: ConnectedProject) => void }) {
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [state, setState] = useState({ busy: false, error: '' });
  const valid = /^(https:\/\/|git@)[\w.@:/~-]+(\.git)?$/.test(url.trim());
  async function connect() {
    setState({ busy: true, error: '' });
    const r = await monitorApi.connectProject(token, { source: 'git-url', repository: url.trim(), branch: branch.trim() || 'main' });
    if (r.ok) onConnected(r.data);
    else setState({ busy: false, error: r.message });
  }
  if (!enabled) return <Unavailable>Importing by repository URL isn’t set up on the server yet.</Unavailable>;
  return (
    <div className="mm-stack">
      <label className="mm-field">
        <span>Repository URL</span>
        <div className="mm-input">
          <GitBranch size={14} />
          <input placeholder="https://github.com/owner/repo.git" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      </label>
      <label className="mm-field">
        <span>Branch</span>
        <div className="mm-input">
          <input value={branch} onChange={(e) => setBranch(e.target.value)} />
        </div>
      </label>
      {state.error && <p className="mm-note mm-note--error">{state.error}</p>}
      <div className="mm-actions">
        <button type="button" className="mm-btn mm-btn--primary" disabled={!valid || state.busy} onClick={connect}>
          {state.busy && <LoaderCircle size={13} className="spin" />} Connect
        </button>
      </div>
    </div>
  );
}
