import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface Feature {
  id: string;
  label: string;
  detail: string;
}

export const FEATURES: Feature[] = [
  { id: 'models', label: 'Access to every model', detail: 'Switch freely across the full model roster.' },
  { id: 'export', label: 'High quality export', detail: 'Full-resolution renders, no compression pass.' },
  { id: 'watermark', label: 'No watermark', detail: 'Clean frames, ready to publish.' },
  { id: 'speed', label: 'Faster generation', detail: 'Priority queue on every render.' },
  { id: 'styles', label: 'Premium styles', detail: 'The full grading and style library.' },
  { id: 'projects', label: 'Unlimited projects', detail: 'Keep every idea, no cap.' },
  { id: 'workflow', label: 'Better creative workflow', detail: 'Built for TikTok Shop, end to end.' },
];

/**
 * Each feature carries a small motif rather than a bullet: a mark that says
 * something about the benefit and animates only while its row is in view or
 * hovered. All are 28×28 line drawings so the column stays quiet.
 */
function Motif({ id, active }: { id: string; active: boolean }) {
  const reduce = useReducedMotion();
  const on = active && !reduce;
  const stroke = 'currentColor';
  const common = { fill: 'none', stroke, strokeWidth: 1.1, strokeLinecap: 'round' as const };

  switch (id) {
    /* Orbiting nodes around a core: many models, one system. */
    case 'models':
      return (
        <svg viewBox="0 0 28 28" className="pf__motif">
          <circle cx="14" cy="14" r="2.4" {...common} />
          <motion.g
            animate={on ? { rotate: 360 } : undefined}
            transition={{ duration: 14, ease: 'linear', repeat: Infinity }}
            style={{ transformOrigin: '14px 14px' }}
          >
            <ellipse cx="14" cy="14" rx="9.5" ry="5" {...common} opacity={0.4} />
            <circle cx="23.5" cy="14" r="1.5" fill={stroke} stroke="none" />
            <circle cx="4.5" cy="14" r="1.1" fill={stroke} stroke="none" opacity={0.6} />
          </motion.g>
        </svg>
      );

    /* A frame that sharpens: corner brackets close in. */
    case 'export':
      return (
        <svg viewBox="0 0 28 28" className="pf__motif">
          <motion.g
            animate={on ? { scale: [1, 0.86, 1], opacity: [0.55, 1, 0.55] } : undefined}
            transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
            style={{ transformOrigin: '14px 14px' }}
          >
            <path d="M5 10V5h5M23 10V5h-5M5 18v5h5M23 18v5h-5" {...common} />
          </motion.g>
          <rect x="10.5" y="10.5" width="7" height="7" rx="1" {...common} opacity={0.5} />
        </svg>
      );

    /* A wipe that clears the mark away. */
    case 'watermark':
      return (
        <svg viewBox="0 0 28 28" className="pf__motif">
          <rect x="5" y="7" width="18" height="14" rx="2" {...common} opacity={0.45} />
          <motion.g
            animate={on ? { opacity: [0.7, 0, 0.7] } : undefined}
            transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
          >
            <path d="M10 17l8-6" {...common} />
          </motion.g>
          <motion.rect
            x="5"
            y="7"
            width="18"
            height="14"
            rx="2"
            fill={stroke}
            opacity={0.12}
            animate={on ? { x: [5, 23], width: [18, 0] } : undefined}
            transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
          />
        </svg>
      );

    /* Speed streaks. */
    case 'speed':
      return (
        <svg viewBox="0 0 28 28" className="pf__motif">
          {[10, 14, 18].map((y, i) => (
            <motion.path
              key={y}
              d={`M5 ${y}h14`}
              {...common}
              opacity={0.35 + i * 0.2}
              animate={on ? { pathLength: [0.2, 1, 0.2], x: [-2, 4, -2] } : undefined}
              transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, delay: i * 0.14 }}
            />
          ))}
          <path d="M19 9l4 5-4 5" {...common} />
        </svg>
      );

    /* A morphing form: the style library. */
    case 'styles':
      return (
        <svg viewBox="0 0 28 28" className="pf__motif">
          <motion.path
            d="M14 5c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9z"
            {...common}
            animate={
              on
                ? {
                    d: [
                      'M14 5c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9z',
                      'M14 5c6 1 8 5 7 10s-6 8-10 7-6-6-5-11 3-7 8-6z',
                      'M14 5c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9z',
                    ],
                  }
                : undefined
            }
            transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity }}
          />
          <circle cx="14" cy="14" r="3" {...common} opacity={0.5} />
        </svg>
      );

    /* Layers expanding outward. */
    case 'projects':
      return (
        <svg viewBox="0 0 28 28" className="pf__motif">
          {[0, 1, 2].map((i) => (
            <motion.rect
              key={i}
              x={7 + i * 0.5}
              y={9 + i * 3}
              width={14 - i}
              height="6"
              rx="1.5"
              {...common}
              opacity={0.8 - i * 0.22}
              animate={on ? { y: [9 + i * 3, 8 + i * 3.6, 9 + i * 3] } : undefined}
              transition={{ duration: 3.6, ease: 'easeInOut', repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </svg>
      );

    /* A connected flow. */
    default:
      return (
        <svg viewBox="0 0 28 28" className="pf__motif">
          <path d="M6 19c4 0 4-10 8-10s4 10 8 10" {...common} opacity={0.5} />
          <motion.circle
            cx="6"
            cy="19"
            r="1.8"
            fill={stroke}
            stroke="none"
            animate={on ? { cx: [6, 14, 22], cy: [19, 9, 19] } : undefined}
            transition={{ duration: 4.2, ease: 'easeInOut', repeat: Infinity }}
          />
        </svg>
      );
  }
}

interface RowProps {
  feature: Feature;
  index: number;
  onReveal?: () => void;
}

/** One feature row: reveals as it scrolls into focus, wakes on hover/focus. */
export function FeatureRow({ feature, index, onReveal }: RowProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLLIElement | null>(null);
  const [inView, setInView] = useState(false);
  const [hot, setHot] = useState(false);
  const announced = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (!announced.current) {
            announced.current = true;
            onReveal?.();
          }
        }
      },
      { threshold: 0.45 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onReveal]);

  return (
    <motion.li
      ref={ref}
      className={`pf__row ${hot ? 'is-hot' : ''}`}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.07, 0.5) }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
    >
      <span className="pf__mark">
        <Motif id={feature.id} active={inView || hot} />
      </span>
      <span className="pf__text">
        <span className="pf__label">{feature.label}</span>
        <span className="pf__detail">{feature.detail}</span>
      </span>
      <span className="pf__rule" aria-hidden="true" />
    </motion.li>
  );
}
