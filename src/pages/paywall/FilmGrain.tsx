/**
 * Film grain over the whole screen. SVG feTurbulence rather than a tiled PNG so
 * it stays crisp at any density and costs no request.
 */
export function FilmGrain({ className = 'pw__grain' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" preserveAspectRatio="none">
      <filter id="pw-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves={3}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#pw-grain)" />
    </svg>
  );
}
