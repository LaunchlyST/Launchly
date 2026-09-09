import { motion, useReducedMotion } from 'framer-motion';
import './lake-scene.css';

/* Seven discrete layers so depth is physical, not implied: each one arrives at
   its own rate on entry — sky slowest, town fastest. Flat vector, dusk, limited
   palette. */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Depth is inverted travel: the far layers barely move, and arrive first. */
const DEPTH: Record<string, { travel: number; delay: number }> = {
  sky: { travel: 6, delay: 0 },
  far: { travel: 14, delay: 0.04 },
  mid: { travel: 26, delay: 0.08 },
  lake: { travel: 34, delay: 0.12 },
  town: { travel: 52, delay: 0.16 },
  mist: { travel: 40, delay: 0.2 },
  air: { travel: 20, delay: 0.1 },
};

function Layer({
  name,
  children,
  active,
}: {
  name: keyof typeof DEPTH | string;
  children: React.ReactNode;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const { travel, delay } = DEPTH[name] ?? { travel: 20, delay: 0.1 };
  return (
    <motion.g
      data-layer={name}
      initial={reduce ? false : { y: travel, opacity: 0 }}
      animate={active ? { y: 0, opacity: 1 } : undefined}
      transition={{ duration: 0.75, ease: EASE, delay }}
    >
      {children}
    </motion.g>
  );
}

/* Town: 11 pitched-roof houses in three dark tones, 7 warm windows, one spire,
   a jetty and two boats. Laid out by hand so the roofline has a rhythm. */
const HOUSES: Array<{ x: number; w: number; h: number; tone: number; lit: boolean }> = [
  { x: 180, w: 62, h: 54, tone: 0, lit: false },
  { x: 250, w: 74, h: 68, tone: 1, lit: true },
  { x: 332, w: 58, h: 48, tone: 2, lit: false },
  { x: 398, w: 82, h: 74, tone: 0, lit: true },
  { x: 488, w: 64, h: 56, tone: 1, lit: true },
  { x: 560, w: 70, h: 62, tone: 2, lit: false },
  { x: 700, w: 76, h: 66, tone: 1, lit: true },
  { x: 784, w: 60, h: 50, tone: 0, lit: true },
  { x: 852, w: 86, h: 78, tone: 2, lit: true },
  { x: 946, w: 66, h: 58, tone: 1, lit: false },
  { x: 1020, w: 72, h: 64, tone: 0, lit: true },
];

const TONES = ['#171C34', '#1E2440', '#121730'];
const BASE_Y = 566;

export function LakeScene({ active = true }: { active?: boolean }) {
  return (
    <svg
      className="ls"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B2144" />
          <stop offset="42%" stopColor="#2E2E56" />
          <stop offset="70%" stopColor="#6B4F66" />
          <stop offset="88%" stopColor="#E8A06B" />
          <stop offset="100%" stopColor="#F2BE8E" />
        </linearGradient>
        <radialGradient id="ls-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFD9A8" />
          <stop offset="60%" stopColor="#F2A93B" />
          <stop offset="100%" stopColor="#F2A93B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2140" />
          <stop offset="100%" stopColor="#141A33" />
        </linearGradient>
        <radialGradient id="ls-sunlane" cx="0.5" cy="0.12" r="0.9">
          <stop offset="0%" stopColor="#F2A93B" stopOpacity="0.26" />
          <stop offset="55%" stopColor="#F2A93B" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#F2A93B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ls-lake-clip">
          <rect x="0" y="600" width="1600" height="300" />
        </clipPath>
      </defs>

      {/* 1 — Sky. The gradient is mapped to the sky band only, so the warm
          horizon lands where the horizon actually is. */}
      <Layer name="sky" active={active}>
        <rect width="1600" height="900" fill="#141A33" />
        <rect width="1600" height="606" fill="url(#ls-sky)" />
        <circle cx="1090" cy="512" r="150" fill="url(#ls-sun)" opacity="0.5" />
        <circle cx="1090" cy="512" r="40" fill="#FFD9A8" opacity="0.92" />
      </Layer>

      {/* 2 — Far mountains */}
      <Layer name="far" active={active}>
        <path
          d="M0 470 L160 372 L268 438 L392 336 L520 452 L648 380 L790 470 L940 372 L1090 452 L1250 366 L1400 452 L1600 386 L1600 600 L0 600 Z"
          fill="#3A4370"
          opacity="0.86"
        />
      </Layer>

      {/* 3 — Mid mountains, with angular caps */}
      <Layer name="mid" active={active}>
        <path
          d="M0 546 L142 452 L268 520 L420 398 L566 528 L700 462 L836 540 L980 430 L1132 534 L1290 452 L1440 542 L1600 470 L1600 600 L0 600 Z"
          fill="#262C4C"
        />
        <path d="M420 398 L450 430 L434 436 L419 428 L404 438 L390 428 Z" fill="#C9D2E8" />
        <path d="M980 430 L1008 460 L993 466 L979 458 L965 468 L952 458 Z" fill="#C9D2E8" opacity="0.88" />
        <path d="M142 452 L166 478 L154 483 L141 476 L129 485 L118 476 Z" fill="#C9D2E8" opacity="0.7" />
      </Layer>

      {/* 4 — Lake, with the mountains mirrored into it */}
      <Layer name="lake" active={active}>
        <rect x="0" y="600" width="1600" height="300" fill="url(#ls-lake)" />
        {/* the sun, laid back down on the water */}
        <g clipPath="url(#ls-lake-clip)">
          <ellipse cx="1090" cy="640" rx="70" ry="150" fill="url(#ls-sunlane)" />
        </g>
        <g clipPath="url(#ls-lake-clip)" opacity="0.14">
          <path
            d="M0 654 L142 748 L268 680 L420 802 L566 672 L700 738 L836 660 L980 770 L1132 666 L1290 748 L1440 658 L1600 730 L1600 600 L0 600 Z"
            fill="#3A4370"
          />
        </g>
        <g className="ls__shimmer">
          <rect className="ls__shimmer-line ls__shimmer-line--1" x="-200" y="646" width="360" height="2" rx="1" />
          <rect className="ls__shimmer-line ls__shimmer-line--2" x="-200" y="694" width="520" height="2" rx="1" />
          <rect className="ls__shimmer-line ls__shimmer-line--3" x="-200" y="752" width="420" height="2" rx="1" />
          <rect className="ls__shimmer-line ls__shimmer-line--4" x="-200" y="820" width="600" height="2" rx="1" />
        </g>
      </Layer>

      {/* 5 — Town on the shore */}
      <Layer name="town" active={active}>
        {HOUSES.map((h, i) => {
          const top = BASE_Y - h.h;
          return (
            <g key={i}>
              <rect x={h.x} y={top} width={h.w} height={h.h} fill={TONES[h.tone]} />
              <path
                d={`M${h.x - 6} ${top} L${h.x + h.w / 2} ${top - 26} L${h.x + h.w + 6} ${top} Z`}
                fill={TONES[(h.tone + 1) % 3]}
              />
              {h.lit && (
                <rect
                  x={h.x + h.w / 2 - 7}
                  y={top + h.h * 0.36}
                  width="14"
                  height="16"
                  fill="#F2A93B"
                  opacity="0.82"
                />
              )}
            </g>
          );
        })}

        {/* Church spire */}
        <rect x="638" y="452" width="26" height="114" fill="#121730" />
        <path d="M632 452 L651 392 L670 452 Z" fill="#171C34" />
        <rect x="648" y="330" width="3" height="62" fill="#171C34" />

        {/* Jetty and two boats */}
        <rect x="440" y="596" width="152" height="6" fill="#121730" />
        <rect x="470" y="602" width="4" height="22" fill="#121730" />
        <rect x="556" y="602" width="4" height="22" fill="#121730" />
        <path d="M612 622 L664 622 L654 636 L622 636 Z" fill="#171C34" />
        <rect x="636" y="600" width="2" height="22" fill="#171C34" />
        <path d="M366 630 L410 630 L402 642 L374 642 Z" fill="#171C34" />
        <rect x="386" y="612" width="2" height="18" fill="#171C34" />
      </Layer>

      {/* 6 — Foreground mist over the waterline */}
      <Layer name="mist" active={active}>
        <g className="ls__mist">
          <rect x="-200" y="580" width="2000" height="52" fill="url(#ls-mist)" />
          <rect x="-200" y="612" width="2000" height="34" fill="url(#ls-mist)" opacity="0.7" />
        </g>
      </Layer>

      {/* 7 — Air: birds and clouds */}
      <Layer name="air" active={active}>
        <g className="ls__cloud ls__cloud--1" opacity="0.14">
          <ellipse cx="300" cy="212" rx="118" ry="26" fill="#C9D2E8" />
          <ellipse cx="364" cy="200" rx="72" ry="20" fill="#C9D2E8" />
        </g>
        <g className="ls__cloud ls__cloud--2" opacity="0.1">
          <ellipse cx="1080" cy="300" rx="150" ry="22" fill="#E8A06B" />
          <ellipse cx="1000" cy="292" rx="86" ry="16" fill="#E8A06B" />
        </g>
        <g className="ls__birds" fill="none" stroke="#1B2144" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
          <path d="M820 236 q10 -8 20 0 q10 -8 20 0" />
          <path d="M872 214 q8 -6 16 0 q8 -6 16 0" />
          <path d="M786 208 q8 -6 16 0 q8 -6 16 0" />
        </g>
      </Layer>
    </svg>
  );
}
