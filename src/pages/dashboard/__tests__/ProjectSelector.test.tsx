import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProjectSelector } from '../monitor/ProjectSelector';
import type { ConnectedProject } from '../monitor/types';
afterEach(cleanup);
const projects: ConnectedProject[] = [
  { id: '1', name: 'Test website', repository: 'test/website', source: 'github', branch: 'release', status: 'synced' },
  { id: '2', name: 'Test tool', repository: 'tool', source: 'local', branch: 'dev', status: 'synced' },
];
describe('Project picker', () => {
  it('searches backend projects, selects without opening setup, and reopens', () => {
    const select = vi.fn(); const setup = vi.fn(); const refresh = vi.fn();
    const props = { projects, loading: false, error: '', permission: null, onRestorePermission: vi.fn(), onSelect: select, onConnect: setup, onRefresh: refresh };
    const view = render(<ProjectSelector {...props} project={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect project' }));
    expect(refresh).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'release' } });
    expect(screen.queryByText('Test tool')).toBeNull();
    fireEvent.click(screen.getByText('Test website'));
    expect(select).toHaveBeenCalledWith(projects[0]);
    expect(setup).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<ProjectSelector {...props} project={projects[0]} />);
    fireEvent.click(screen.getByRole('button', { name: /Test website/ }));
    expect(screen.getByText('Test tool')).toBeTruthy();
    fireEvent.click(screen.getByText('Connect another project'));
    expect(setup).toHaveBeenCalledOnce();
  });
  it('keeps failures distinct from an empty project list and closes with Escape', () => {
    render(<ProjectSelector project={null} projects={[]} loading={false} error="Service unavailable" permission={null} onRestorePermission={vi.fn()} onSelect={vi.fn()} onConnect={vi.fn()} onRefresh={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Connect project' });
    fireEvent.click(trigger);
    expect(screen.getByRole('alert').textContent).toContain('Service unavailable');
    expect(screen.queryByText('No projects yet')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
