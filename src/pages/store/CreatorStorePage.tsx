import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { SetupFlow } from './SetupFlow';
import { Designer } from './Designer';
import './creator-store.css';
import { useAuthStore } from '../../auth-store';
import {
  STORAGE_KEY,
  applyTikTokProfile,
  defaultPersisted,
  ensureProfileFirst,
  loadPersisted,
  makeCode,
  type CreatorStorePersisted,
  type DesignerState,
  type SetupState,
  type TikTokProfile,
} from './store';
import {
  SYNC_INTERVAL_MS,
  canManualSync,
  fetchTikTokProfile,
  getTikTokAuthUrl,
  shouldAutoSync,
} from './tiktok';

type Phase = 'setup' | 'leaving' | 'designer';

export function CreatorStorePage() {
  const [data, setData] = useState<CreatorStorePersisted>(loadPersisted);
  const [phase, setPhase] = useState<Phase>(() =>
    data.setup.step === 6 && data.setup.connected ? 'designer' : 'setup'
  );
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const saveTimer = useRef<number | null>(null);
  const flowTimer = useRef<number | null>(null);

  // Always read the latest state inside timers.
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    document.title = 'Creator Store — Launchly';
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (flowTimer.current) window.clearTimeout(flowTimer.current);
    },
    []
  );

  /** Single commit path: ref mirror updates synchronously so back-to-back
      writes in one handler compose instead of clobbering each other. */
  function commit(next: CreatorStorePersisted) {
    dataRef.current = next;
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* session-only when storage is unavailable */
    }
  }

  function persist(next: CreatorStorePersisted) {
    commit(next);
    setSaveState('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaveState('saved'), 800);
  }

  /** Quiet write for panel-layout state (no save indicator flicker). */
  function persistQuiet(next: CreatorStorePersisted) {
    commit(next);
  }

  function patchUi(patch: Partial<CreatorStorePersisted['ui']>) {
    persistQuiet({ ...dataRef.current, ui: { ...dataRef.current.ui, ...patch } });
  }

  const authUserId = useAuthStore((s) => s.user?.id ?? null);

  // Undo/redo history over designer snapshots (coalesces rapid keystrokes).
  const history = useRef<{ past: DesignerState[]; future: DesignerState[] }>({ past: [], future: [] });
  const lastPush = useRef(0);
  const syncingRef = useRef(false);

  function patchSetup(patch: Partial<SetupState>) {
    persist({ ...data, setup: { ...data.setup, ...patch } });
  }

  function patchDesigner(patch: Partial<DesignerState>) {
    // Permanent lock: no write path may ever leave the profile off the top.
    if (patch.blocks) patch = { ...patch, blocks: ensureProfileFirst(patch.blocks) };
    const prev = dataRef.current.designer;
    const now = Date.now();
    // Structural edits (add / delete / reorder sections) always get their own
    // history entry so undo/redo works per action. Typing coalesces as before.
    const structural =
      patch.blocks !== undefined &&
      (patch.blocks.length !== prev.blocks.length ||
        patch.blocks.map((b) => b.id).join('|') !== prev.blocks.map((b) => b.id).join('|'));
    if (structural || now - lastPush.current > 1200 || history.current.past.length === 0) {
      history.current.past.push(prev);
      if (history.current.past.length > 40) history.current.past.shift();
      lastPush.current = now;
    }
    history.current.future = [];
    persist({ ...dataRef.current, designer: { ...prev, ...patch } });
  }

  function undo() {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(dataRef.current.designer);
    lastPush.current = 0;
    persist({ ...dataRef.current, designer: { ...prev, blocks: ensureProfileFirst(prev.blocks) } });
  }

  function redo() {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(dataRef.current.designer);
    lastPush.current = 0;
    persist({ ...dataRef.current, designer: { ...next, blocks: ensureProfileFirst(next.blocks) } });
  }

  function next() {
    const { step, username } = data.setup;
    if (step === 1) {
      if (username.trim().length < 2) return;
      const patch: Partial<DesignerState> = {};
      if (!data.designer.displayName || data.designer.displayName === 'Your Studio') {
        patch.displayName = `@${username.trim().replace(/^@+/, '')}`;
      }
      const nextData: CreatorStorePersisted = {
        ...data,
        designer: { ...data.designer, ...patch },
        setup: { ...data.setup, step: 2, code: data.setup.code || makeCode() },
      };
      persist(nextData);
    } else if (step < 5) {
      persist({ ...data, setup: { ...data.setup, step: (step + 1) as SetupState['step'] } });
    }
  }

  function back() {
    const { step } = data.setup;
    if (step > 1 && step < 6) patchSetup({ step: (step - 1) as SetupState['step'] });
  }

  /**
   * Apply a TikTok profile to the editor + published store. Only real
   * values win — failures keep the last good profile (never placeholders).
   */
  const applySyncProfile = useCallback((profile: TikTokProfile, nowIso: string) => {
    const latest = dataRef.current;
    const designer = applyTikTokProfile(latest.designer, profile);
    const usernameChanged = profile.username && profile.username !== latest.setup.username;
    persist({
      ...latest,
      designer,
      setup: usernameChanged ? { ...latest.setup, username: profile.username } : latest.setup,
      tiktok: {
        connected: true,
        openId: profile.openId,
        profile,
        lastSyncAt: nowIso,
        syncing: false,
        syncError: null,
      },
    });
  }, []);

  /**
   * Sync TikTok identity: backend Display API when configured, otherwise a
   * local auto-import from the connected username so the store still mirrors
   * the connected account. Never wipes real identity on failure.
   */
  const syncTikTok = useCallback(
    async (manual = false) => {
      const latest = dataRef.current;
      if (!latest.setup.connected || latest.setup.step !== 6) return;
      if (syncingRef.current) return;
      if (manual && !canManualSync(latest.tiktok.lastSyncAt)) return;
      syncingRef.current = true;
      persistQuiet({
        ...latest,
        tiktok: { ...latest.tiktok, syncing: true, syncError: null },
      });
      const userKey = authUserId ?? `local:${latest.setup.username}`;
      try {
        const result = await fetchTikTokProfile(userKey);
        const nowIso = new Date().toISOString();
        if (result.ok && result.profile) {
          applySyncProfile(result.profile, nowIso);
        } else if (result.profile) {
          // Stale backend profile — still fresher than nothing. Merge it,
          // keep last success time, surface the warning.
          const cur = dataRef.current;
          const designer = applyTikTokProfile(cur.designer, result.profile);
          persist({
            ...cur,
            designer,
            tiktok: {
              connected: true,
              openId: result.profile.openId || cur.tiktok.openId,
              profile: result.profile,
              lastSyncAt: cur.tiktok.lastSyncAt,
              syncing: false,
              syncError: result.error,
            },
          });
        } else if (!result.configured) {
          // Backend not configured yet: mirror the connected TikTok account
          // locally (stable local open_id per username) — no placeholders.
          const cur = dataRef.current;
          const username = cur.setup.username.replace(/^@+/, '');
          const openId = cur.tiktok.openId ?? `local:${username.toLowerCase()}`;
          const local: TikTokProfile = {
            openId,
            username,
            displayName: cur.designer.displayName || (username ? `@${username}` : ''),
            avatar: cur.designer.avatar,
            bio: cur.designer.bio,
          };
          persist({
            ...cur,
            tiktok: {
              connected: true,
              openId,
              profile: local,
              lastSyncAt: cur.tiktok.lastSyncAt ?? nowIso,
              syncing: false,
              syncError: 'TikTok API not configured yet — showing connected account',
            },
          });
        } else {
          const cur = dataRef.current;
          persistQuiet({
            ...cur,
            tiktok: { ...cur.tiktok, syncing: false, syncError: result.error },
          });
        }
      } finally {
        syncingRef.current = false;
        const cur = dataRef.current;
        if (cur.tiktok.syncing) {
          persistQuiet({ ...cur, tiktok: { ...cur.tiktok, syncing: false } });
        }
      }
    },
    [applySyncProfile, authUserId]
  );

  const syncNow = useCallback(() => {
    void syncTikTok(true);
  }, [syncTikTok]);

  /** Start TikTok Login Kit OAuth; falls back to code verify when unconfigured. */
  const connectWithTikTok = useCallback(async () => {
    const userKey = authUserId ?? `local:${dataRef.current.setup.username || 'pending'}`;
    const { url } = await getTikTokAuthUrl(userKey);
    if (url) window.location.href = url;
    return !!url;
  }, [authUserId]);

  // Handle OAuth return (?store=connected) without a reconnect dance.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('store') === 'connected' && dataRef.current.setup.connected) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
        void syncTikTok(true);
      }
    } catch {
      /* non-browser / test env */
    }
  }, [syncTikTok, phase]);

  // Refresh on editor open + every 15 minutes in the background.
  useEffect(() => {
    if (phase !== 'designer') return;
    const latest = dataRef.current;
    if (latest.setup.connected && shouldAutoSync(latest.tiktok.lastSyncAt)) {
      void syncTikTok(false);
    }
    const timer = window.setInterval(() => {
      const cur = dataRef.current;
      if (cur.setup.connected && shouldAutoSync(cur.tiktok.lastSyncAt)) {
        void syncTikTok(false);
      }
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [phase, syncTikTok]);

  function verify() {
    if (data.setup.verifying) return;
    patchSetup({ verifying: true });
    flowTimer.current = window.setTimeout(() => {
      const latest = dataRef.current;
      const username = latest.setup.username.replace(/^@+/, '');
      // Automatic TikTok profile import on connect — real account becomes
      // the store identity immediately (stable local open_id until OAuth
      // links the official open_id).
      const openId = latest.tiktok.openId ?? `local:${username.toLowerCase()}`;
      const imported: TikTokProfile = {
        openId,
        username,
        displayName: latest.designer.displayName || (username ? `@${username}` : ''),
        avatar: latest.designer.avatar,
        bio: latest.designer.bio,
      };
      const designer = applyTikTokProfile(latest.designer, imported);
      persist({
        ...latest,
        designer,
        setup: { ...latest.setup, verifying: false, connected: true, step: 5 },
        tiktok: {
          connected: true,
          openId,
          profile: imported,
          lastSyncAt: latest.tiktok.lastSyncAt ?? new Date().toISOString(),
          syncing: false,
          syncError: latest.tiktok.syncError,
        },
      });
      flowTimer.current = window.setTimeout(() => enterDesigner(), 2000);
      // Then try a live Display API refresh (no-op until backend configured).
      window.setTimeout(() => void syncTikTok(false), 2500);
    }, 1600);
  }

  // Always persist from the latest state inside timers.
  function enterDesigner() {
    setPhase('leaving');
    flowTimer.current = window.setTimeout(() => {
      persist({ ...dataRef.current, setup: { ...dataRef.current.setup, step: 6 } });
      setPhase('designer');
    }, 420);
  }

  /** Switch account: back to setup, designer content is kept, TikTok link cleared. */
  function disconnect() {
    if (flowTimer.current) window.clearTimeout(flowTimer.current);
    const latest = dataRef.current;
    persist({
      ...latest,
      setup: { step: 1, username: '', code: '', verifying: false, connected: false },
      tiktok: {
        connected: false,
        openId: null,
        profile: latest.tiktok.profile,
        lastSyncAt: latest.tiktok.lastSyncAt,
        syncing: false,
        syncError: null,
      },
    });
    setPhase('setup');
  }

  function publish() {
    persist({ ...data, publishedAt: new Date().toISOString() });
  }

  const inSetup = phase === 'setup' || phase === 'leaving';
  const progressStep = phase === 'leaving' ? 6 : data.setup.step;

  return (
    <div className="cs-page">
      <div className="cs-orbs" aria-hidden="true">
        <i className="cs-orb cs-orb--a" />
        <i className="cs-orb cs-orb--b" />
        <i className="cs-orb cs-orb--c" />
      </div>
      {inSetup && (
        <div className={`cs-setup${phase === 'leaving' ? ' is-leaving' : ''}`}>
          <ProgressBar step={progressStep} />
          <div className="cs-setup__body">
            {data.setup.step < 6 && (
              <SetupFlow
                setup={data.setup}
                onPatch={patchSetup}
                onNext={next}
                onBack={back}
                onVerify={verify}
                onRegenerate={() => patchSetup({ code: makeCode() })}
                onConnectTikTok={connectWithTikTok}
              />
            )}
          </div>
        </div>
      )}
      {phase === 'designer' && (
        <Designer
          designer={data.designer}
          username={data.setup.username}
          saveState={saveState}
          publishedAt={data.publishedAt}
          ui={data.ui}
          tiktok={data.tiktok}
          onPatch={patchDesigner}
          onPatchUi={patchUi}
          onPublish={publish}
          onDisconnect={disconnect}
          onUndo={undo}
          onRedo={redo}
          onSyncNow={syncNow}
          canUndo={history.current.past.length > 0}
          canRedo={history.current.future.length > 0}
        />
      )}
    </div>
  );
}
