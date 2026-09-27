import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../../auth-store';
import { monitorApi } from './monitorApi';
import {
  DEFAULT_PERMISSIONS,
  type ConnectedProject,
  type ModelInfo,
  type ModelSelection,
  type MonitorBackendStatus,
  type MonitorPermissions,
  type ProviderConnection,
  type ProviderId,
} from './types';

const PREFS_KEY = 'launchly.monitor.prefs';

/** Non-secret preferences only (model choice + permissions). Keys never touch browser storage. */
function loadPrefs(): { selection: ModelSelection; permissions: MonitorPermissions } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (p?.selection && p?.permissions) return { selection: p.selection, permissions: { ...DEFAULT_PERMISSIONS, ...p.permissions } };
  } catch {
    /* ignore */
  }
  return { selection: { mode: 'auto' }, permissions: DEFAULT_PERMISSIONS };
}

export function useMonitorWorkspace() {
  const token = useAuthStore((s) => s.session?.access_token ?? null);
  const [backend, setBackend] = useState<MonitorBackendStatus | null>(null);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [latest, setLatest] = useState<Partial<Record<ProviderId, string | null>>>({});
  const [project, setProject] = useState<ConnectedProject | null>(null);
  const [projects, setProjects] = useState<ConnectedProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const projectRequest = useRef(0);
  const refreshProjects = useCallback(async () => {
    const request = ++projectRequest.current;
    if (!token) { setProjects([]); setProject(null); setProjectsError(''); setProjectsLoading(false); return; }
    setProjectsLoading(true);
    setProjectsError('');
    const result = await monitorApi.projects(token);
    if (request !== projectRequest.current) return;
    setProjectsLoading(false);
    if (!result.ok || !Array.isArray(result.data)) {
      setProjectsError(result.message || 'Could not load saved projects.');
      setProjects([]);
      setProject(null);
      return;
    }
    const saved = result.data.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.branch === 'string' && typeof p.repository === 'string' && ['github', 'local', 'git-url'].includes(p.source) && ['synced', 'syncing', 'error'].includes(p.status));
    setProjects(saved);
    setProject(current => saved.find(p => p.id === current?.id) || null);
  }, [token]);
  useEffect(() => {
    setProject(null); setProjects([]);
    refreshProjects();
    return () => { ++projectRequest.current; };
  }, [refreshProjects]);
  const [{ selection, permissions }, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ selection, permissions }));
    } catch {
      /* ignore */
    }
  }, [selection, permissions]);

  const refresh = useCallback(async () => {
    const s = await monitorApi.status(token);
    const status = s.ok && s.data && typeof s.data.online === 'boolean' ? s.data : null;
    setBackend(status);
    if (!status) return;
    const [p, m] = await Promise.all([monitorApi.providers(token), monitorApi.models(token)]);
    if (p.ok && Array.isArray(p.data)) setProviders(p.data);
    if (m.ok && m.data) {
      setModels(Array.isArray(m.data.models) ? m.data.models : []);
      setLatest(m.data.latest && typeof m.data.latest === 'object' ? m.data.latest : {});
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    token,
    backend,
    online: !!backend?.online,
    providers,
    models,
    latest,
    project,
    setProject,
    projects,
    projectsLoading,
    projectsError,
    refreshProjects,
    rememberProject: (p: ConnectedProject) => {
      // Only called after the authenticated connection endpoint succeeds.
      setProject(p);
      setProjects(items => [p, ...items.filter(item => item.id !== p.id)]);
    },
    selection,
    setSelection: (s: ModelSelection) => setPrefs((p) => ({ ...p, selection: s })),
    permissions,
    setPermissions: (perm: MonitorPermissions) => setPrefs((p) => ({ ...p, permissions: perm })),
    refresh,
  };
}

export type MonitorWorkspace = ReturnType<typeof useMonitorWorkspace>;
