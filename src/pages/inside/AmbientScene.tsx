import { LakeScene } from '../paywall/LakeScene';
import { useStore } from '../../store';
import './ambient.css';

/**
 * After the unlock, the arrival scene stays on as the editor's ambient
 * background — 18% opacity, blurred 40px, so it never competes with the UI.
 * Switchable off in Settings.
 */
export function AmbientScene() {
  const enabled = useStore((s) => s.ambientScene);
  if (!enabled) return null;

  return (
    <div className="ambient" aria-hidden="true">
      <LakeScene active={false} />
    </div>
  );
}
