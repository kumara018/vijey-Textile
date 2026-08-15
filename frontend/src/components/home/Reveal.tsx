'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scroll reveal — the motion signature for The Trousseau.
 *
 * Everything rises into place from below, the way cloth is lifted rather than
 * slid. That direction is the brand's half of the motion split: the sister
 * site's elements never translate vertically at all, they cross-dissolve and
 * drift sideways by a few pixels.
 *
 * Long and deliberate — 620ms on a cubic bezier with a heavy tail. No spring,
 * no bounce: overshoot reads as an interface responding to a tap, not as
 * something being placed.
 *
 * IntersectionObserver rather than a scroll handler, so this costs nothing per
 * frame while a 3D scene is rendering behind it. Reveals fire once and then
 * the observer disconnects — re-animating on the way back up is a tic.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Reduced motion gets the final state immediately — no transform, no
    // transition, nothing to disable later.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      // Fires a little before the element reaches the viewport edge, so the
      // reveal is already underway by the time it is genuinely visible.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-safe:transition-[opacity,transform] motion-safe:duration-[620ms] motion-safe:ease-[cubic-bezier(0.22,0.61,0.24,1)] ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 motion-safe:translate-y-7'
      } ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
