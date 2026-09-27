import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { ConnectedProject } from './types';

/** "+ Connect project" or "● launchly / main ▾" with a small menu. */
export function ProjectSelector({ project, onConnect, onDisconnect }: { project: ConnectedProject | null; onConnect: () => void; onDisconnect: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!project)
    return (
      <button type="button" className="mt-btn" onClick={onConnect}>
        <Plus size={13} /> <span className="mt-btn__text">Connect project</span>
      </button>
    );
  return (
    <div className="mt-pop" ref={ref}>
      <button type="button" className="mt-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={`${project.repository} · ${project.status}`}>
        <i className={`mt-dot mt-dot--${project.status}`} />
        <span className="mt-btn__text">
          {project.name} <span className="mt-sep">/</span> {project.branch}
        </span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="mt-menu" role="menu">
          <div className="mt-menu__info">
            <strong>{project.repository}</strong>
            <small>
              {project.branch} · {project.status === 'synced' ? 'Synced' : project.status === 'syncing' ? 'Syncing…' : 'Sync error'}
            </small>
          </div>
          <div className="mt-menu__sep" />
          <button type="button" className="mt-item" onClick={() => { setOpen(false); onConnect(); }}>
            <span className="mt-item__check" />Switch project
          </button>
          <button type="button" className="mt-item" onClick={() => { setOpen(false); onDisconnect(); }}>
            <span className="mt-item__check" />Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
