import { useCallback, useEffect, useState } from 'react';
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
    setBackend(s.ok ? s.data : null);
    if (!s.ok) return;
    const [p, m] = await Promise.all([monitorApi.providers(token), monitorApi.models(token)]);
    if (p.ok) setProviders(p.data);
    if (m.ok) {
      setModels(m.data.models);
      setLatest(m.data.latest);
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
    selection,
    setSelection: (s: ModelSelection) => setPrefs((p) => ({ ...p, selection: s })),
    permissions,
    setPermissions: (perm: MonitorPermissions) => setPrefs((p) => ({ ...p, permissions: perm })),
    refresh,
  };
}

export type MonitorWorkspace = ReturnType<typeof useMonitorWorkspace>;
