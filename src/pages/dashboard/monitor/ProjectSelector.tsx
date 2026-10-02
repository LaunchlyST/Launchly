import React, { useEffect, useRef, useState } from 'react';
import { Check, FolderOpen, GitBranch, Plus, Search, TriangleAlert } from 'lucide-react';
import type { ConnectedProject } from './types';

const sourceLabel = { github: 'GitHub', local: 'Local', 'git-url': 'Git' };

export function ProjectSelector({ project, projects, loading, error, permission, onRestorePermission, onSelect, onConnect, onRefresh }: {
  project: ConnectedProject | null;
  projects: ConnectedProject[];
  loading: boolean;
  error: string;
  permission: 'granted' | 'needed' | 'unavailable' | null;
  onRestorePermission: () => void;
  onSelect: (project: ConnectedProject) => void;
  onConnect: () => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  const list = projects.filter(p => `${p.name} ${p.repository} ${p.branch}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="mp-context" ref={ref}>
    <button type="button" className="mt-btn" ref={trigger} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { if (!open) { setQuery(''); onRefresh(); } setOpen(!open); }}>
      <FolderOpen size={16} /> <span className="mt-btn__text">{project?.name || 'Connect project'}</span>
      {project && <><small>{sourceLabel[project.source]}</small><GitBranch size={12} /><span className="mt-btn__text">{project.branch}</span></>}
    </button>
    {project && permission === 'needed' && (
      <button type="button" className="mp-permission" onClick={onRestorePermission} title="Launchly lost access to this folder — click to allow it again">
        <TriangleAlert size={12} /> Permission needed
      </button>
    )}
    {open && <div className="mp-picker" role="dialog" aria-label="Choose project">
      <label className="mp-search"><Search size={14} /><input ref={search} aria-label="Search projects" placeholder="Search projects" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="mp-list">
        {loading && <p role="status">Loading projects…</p>}
        {error && <p role="alert">{error} <button type="button" onClick={onRefresh}>Retry</button></p>}
        {!loading && !error && !projects.length && <p>No projects yet</p>}
        {!loading && !!projects.length && !list.length && <p>No matching projects</p>}
        {list.map(p => <button type="button" className="mp-option" key={p.id} aria-pressed={project?.id === p.id}
          onClick={() => { onSelect(p); setOpen(false); trigger.current?.focus(); }}>
          <FolderOpen size={14} /><span><strong>{p.name}</strong><small>{sourceLabel[p.source]} · {p.branch}</small></span>{project?.id === p.id && <Check size={13} />}
        </button>)}
      </div>
      <button type="button" className="mp-option mp-add" onClick={() => { setOpen(false); onConnect(); }}><Plus size={14} />{projects.length ? 'Connect another project' : 'Connect a project'}</button>
    </div>}
  </div>;
}
