'use client';

import { Suspense, lazy, useEffect, useState } from 'react';

/**
 * Spline content, mounted as its own DOM surface.
 *
 * The first attempt here was @splinetool/loader, which loads a .splinecode
 * into an existing three.js scene and would have kept everything on the one
 * persistent canvas. It does not work on this stack, and not for a stylistic
 * reason: the loader still does
 *
 *     import { LinearEncoding, sRGBEncoding } from 'three'
 *
 * and both constants were removed in three r152 when encodings were replaced by
 * the ColorSpace API. We are on 0.185. Turbopack resolves that import
 * statically, so it takes down the entire module graph — every route returned
 * 500, and a try/catch around a dynamic import cannot rescue a static
 * resolution failure. The package is simply not compatible with modern three.
 *
 * That leaves the Spline runtime, which brings its own canvas and renderer. So
 * this component is deliberately scoped rather than global:
 *
 *   - it renders nothing at all until a scene URL is actually configured, so
 *     the second context does not exist on any route today
 *   - it is DOM-level, mounted beside the persistent canvas rather than inside
 *     it, and unmounts on route change — the extra context is created and
 *     released with the surface, never held for the session
 *   - the runtime is lazy-loaded, keeping it out of the main bundle
 *
 * The trade is explicit: Spline content costs a second WebGL context while it
 * is on screen. That is acceptable for one route. It would not be acceptable
 * as a permanent fixture, which is what mounting it globally would have meant.
 */

// Set once a scene has been exported from Spline into /public/spline/.
export const SPLINE_SCENES: Partial<Record<string, string>> = {
  // 'chamber': '/spline/chamber.splinecode',
};

const Spline = lazy(() => import('@splinetool/react-spline'));

export default function SplineSurface({
  sceneKey,
  className = '',
}: {
  sceneKey: string;
  className?: string;
}) {
  const url = SPLINE_SCENES[sceneKey];
  const [failed, setFailed] = useState(false);

  // A missing or broken Spline scene is a content problem, not a reason to
  // blank the page — the persistent canvas keeps rendering underneath either
  // way.
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      <Suspense fallback={null}>
        <Spline
          scene={url}
          onError={() => {
            console.warn(`[3D] Spline scene unavailable: ${url} — continuing without it`);
            setFailed(true);
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>
    </div>
  );
}
