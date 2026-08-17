'use client';

import { useEffect } from 'react';

/**
 * Capture mode — `?capture=1`.
 *
 * Strips every DOM layer so an offline render records ONLY the 3D scene.
 *
 * Without this, `Page.captureScreenshot` bakes the entire composited page into
 * each frame: navigation, headline, footer, the sound toggle. Scrubbing those
 * frames then draws a photograph of the page inside the page, and the headline
 * appears twice — once as live DOM and once printed into the sequence
 * underneath it. That is exactly what shipped, and it is obvious in hindsight:
 * a screenshot captures what is on screen, and the DOM is on screen.
 *
 * The sequence is a backdrop. It must contain the scene and nothing else, so
 * the live DOM can sit over it and stay the only copy of the words.
 *
 * Only ever active with the query parameter present, so no visitor can reach
 * it — and the render script is the only thing that sets it.
 */
/**
 * READS `window.location.search`, NOT `useSearchParams()`.
 *
 * This is not a style preference — the hook silently does not work here. `/` is
 * statically prerendered, and in a production build `useSearchParams()` inside a
 * client component with no Suspense boundary above it returns an EMPTY
 * ReadonlyURLSearchParams and never populates. So `params.get('capture')` was
 * always null, the attribute was never set, and the renderer's preconditions
 * refused with "capture attribute never applied".
 *
 * It worked in development for the whole life of this file because dev does not
 * prerender the route the same way — which is exactly why it went unnoticed:
 * every hero ever rendered was captured against the dev server. Rendering
 * against a production build, which is the correct thing to do, is what exposed
 * it. The frames were also carrying the dev overlay for the same reason.
 *
 * `window.location.search` has none of that conditionality. It is read inside an
 * effect, so it only ever runs on the client, where the query string is simply
 * a fact. `isCaptureRender()` in useDeliveryTier already reads it this way, so
 * the two now agree by construction rather than by coincidence.
 */
export default function CaptureMode() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('capture') !== '1') return;
    const root = document.documentElement;
    root.setAttribute('data-capture', '1');
    return () => root.removeAttribute('data-capture');
  }, []);

  return null;
}
