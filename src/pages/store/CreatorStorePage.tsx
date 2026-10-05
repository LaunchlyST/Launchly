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

  function persist(next: CreatorStorePersisted) {
    setData(next);
    setSaveState('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* session-only when storage is unavailable */
      }
      setSaveState('saved');
    }, 800);
  }

  function patchSetup(patch: Partial<SetupState>) {
    persist({ ...data, setup: { ...data.setup, ...patch } });
  }

  function patchDesigner(patch: Partial<DesignerState>) {
    persist({ ...data, designer: { ...data.designer, ...patch } });
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
  const dataRef = useRef(data);
  dataRef.current = data;

  function enterDesigner() {
    setPhase('leaving');
    flowTimer.current = window.setTimeout(() => {
      persist({ ...dataRef.current, setup: { ...dataRef.current.setup, step: 6 } });
      setPhase('designer');
    }, 420);
  }

  function publish() {
    persist({ ...data, publishedAt: new Date().toISOString() });
  }

  const inSetup = phase === 'setup' || phase === 'leaving';
  const progressStep = phase === 'leaving' ? 6 : data.setup.step;

  return (
    <div className="cs-page">
      {inSetup && (
        <div className={`cs-setupwrap${phase === 'leaving' ? ' is-leaving' : ''}`}>
          <ProgressBar step={progressStep} />
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
      )}
      {phase === 'designer' && (
        <Designer
          designer={data.designer}
          username={data.setup.username}
          saveState={saveState}
          publishedAt={data.publishedAt}
          onPatch={patchDesigner}
          onPublish={publish}
        />
      )}
    </div>
  );
}
