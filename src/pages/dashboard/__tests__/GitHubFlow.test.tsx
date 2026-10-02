import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectConnectionModal } from '../monitor/ProjectConnectionModal';
import { monitorApi } from '../monitor/monitorApi';

const backend = { online: true, capabilities: { github: true, gitUrl: false, localBridge: false, agent: false, providerKeys: true, screenControl: false } };
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });

describe('GitHub authorization return', () => {
  it('exchanges the callback once, removes its code, then lists repositories', async () => {
    window.history.replaceState({}, '', '/dashboard?section=monitor&github=connect&code=test-code&state=test-state');
    const complete = vi.spyOn(monitorApi, 'githubComplete').mockResolvedValue({ ok: true, data: { login: 'tester' } });
    vi.spyOn(monitorApi, 'githubRepos').mockResolvedValue({ ok: true, data: [{ id: 1, fullName: 'tester/project', private: true, defaultBranch: 'main', updatedAt: null }] });
    render(<React.StrictMode><ProjectConnectionModal token="test-token" backend={backend} onClose={() => {}} onConnected={() => {}} /></React.StrictMode>);
    expect(await screen.findByText('tester/project')).toBeTruthy();
    expect(complete).toHaveBeenCalledExactlyOnceWith('test-token', 'test-code', 'test-state');
    expect(window.location.search).toBe('?section=monitor');
  });
  it('shows cancelled authorization without starting another redirect', async () => {
    window.history.replaceState({}, '', '/dashboard?section=monitor&github=connect&error=access_denied&state=test-state');
    const start = vi.spyOn(monitorApi, 'githubStart');
    render(<ProjectConnectionModal token="test-token" backend={backend} onClose={() => {}} onConnected={() => {}} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeTruthy();
  });
  it('does not report success when saving the selected repository fails', async () => {
    vi.spyOn(monitorApi, 'githubRepos').mockResolvedValue({ ok: true, data: [{ id: 1, fullName: 'tester/project', private: false, defaultBranch: 'main', updatedAt: null }] });
    vi.spyOn(monitorApi, 'githubBranches').mockResolvedValue({ ok: true, data: ['main'] });
    vi.spyOn(monitorApi, 'connectProject').mockResolvedValue({ ok: false, reason: 'error', message: 'Repository access denied.' });
    const connected = vi.fn();
    render(<ProjectConnectionModal token="test-token" backend={backend} onClose={() => {}} onConnected={connected} />);
    fireEvent.click(await screen.findByText('tester/project'));
    fireEvent.click(screen.getByRole('button', { name: 'Connect', exact: true }));
    await waitFor(() => expect(screen.getByText('Repository access denied.')).toBeTruthy());
    expect(connected).not.toHaveBeenCalled();
  });
});
