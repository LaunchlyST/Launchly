import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../../auth-store';
import { monitorApi } from './monitorApi';
import { checkLocalPermission, listLocalProjects, type LocalPermission } from './localProjects';
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
const SELECTED_KEY = 'launchly.monitor.selectedProjectId';

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
  const [project, setProjectState] = useState<ConnectedProject | null>(null);
  const [projects, setProjects] = useState<ConnectedProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [projectPermission, setProjectPermission] = useState<LocalPermission | null>(null);
  const projectRequest = useRef(0);

  const setProject = useCallback((p: ConnectedProject | null) => {
    setProjectState(p);
    try {
      if (p) localStorage.setItem(SELECTED_KEY, p.id);
      else localStorage.removeItem(SELECTED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    const request = ++projectRequest.current;
    setProjectsLoading(true);
    setProjectsError('');
    const [remote, local] = await Promise.all([
      token ? monitorApi.projects(token) : Promise.resolve({ ok: false as const, message: '' }),
      listLocalProjects(),
    ]);
    if (request !== projectRequest.current) return;
    setProjectsLoading(false);
    let saved: ConnectedProject[] = [];
    if (remote.ok && Array.isArray((remote as any).data)) {
      saved = (remote as any).data.filter((p: any) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.branch === 'string' && typeof p.repository === 'string' && ['github', 'local', 'git-url'].includes(p.source) && ['synced', 'syncing', 'error'].includes(p.status));
    } else if (token && (remote as any).message) {
      // A remote failure never hides projects connected straight from the browser.
      setProjectsError((remote as any).message);
    }
    const merged = [...local, ...saved.filter((p) => !local.some((l) => l.id === p.id))];
    setProjects(merged);
    setProjectState((current) => {
      if (current) return merged.find((p) => p.id === current.id) || current;
      try {
        const rememberedId = localStorage.getItem(SELECTED_KEY);
        return (rememberedId && merged.find((p) => p.id === rememberedId)) || null;
      } catch {
        return null;
      }
    });
  }, [token]);

  useEffect(() => {
    refreshProjects();
    return () => {
      ++projectRequest.current;
    };
  }, [refreshProjects]);

  // Track whether we still have real filesystem access to the selected local folder.
  useEffect(() => {
    if (!project || project.source !== 'local') {
      setProjectPermission(null);
      return;
    }
    let cancelled = false;
    setProjectPermission(null);
    checkLocalPermission(project.id).then((p) => !cancelled && setProjectPermission(p));
    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.source]);
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
    projectPermission,
    setProjectPermission,
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
