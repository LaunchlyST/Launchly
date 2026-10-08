import { useEffect, useRef, useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { SetupFlow } from './SetupFlow';
import { Designer } from './Designer';
import './creator-store.css';
import {
  STORAGE_KEY,
  defaultPersisted,
  loadPersisted,
  makeCode,
  type CreatorStorePersisted,
  type DesignerState,
  type SetupState,
} from './store';

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

  // Undo/redo history over designer snapshots (coalesces rapid keystrokes).
  const history = useRef<{ past: DesignerState[]; future: DesignerState[] }>({ past: [], future: [] });
  const lastPush = useRef(0);

  function patchSetup(patch: Partial<SetupState>) {
    persist({ ...data, setup: { ...data.setup, ...patch } });
  }

  function patchDesigner(patch: Partial<DesignerState>) {
    const prev = dataRef.current.designer;
    const now = Date.now();
    if (now - lastPush.current > 1200 || history.current.past.length === 0) {
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
    persist({ ...dataRef.current, designer: prev });
  }

  function redo() {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(dataRef.current.designer);
    lastPush.current = 0;
    persist({ ...dataRef.current, designer: next });
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

  function verify() {
    if (data.setup.verifying) return;
    patchSetup({ verifying: true });
    flowTimer.current = window.setTimeout(() => {
      const latest = dataRef.current;
      persist({
        ...latest,
        setup: { ...latest.setup, verifying: false, connected: true, step: 5 },
      });
      flowTimer.current = window.setTimeout(() => enterDesigner(), 2000);
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

  /** Switch account: back to setup, designer content is kept. */
  function disconnect() {
    if (flowTimer.current) window.clearTimeout(flowTimer.current);
    persist({
      ...dataRef.current,
      setup: { step: 1, username: '', code: '', verifying: false, connected: false },
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
          onPatch={patchDesigner}
          onPatchUi={patchUi}
          onPublish={publish}
          onDisconnect={disconnect}
          onUndo={undo}
          onRedo={redo}
          canUndo={history.current.past.length > 0}
          canRedo={history.current.future.length > 0}
        />
      )}
    </div>
  );
}
