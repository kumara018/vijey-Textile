'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Load a texture that is allowed to fail.
 *
 * `useLoader(THREE.TextureLoader, url)` throws when the image does not arrive,
 * and a throw during render is not something Suspense catches — Suspense
 * handles the PROMISE, not its rejection. The rejection propagates past every
 * `<Suspense fallback={null}>` to the nearest error boundary, which on this
 * site is the global one. So a single unreachable product photograph took the
 * entire homepage down to "The site failed to load", with the catalogue, the
 * navigation and every route out of it gone with it.
 *
 * Measured, not theorised: a CSP that omitted the media host blocked the hero
 * photograph, and the whole page became the error screen. The CSP was the
 * proximate cause and is fixed — but a shop cannot be one 404, one expired
 * CDN link or one blocked host away from having no website, and the next
 * cause will not be the same as this one.
 *
 * So decoration fails like decoration. This returns `null` while loading and
 * `null` forever if the image never arrives; the caller renders nothing and the
 * page keeps its poster, its type and its checkout.
 */
export function useSafeTexture(url: string | null | undefined): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let cancelled = false;
    let loaded: THREE.Texture | null = null;

    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (cancelled) { t.dispose(); return; }
        loaded = t;
        setTexture(t);
      },
      undefined,
      () => {
        // Swallowed deliberately. There is nothing a visitor can do about a
        // blocked image, and the page behind it is entirely usable.
        if (!cancelled) setTexture(null);
      },
    );

    return () => {
      cancelled = true;
      // The GPU copy belongs to this hook, so this hook releases it. Leaving it
      // behind on every hero change is a slow leak on a canvas that never
      // unmounts.
      loaded?.dispose();
      setTexture(null);
    };
  }, [url]);

  return texture;
}
