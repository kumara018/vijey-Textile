'use client';

import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';

/**
 * Per-word headline reveal.
 *
 * Words rise and fade in sequence rather than the whole line appearing at once,
 * which is what makes a large display line read as *arriving* rather than
 * switching on. The direction is the brand's: everything in The Trousseau rises
 * into place, the way cloth is lifted.
 *
 * Split by WORD, not by character. Per-character splitting is the more
 * impressive-looking demo and the wrong choice here: it shreds the accessible
 * text into meaningless fragments, breaks text selection, and on a long serif
 * headline it reads as a novelty effect rather than as typography. The visible
 * text stays whole for screen readers via an aria-label on the wrapper, with the
 * animated spans hidden from the accessibility tree entirely.
 *
 * Reduced motion renders the finished state with no transition at all — not a
 * faster animation, no animation.
 */
export default function SplitText({
  text,
  as: Tag = 'span',
  className = '',
  delay = 0,
  stagger = 55,
  duration = 620,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  /** Gap between consecutive words, ms. */
  stagger?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden="true"
          // Each word gets its own clipping box so the rise happens from behind
          // a hard edge rather than fading in from nowhere.
          className="inline-block overflow-hidden align-bottom"
        >
          <span
            className="inline-block will-change-transform"
            style={{
              transform: shown || reduced ? 'translateY(0)' : 'translateY(0.9em)',
              opacity: shown || reduced ? 1 : 0,
              transition: reduced
                ? 'none'
                : `transform ${duration}ms cubic-bezier(0.22,0.61,0.24,1) ${delay + i * stagger}ms, opacity ${duration}ms cubic-bezier(0.22,0.61,0.24,1) ${delay + i * stagger}ms`,
            }}
          >
            {word}
          </span>
          {/* Real space between words, outside the animated span, so the line
              still wraps and selects like ordinary text. */}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
