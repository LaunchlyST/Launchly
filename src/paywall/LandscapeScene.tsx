import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { LANDSCAPE_IMAGE, LANDSCAPE_VIDEO, probeImage } from './landscape';
import './landscape-scene.css';

interface LandscapeSceneProps {
  /** 0..1 scroll progress. Drives the dolly through the scene. */
  progress: number;
  /** 0..1 entry progress. 0 = furthest out, 1 = settled. */
  entry: number;
}

/**
 * The landscape behind the offer.
 *
 * One asset fills the viewport. Camera movement is a scale + vertical drift
 * applied to the whole frame, which is the only motion a still photograph
 * tolerates without visible warping. Clouds and light are separate translucent
 * layers over the top, so the photograph itself is never distorted.
 *
 * Reversing the scroll reverses the move exactly: everything is derived from
 * `progress`, never accumulated.
 */
export function LandscapeScene({ progress, entry }: LandscapeSceneProps) {
  const reduce = useReducedMotion();
  const [hasImage, setHasImage] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    probeImage(LANDSCAPE_IMAGE).then((ok) => live && setHasImage(ok));
    return () => {
      live = false;
    };
  }, []);

  // Entry dollies in from 1.14 → 1.04; scroll then pushes to 1.14 again.
  const entryScale = 1.14 - entry * 0.1;
  const scrollScale = reduce ? 1.04 : entryScale + progress * 0.1;
  const drift = reduce ? 0 : progress * -5;

  const frameStyle = {
    transform: `scale(${scrollScale}) translate3d(0, ${drift}%, 0)`,
  };

  return (
    <div className="ls" aria-hidden="true">
      <div className="ls__frame" style={frameStyle}>
        {LANDSCAPE_VIDEO ? (
          <video
            className="ls__media"
            src={LANDSCAPE_VIDEO}
            poster={hasImage ? LANDSCAPE_IMAGE : undefined}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : hasImage ? (
          <img className="ls__media" src={LANDSCAPE_IMAGE} alt="" decoding="async" />
        ) : (
          /* No asset supplied: a plain graded sky, deliberately empty rather
             than a stand-in landscape. */
          <div className="ls__empty" />
        )}
      </div>

      {/* Cloud sheets: two very slow drifts, opacity only, never scaling the
          photograph itself. */}
      {!reduce && (
        <>
          <div className="ls__clouds ls__clouds--far" />
          <div className="ls__clouds ls__clouds--near" />
        </>
      )}

      {/* Sunlight warms slightly as the camera moves in. */}
      <div className="ls__light" style={{ opacity: 0.32 + progress * 0.22 }} />

      {/* Just enough grade to hold text contrast — the scene stays visible. */}
      <div className="ls__grade" />
      <div className="ls__vignette" />
    </div>
  );
}
