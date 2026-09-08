import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './premium-scene.css';

interface PremiumSceneProps {
  /** 0..1 scroll progress of the paywall column, drives parallax depth. */
  progress: number;
  /** Pointer offset in -1..1, drives the gentle camera lean. */
  lean: { x: number; y: number };
}

/**
 * The room behind the offer: a dark grading suite crossed with an abstract
 * landscape — layered ridges receding into haze, one warm source low on the
 * right, glass panels catching the light, and slow dust in the beam.
 *
 * Everything here is transform/opacity only, and the dust is a single canvas
 * on one rAF loop, so the whole scene composites on the GPU.
 */
export function PremiumScene({ progress, lean }: PremiumSceneProps) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ---- dust ------------------------------------------------------------ */
  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Mote = { x: number; y: number; z: number; r: number; drift: number; phase: number };
    let motes: Mote[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with area but stays bounded on very large screens.
      const count = Math.min(90, Math.max(28, Math.round((w * h) / 26000)));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.3 + Math.random() * 0.7,
        r: 0.4 + Math.random() * 1.5,
        drift: 0.08 + Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let t = 0;
    const frame = () => {
      t += 0.006;
      ctx.clearRect(0, 0, w, h);

      for (const m of motes) {
        // Drift up and sway; wrap around rather than respawn.
        m.y -= m.drift * m.z;
        if (m.y < -8) {
          m.y = h + 8;
          m.x = Math.random() * w;
        }
        const sway = Math.sin(t * 1.6 + m.phase) * 10 * m.z;
        const x = m.x + sway;

        // Warmer and brighter nearer the light source, low-right.
        const warmth = Math.min(1, Math.max(0, (x / w) * 0.7 + (m.y / h) * 0.3));
        const alpha = 0.05 + m.z * 0.18;
        ctx.beginPath();
        ctx.arc(x, m.y, m.r * m.z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${240 - warmth * 10}, ${226 - warmth * 20}, ${200 + warmth * 20}, ${alpha})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce]);

  // Depth: nearer planes travel further with scroll and pointer.
  const plane = (depth: number) => ({
    x: lean.x * 14 * depth,
    y: lean.y * 10 * depth - progress * 42 * depth,
  });

  const spring = { type: 'spring' as const, stiffness: 40, damping: 22, mass: 1.1 };

  return (
    <div className="ps" aria-hidden="true">
      {/* Base wash: charcoal → deep blue, with the warm source low-right. */}
      <motion.div
        className="ps__ground"
        initial={reduce ? false : { opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: reduce ? 1 : 1.02 }}
        transition={{ opacity: { duration: 1.4 }, scale: { duration: 2.6, ease: [0.16, 1, 0.3, 1] } }}
      />

      {/* Slow breathing zoom across the whole scene. */}
      <motion.div
        className="ps__camera"
        animate={reduce ? undefined : { scale: [1.0, 1.045, 1.0] }}
        transition={{ duration: 34, ease: 'easeInOut', repeat: Infinity }}
      >
        {/* --- ridges: abstract landscape depth, four planes into haze --- */}
        {[0.22, 0.42, 0.68, 1].map((depth, i) => (
          <motion.div
            key={depth}
            className={`ps__ridge ps__ridge--${i + 1}`}
            animate={plane(depth)}
            transition={spring}
          />
        ))}

        {/* --- light beams from the source --- */}
        <motion.div
          className="ps__beam ps__beam--a"
          animate={reduce ? undefined : { opacity: [0.22, 0.4, 0.22], rotate: [-1.2, 0.6, -1.2] }}
          transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="ps__beam ps__beam--b"
          animate={reduce ? undefined : { opacity: [0.14, 0.26, 0.14] }}
          transition={{ duration: 13, ease: 'easeInOut', repeat: Infinity, delay: 2 }}
        />

        {/* --- glowing ring + orbit lines --- */}
        <motion.div className="ps__orbit-wrap" animate={plane(0.5)} transition={spring}>
          <motion.div
            className="ps__ring"
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 120, ease: 'linear', repeat: Infinity }}
          />
          <motion.div
            className="ps__ring ps__ring--inner"
            animate={reduce ? undefined : { rotate: -360 }}
            transition={{ duration: 90, ease: 'linear', repeat: Infinity }}
          />
          <motion.div
            className="ps__halo"
            animate={reduce ? undefined : { opacity: [0.35, 0.6, 0.35], scale: [0.98, 1.04, 0.98] }}
            transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity }}
          />
        </motion.div>

        {/* --- glass panels catching the light --- */}
        <motion.div className="ps__glass ps__glass--1" animate={plane(0.8)} transition={spring} />
        <motion.div className="ps__glass ps__glass--2" animate={plane(0.55)} transition={spring} />
        <motion.div className="ps__glass ps__glass--3" animate={plane(1.1)} transition={spring} />

        {/* --- drifting orbs --- */}
        <motion.div
          className="ps__orb ps__orb--1"
          animate={reduce ? undefined : { y: [0, -26, 0], x: [0, 12, 0] }}
          transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="ps__orb ps__orb--2"
          animate={reduce ? undefined : { y: [0, 20, 0], x: [0, -14, 0] }}
          transition={{ duration: 28, ease: 'easeInOut', repeat: Infinity, delay: 3 }}
        />
      </motion.div>

      {/* dust */}
      <canvas ref={canvasRef} className="ps__dust" />

      {/* atmosphere */}
      <div className="ps__haze" />
      <div className="ps__vignette" />
      <div className="ps__grain" />
    </div>
  );
}
