'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

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
export default function CaptureMode() {
  const params = useSearchParams();

  useEffect(() => {
    if (params.get('capture') !== '1') return;
    const root = document.documentElement;
    root.setAttribute('data-capture', '1');
    return () => root.removeAttribute('data-capture');
  }, [params]);

  return null;
}
