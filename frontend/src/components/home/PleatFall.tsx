'use client';

/**
 * The pleat fall behind the opening.
 *
 * WHY THIS IS NOT THE SISTER SHOP'S COMPOSITION. It was, for about a day:
 * both openings carried the same six drifting rectangles, and that was called
 * out immediately. Two shops with one motif are one shop with two names —
 * whatever the palette does, the eye reads the shape first.
 *
 * So each takes the shape of what it actually sells. Ammalu Tex is a workroom
 * of flat cottons, and flat cloth on a table is overlapping rectangles: that
 * composition is right there and stays there. This shop sells occasion wear
 * for girls, and the defining thing about a lehenga, a pattu pavadai or a
 * party frock is the FALL — vertical pleats, hanging, catching light down
 * their folds and widening toward the hem.
 *
 * So: eighteen tapered vertical bands, each a little wider at the bottom than
 * the top, alternating in tone the way light and shadow alternate across a
 * pleated skirt. They breathe rather than drift — a slow scale on the vertical
 * axis only, which is how hanging cloth actually moves. Nothing slides
 * sideways, because a pleat that slides sideways is a curtain being drawn.
 *
 * SAME ENGINEERING RULES AS THE SISTER SHOP'S, FOR THE SAME REASON. Plain
 * elements, `transform` and `opacity` only, so it stays on the compositor and
 * cannot stutter the page while it scrolls. No canvas, no WebGL, no capability
 * detection, no idle callback — which is what lets it run on a phone at all,
 * and identically in portrait and landscape, since it is layout rather than a
 * render target that has to be sized and resized.
 *
 * Under `prefers-reduced-motion` the pleats stay and stop moving.
 */

/** Deterministic, so the server and the browser draw the same fall. */
const PLEATS = Array.from({ length: 18 }, (_, i) => {
  const t = i / 17;
  return {
    /* Widening toward the right, the way a fall opens out as it drops. */
    left: t * 100,
    width: 4.2 + Math.sin(t * Math.PI) * 2.6,
    /* Alternating light and shadow, with the deepest folds off-centre —
       a perfectly symmetrical fall reads as a printed pattern. */
    opacity: (i % 2 === 0 ? 0.5 : 0.26) * (0.45 + Math.sin(t * Math.PI) * 0.55),
    seconds: 17 + (i % 5) * 3.5,
    delay: -(i % 7) * 2.3,
    skew: (t - 0.5) * 2.4,
  };
});

export default function PleatFall({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {PLEATS.map((p, i) => (
        <span
          key={i}
          className="pleat-fall absolute top-0 block h-full bg-ink-raised"
          style={{
            left: `${p.left}%`,
            width: `${p.width}%`,
            opacity: p.opacity,
            transform: `skewX(${p.skew}deg)`,
            animationDuration: `${p.seconds}s`,
            animationDelay: `${p.delay}s`,
            ['--skx' as string]: `${p.skew}deg`,
          }}
        />
      ))}
    </div>
  );
}
