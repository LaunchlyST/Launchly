import React from 'react';
import { Modal } from './Modal';
import type { MonitorPermissions as Perms } from './types';

const CORE: [keyof Perms, string][] = [
  ['readFiles', 'Read project files'],
  ['searchFiles', 'Search project files'],
  ['editFiles', 'Edit files'],
  ['createFiles', 'Create files'],
  ['runDevCommands', 'Run development commands'],
];
const SCREEN: [keyof Perms, string][] = [
  ['viewScreen', 'Let the AI see my screen'],
  ['controlMouse', 'Let the AI move and click the mouse'],
  ['controlKeyboard', 'Let the AI type and press keys'],
];
const OPTIONAL: [keyof Perms, string][] = [
  ['installPackages', 'Install packages automatically'],
  ['autoCommit', 'Commit automatically'],
  ['autoPush', 'Push changes automatically'],
  ['autoDeploy', 'Deploy automatically'],
];

export function MonitorPermissions({ value, onChange, onClose }: { value: Perms; onChange: (p: Perms) => void; onClose: () => void }) {
  const toggle = (k: keyof Perms) => onChange({ ...value, [k]: !value[k] });
  const Row = ([k, label]: [keyof Perms, string]) => (
    <label key={k} className="mm-check">
      <input type="checkbox" checked={!!value[k]} onChange={() => toggle(k)} />
      {label}
    </label>
  );
  return (
    <Modal title="Monitor permissions" onClose={onClose} width={400}>
      <p className="mm-group">Project access</p>
      {CORE.map(Row)}
      <p className="mm-group">Screen control</p>
      {SCREEN.map(Row)}
      <p className="mm-note mm-note--muted">The agent only runs approved capabilities. Destructive actions pause for your approval unless editing mode is automatic.</p>
      <p className="mm-group">Optional</p>
      {OPTIONAL.map(Row)}
      {value.autoPush && <p className="mm-note mm-note--muted">Pushes go to a Monitor branch — never straight to main.</p>}
      <p className="mm-group">Editing mode</p>
      {(['ask', 'auto'] as const).map((m) => (
        <label key={m} className="mm-check">
          <input type="radio" name="edit-mode" checked={value.editMode === m} onChange={() => onChange({ ...value, editMode: m })} />
          {m === 'ask' ? 'Ask before applying' : 'Apply automatically'}
        </label>
      ))}
    </Modal>
  );
}
