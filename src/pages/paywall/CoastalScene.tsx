import { useEffect, useState } from 'react';
import { BANDS, LANDSCAPE_FALLBACK, LANDSCAPE_IMAGE, LANDSCAPE_VIDEO, probeImage } from './landscape';
import './coastal-scene.css';

interface CoastalSceneProps {
  /** 0..1 camera progress. Only the dolly reads this; the scenery loops on its own. */
  zoom: number;
  /** Skips the camera move and the looping motion. */
  still?: boolean;
  /** 0..1 — how much readability scrim the plan cards need right now. */
  scrim?: number;
}

/**
 * The illustrated coastal sunset, animated by region.
 *
 * The artwork is never warped as a whole. One static copy carries the
 * composition — cliffs, buildings, horizon — and three masked copies of the
 * same image sit on top, each clipped to one band and moved by a fraction of a
 * percent: sky (clouds drift), water (ripple plus a shimmer sheet), and the
 * left/right edges below the tree line (foliage sway).
 *
 * The camera is a scale on the whole frame, derived from scroll progress, so
 * reversing the scroll reverses it exactly.
 */
export function CoastalScene({ zoom, still = false, scrim = 0 }: CoastalSceneProps) {
  const [hasImage, setHasImage] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    probeImage(LANDSCAPE_IMAGE).then((ok) => live && setHasImage(ok));
    return () => {
      live = false;
    };
  }, []);

  const scale = still ? 1.02 : 1.02 + zoom * 0.26;
  /* The configured photograph wins; the drawn scene is the standing fallback
     while `hasImage` is still unknown or the file is not there. */
  const media = LANDSCAPE_VIDEO ? null : hasImage ? LANDSCAPE_IMAGE : LANDSCAPE_FALLBACK;

  /* Masks are built from the configured band positions so one set of layers
     fits whatever artwork is dropped in. */
  const skyMask = `linear-gradient(to bottom, #000 0%, #000 ${BANDS.skyEnd * 82}%, transparent ${BANDS.skyEnd * 100}%)`;
  const waterMask = `linear-gradient(to bottom, transparent ${BANDS.waterStart * 100}%, #000 ${Math.min(99, BANDS.waterStart * 100 + 6)}%, #000 100%)`;
  const foliageMask = [
    `linear-gradient(to bottom, transparent ${BANDS.foliageStart * 100}%, #000 ${Math.min(99, BANDS.foliageStart * 100 + 5)}%, #000 100%)`,
    'linear-gradient(to right, #000 0%, #000 16%, transparent 30%, transparent 70%, #000 84%, #000 100%)',
  ].join(', ');

  const maskProps = (mask: string) => ({
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskComposite: 'source-in',
    maskComposite: 'intersect',
  }) as const;

  return (
    <div className="cs" aria-hidden="true">
      <div className="cs__camera" style={{ transform: `scale(${scale})` }}>
        {LANDSCAPE_VIDEO ? (
          <video
            className="cs__layer"
            src={LANDSCAPE_VIDEO}
            poster={hasImage ? LANDSCAPE_IMAGE : undefined}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : media ? (
          <>
            {/* The composition. Never moves. */}
            <img className="cs__layer" src={media} alt="" decoding="async" />

            {!still && (
              <>
                {/* Clouds: a long lateral drift above the cliff line. */}
                <img
                  className="cs__layer cs__sky"
                  src={media}
                  alt=""
                  aria-hidden="true"
                  style={maskProps(skyMask)}
                />
                {/* Water: a slow swell, with a shimmer sheet over the top. */}
                <img
                  className="cs__layer cs__water"
                  src={media}
                  alt=""
                  aria-hidden="true"
                  style={maskProps(waterMask)}
                />
                <div className="cs__shimmer" style={maskProps(waterMask)} />
                {/* Foliage: the left and right edges below the tree line. */}
                <img
                  className="cs__layer cs__foliage"
                  src={media}
                  alt=""
                  aria-hidden="true"
                  style={maskProps(foliageMask)}
                />
              </>
            )}
          </>
        ) : null}
      </div>

      {/* Just enough scrim for the cards to read, and only while they are up. */}
      <div className="cs__scrim" style={{ opacity: scrim * 0.42 }} />
    </div>
  );
}
