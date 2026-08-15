'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 21:9 letterbox bars on hero routes.
 *
 * Purely a CSS overlay — it never crops the canvas or changes the camera's
 * aspect. Cropping would cost real pixels and would push page content around;
 * this just draws the frame edge over the top, which is what a matte does.
 *
 * Two rules keep it from becoming a nuisance:
 *
 *   1. It only appears where the viewport is *taller* than 21:9. On a wide
 *      monitor the frame is already cinematic and bars would be decoration
 *      for its own sake.
 *   2. It retracts as soon as the visitor scrolls past the hero. Bars that
 *      persist over a product grid are just lost screen height, and on a
 *      phone that is the difference between seeing two products and four.
 *
 * pointer-events:none throughout: nothing here may ever intercept a tap, and
 * the bars sit at a z-index below the navigation so the header stays usable.
 */

const HERO_ROUTES = new Set(['/', '/products']);

export default function Letterbox() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion keeps the bars but never animates them in — they are a
    // static frame, not a move, so they stay; the transition is what goes.
    const wide = window.matchMedia('(min-aspect-ratio: 21/9)');
    const update = () => setEnabled(HERO_ROUTES.has(pathname) && !wide.matches);
    update();
    wide.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      void reduced;
    };
  }, [pathname]);

  useEffect(() => {
    if (!enabled) { setVisible(false); return; }
    const onScroll = () => setVisible(window.scrollY < window.innerHeight * 0.55);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  if (!enabled) return null;

  // 21:9 of the viewport width is the target frame height; the remainder is
  // split between the two bars.
  const bar = 'max(0px, calc((100vh - (100vw / 2.3333)) / 2))';

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-20">
      <div
        className="absolute inset-x-0 top-0 bg-black motion-safe:transition-[height,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,0.61,0.24,1)]"
        style={{ height: bar, opacity: visible ? 1 : 0 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-black motion-safe:transition-[height,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,0.61,0.24,1)]"
        style={{ height: bar, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
