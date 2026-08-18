'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Magnetic cursor — pointer devices only.
 *
 * A soft ring that trails the pointer and is pulled toward interactive
 * elements, growing slightly over them. It replaces nothing: the native cursor
 * stays visible, because hiding it is how these effects become unusable the
 * moment the JS stalls.
 *
 * Gated hard on `(pointer: fine)` and `(hover: hover)`. On a touch device there
 * is no cursor to augment, and rendering one there means a ring that lags a
 * finger around the screen — the classic failure of this effect. It also
 * disables under reduced motion, where a constantly-moving element is exactly
 * what the preference is asking to remove.
 *
 * Runs entirely on a ref-driven rAF loop with transform writes only. No React
 * state per frame, no layout reads, so it cannot contend with the scroll or
 * with the scene.
 */
export default function MagneticCursor() {
  const ring = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches
      && window.matchMedia('(hover: hover)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(fine && !reduced);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ring.current;
    if (!el) return;

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { ...pointer };
    let scale = 1;
    let targetScale = 1;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;

      /**
       * Magnetism: when the pointer is inside an interactive element, the ring
       * targets that element's CENTRE rather than the pointer. That is what
       * makes it feel attracted rather than merely trailing — the ring settles
       * onto the control while the real cursor stays exactly where the user put
       * it, so aim is never affected.
       */
      const target = (e.target as HTMLElement | null)?.closest?.(
        'a[href], button:not([disabled]), [role="button"]',
      ) as HTMLElement | null;

      if (target) {
        const r = target.getBoundingClientRect();
        // Only for controls small enough that a centre pull reads as magnetism.
        // Snapping to the middle of a full-width row would look broken.
        if (r.width < 420 && r.height < 220) {
          pointer.x = r.left + r.width / 2;
          pointer.y = r.top + r.height / 2;
        }
        targetScale = 1.9;
      } else {
        targetScale = 1;
      }
    };

    const loop = () => {
      // Long tail, matching the rest of the motion language. No spring: an
      // overshooting cursor reads as a toy.
      pos.x += (pointer.x - pos.x) * 0.16;
      pos.y += (pointer.y - pos.y) * 0.16;
      scale += (targetScale - scale) * 0.12;
      el.style.transform =
        `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ring}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[60] h-6 w-6 rounded-full border border-brass/70 mix-blend-difference"
      style={{ transition: 'opacity 400ms cubic-bezier(0.22,0.61,0.24,1)' }}
    />
  );
}
