import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../../auth-store';
import { monitorApi } from './monitorApi';
import { checkLocalPermission, listLocalProjects, type LocalPermission } from './localProjects';
import {
  DEFAULT_PERMISSIONS,
  type ConnectedProject,
  type ConnectionState,
  type ProviderFailure,
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
  const [providerState, setProviderState] = useState<ConnectionState>('disconnected');
  const [providerMessage, setProviderMessage] = useState('');
  const providerRequest = useRef(0);
  const refreshRequest = useRef(0);
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

  const [device, setDevice] = useState<import('./monitorApi').DeviceStatus>({ paired: false, online: false, name: null });

  const refreshDevice = useCallback(async () => {
    const d = await monitorApi.deviceStatus(token);
    if (d.ok && d.data) setDevice(d.data);
  }, [token]);

  /** Official provider CLIs on the user's own computer (credentials never leave it). */
  const [localCli, setLocalCli] = useState<import('./monitorApi').LocalCliStatus | null>(null);
  const [localCliLoading, setLocalCliLoading] = useState(false);
  const refreshLocalCli = useCallback(async () => {
    if (!token) return;
    setLocalCliLoading(true);
    try {
      const r = await monitorApi.deviceSubscription(token);
      if (r.ok && r.data && typeof r.data === 'object' && 'claude' in r.data) setLocalCli(r.data as import('./monitorApi').LocalCliStatus);
    } finally {
      setLocalCliLoading(false);
    }
  }, [token]);

  const selectedProvider = selection.mode === 'auto' ? null : selection.provider;
  const selectedProviderRef = useRef(selectedProvider);
  selectedProviderRef.current = selectedProvider;

  const refresh = useCallback(async () => {
    const request = ++refreshRequest.current;
    const verification = providerRequest.current;
    const [s, p, m] = await Promise.all([monitorApi.status(token), monitorApi.providers(token), monitorApi.models(token)]);
    if (request !== refreshRequest.current) return;
    setBackend(s.ok && s.data && typeof s.data.online === 'boolean' ? s.data : null);
    const incoming = p.ok && Array.isArray(p.data) ? p.data : [];
    if (verification === providerRequest.current) {
      setProviders(incoming);
      if (selectedProviderRef.current) {
        const current = incoming.find(p => p.provider === selectedProviderRef.current);
        setProviderState(current?.state ?? 'disconnected');
        setProviderMessage(current?.message ?? '');
      }
    } else {
      // An older catalogue fetch must not overwrite a just-verified connection.
      setProviders(current => [...incoming.filter(p => p.provider !== selectedProviderRef.current), ...current.filter(p => p.provider === selectedProviderRef.current)]);
    }
    setModels(m.ok && Array.isArray(m.data?.models) ? m.data.models : []);
    setLatest(m.ok && m.data?.latest ? m.data.latest : {});
    if (s.ok && s.data?.capabilities.agent) void refreshDevice();
  }, [token, refreshDevice]);

  useEffect(() => {
    setProviders([]);
    setProviderState('disconnected');
    setProviderMessage('');
    setDevice({ paired: false, online: false, name: null });
    void refresh();
    return () => { ++refreshRequest.current; ++providerRequest.current; };
  }, [refresh]);

  const verifyProvider = useCallback(async (provider: ProviderId) => {
    const request = ++providerRequest.current;
    setProviderState('connecting');
    setProviderMessage('');
    const result = await monitorApi.verifyProvider(token, provider);
    if (request !== providerRequest.current) return false;
    const connection = result.ok ? result.data : null;
    const valid = connection?.provider === provider && connection.connected && connection.state === 'connected';
    if (connection) setProviders(items => [...items.filter(p => p.provider !== provider), connection]);
    setProviderState(valid ? 'connected' : connection?.state === 'limited' || result.failure?.code === 'PROVIDER_LIMITED' ? 'limited' : 'error');
    setProviderMessage(valid ? '' : connection?.message ?? result.message ?? 'This AI connection could not be verified.');
    return !!valid;
  }, [token]);

  const isLocalMode = selection.mode === 'local';
  const localCliKey = selection.mode === 'local' ? selection.provider : null;

  useEffect(() => {
    if (isLocalMode) return; // local CLI state is derived below, never API-verified
    if (token && selectedProvider) void verifyProvider(selectedProvider);
    else { ++providerRequest.current; setProviderState('disconnected'); setProviderMessage(''); }
  }, [token, selectedProvider, verifyProvider, isLocalMode]);

  // Local-subscription state: live CLI authentication on the user's own computer.
  useEffect(() => {
    if (!isLocalMode || !localCliKey) return;
    ++providerRequest.current;
    const key = localCliKey === 'openai' ? 'codex' : 'claude';
    const cliName = localCliKey === 'openai' ? 'Codex CLI' : 'Claude Code';
    const loginCmd = localCliKey === 'openai' ? 'codex login' : 'claude auth login';
    if (!device.online) {
      setProviderState('disconnected');
      setProviderMessage('Connect this computer so the local CLI can be reached.');
      return;
    }
    if (!localCli) {
      setProviderState('connecting');
      setProviderMessage('');
      return;
    }
    const cli = localCli[key];
    if (cli.authenticated) {
      setProviderState('connected');
      setProviderMessage('');
    } else if (cli.installed) {
      setProviderState('error');
      setProviderMessage(`Run \`${loginCmd}\` on your computer to connect your subscription, then refresh.`);
    } else {
      setProviderState('disconnected');
      setProviderMessage(`Install ${cliName} on your computer and log in with your subscription. API key remains available.`);
    }
  }, [isLocalMode, localCliKey, localCli, device.online]);

  useEffect(() => {
    if (device.online && (isLocalMode || !localCli)) void refreshLocalCli();
  }, [device.online, isLocalMode, refreshLocalCli]);

  const selectProvider = async (provider: ProviderId) => {
    // Changing selection triggers verification; reselecting must verify again too.
    if (selectedProvider === provider) await verifyProvider(provider);
    else { setProviderState('connecting'); setProviderMessage(''); setPrefs(p => ({ ...p, selection: { mode: 'latest', provider } })); }
  };

  const reportProviderFailure = (failure: ProviderFailure) => {
    if (failure.provider && failure.provider !== selectedProvider) return;
    ++providerRequest.current;
    setProviderState(failure.code === 'PROVIDER_LIMITED' ? 'limited' : 'error');
    setProviderMessage(failure.message);
  };

  // The agent's WebSocket can drop at any moment, so poll rather than trust a one-time check.
  useEffect(() => {
    if (!device.paired) return;
    const id = setInterval(refreshDevice, 8000);
    return () => clearInterval(id);
  }, [device.paired, refreshDevice]);

  return {
    token,
    backend,
    online: !!backend?.online,
    providers,
    providerState,
    providerMessage,
    selectProvider,
    verifyProvider,
    reportProviderFailure,
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
    device,
    refreshDevice,
    refresh,
    localCli,
    localCliLoading,
    refreshLocalCli,
  };
}

export type MonitorWorkspace = ReturnType<typeof useMonitorWorkspace>;
