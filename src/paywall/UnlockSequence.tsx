import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LakeScene } from './LakeScene';
import { EditorBackdrop } from './EditorBackdrop';
import { FilmGrain } from './FilmGrain';
import './unlock.css';

export type UnlockPhase = 'idle' | 'release' | 'push' | 'arrival' | 'settle' | 'done';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Milliseconds from the start of the sequence. Total stays under 2.8s. */
export const PHASE_AT: Record<Exclude<UnlockPhase, 'idle'>, number> = {
  release: 0,
  push: 500,
  arrival: 1200,
  settle: 2100,
  done: 2800,
};

const ORDER: UnlockPhase[] = ['idle', 'release', 'push', 'arrival', 'settle', 'done'];
const at = (phase: UnlockPhase, min: UnlockPhase) =>
  ORDER.indexOf(phase) >= ORDER.indexOf(min);

/**
 * Phases 2–4 of the unlock. Phase 1 (release) is drawn by the paywall itself,
 * since it is the paywall's own content falling away.
 */
export function UnlockSequence({ phase }: { phase: UnlockPhase }) {
  const reduce = useReducedMotion();

  // Phase 1 belongs to the paywall; this overlay only exists from the push in.
  if (phase === 'idle' || phase === 'release') return null;

  // Reduced motion: no camera move, no flash. Straight to the settled room.
  if (reduce) {
    return (
      <motion.div
        className="uk"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'linear' }}
      >
        <div className="uk__ambient">
          <LakeScene active={false} />
        </div>
        <div className="uk__editor">
          <EditorBackdrop />
        </div>
        <FilmGrain className="pw__grain" />
      </motion.div>
    );
  }

  const pushing = at(phase, 'push');
  const arriving = at(phase, 'arrival');
  const settling = at(phase, 'settle');

  return (
    <div className="uk">
      {/* Phase 2 — push in. The room flies past the camera; a slight rotation
          and an outer lens warp keep it feeling like glass, not a CSS zoom. */}
      {!settling && (
        <motion.div
          className="uk__push"
          initial={{ scale: 1, rotate: 0, opacity: 1, filter: 'blur(8px)' }}
          animate={
            pushing
              ? { scale: 7, rotate: 1.2, opacity: 0, filter: 'blur(46px)' }
              : {}
          }
          transition={{ duration: 0.9, ease: EASE }}
        >
          <div className="uk__push-warp">
            <EditorBackdrop variant="behind" />
          </div>
        </motion.div>
      )}

      {/* Phase 3 — arrival. The landscape comes in from far away. */}
      {arriving && (
        <motion.div
          className={`uk__scene ${settling ? 'is-settled' : ''}`}
          initial={{ scale: 1.18, opacity: 0 }}
          animate={
            settling
              ? { scale: 1, opacity: 1, filter: 'blur(40px) saturate(0.35)' }
              : { scale: 1, opacity: 1 }
          }
          transition={{
            duration: settling ? 0.7 : 0.9,
            ease: EASE,
          }}
        >
          <LakeScene active />
        </motion.div>
      )}

      {/* A single frame of white-amber bloom between the two. A flash, not a
          strobe: 80ms, 40% at its peak. */}
      <AnimatePresence>
        {phase === 'arrival' && (
          <motion.div
            key="bloom"
            className="uk__bloom"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08, times: [0, 0.5, 1], ease: 'linear' }}
          />
        )}
      </AnimatePresence>

      {/* Phase 4 — settle. The editor rises into place, panel by panel. */}
      {settling && (
        <motion.div
          className="uk__editor"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <motion.div
            className="uk__editor-inner"
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE, staggerChildren: 0.04 }}
          >
            <EditorBackdrop />
          </motion.div>
        </motion.div>
      )}

      <FilmGrain className="pw__grain" />
    </div>
  );
}
