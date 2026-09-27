import React, { useState } from 'react';
import { Modal } from './Modal';
import type { FileDiff } from './types';

/** File list + unified diff with added/removed line colouring. */
export function DiffViewer({ files, onClose }: { files: FileDiff[]; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const file = files[active];
  return (
    <Modal title="Changes" subtitle={`${files.length} ${files.length === 1 ? 'file' : 'files'} changed`} onClose={onClose} width={960}>
      <div className="md">
        <nav className="md-files">
          {files.map((f, i) => (
            <button key={f.path} type="button" className={i === active ? 'is-on' : ''} onClick={() => setActive(i)}>
              <span className="md-files__name">{f.path}</span>
              <span className="md-files__stat">
                <em className="add">+{f.added}</em> <em className="del">−{f.removed}</em>
              </span>
            </button>
          ))}
        </nav>
        <pre className="md-patch" aria-label={`Diff for ${file?.path}`}>
          {file?.patch.split('\n').map((line, i) => (
            <span
              key={i}
              className={line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : line.startsWith('@@') ? 'hunk' : ''}
            >
              {line || ' '}
              {'\n'}
            </span>
          ))}
        </pre>
      </div>
    </Modal>
  );
}
