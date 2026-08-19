'use client';

/**
 * The drifting panels behind the opening — in CSS, not WebGL.
 *
 * The sister shop's composition, in this shop's blush. It replaces an
 * entrance scene that staged a product photograph behind the copy: that
 * photograph ran up behind the header and was asked to go, and the shop then
 * read as empty without it. This gives the opening depth again for no bytes.
 *
 * WHY THIS EXISTS. The look came from a three.js scene: translucent planes
 * turning slowly in window light. It is the right look, it was asked to be
 * kept, and it cost 717KB of JavaScript — which is the same 717KB that made
 * the shop feel slow on a phone. "Keep it, and do not lag" reads like a
 * contradiction and is not: the WEIGHT was never the look, it was the engine
 * chosen to draw it.
 *
 * Six translucent quadrilaterals, transformed on the compositor. That is the
 * whole thing. No canvas, no context, no shaders, no capability detection, no
 * idle callback, no tier system — and no 717KB. It runs identically on a phone
 * and a laptop, in portrait and landscape, because it is layout rather than a
 * render target that has to be sized and resized.
 *
 * WHAT MAKES IT LOOK LIKE CLOTH RATHER THAN CSS:
 *
 *   NOTHING IS A RECTANGLE. Each panel is skewed and rotated a degree or two.
 *   Perfect rectangles read as boxes; sheets of paper and lengths of cloth are
 *   never square to the room.
 *
 *   THEY OVERLAP AND MULTIPLY. Where two panels cross, the tint deepens, the
 *   way two layers of muslin do on a table.
 *
 *   NOTHING IS IN STEP. Six different durations, none a multiple of another,
 *   so the composition never resolves into a visible loop.
 *
 * `transform` and `opacity` only — the two properties a browser can animate
 * without touching layout or paint, so this stays on the compositor thread and
 * cannot stutter the page even while it scrolls.
 *
 * Off entirely under `prefers-reduced-motion`: the panels stay, they stop
 * moving. Someone who asked for less motion still gets the composition.
 */

interface Panel {
  /** Percentages, so the composition scales with the box rather than the page. */
  left: number;
  top: number;
  w: number;
  h: number;
  rotate: number;
  skew: number;
  opacity: number;
  seconds: number;
  delay: number;
}

const PANELS: Panel[] = [
  { left: 46, top: -8, w: 26, h: 78, rotate: -3.5, skew: -2, opacity: 0.55, seconds: 23, delay: 0 },
  { left: 58, top: 6, w: 30, h: 64, rotate: 2.5, skew: 1.5, opacity: 0.42, seconds: 31, delay: -6 },
  { left: 70, top: -14, w: 22, h: 88, rotate: -1.5, skew: -1, opacity: 0.36, seconds: 27, delay: -13 },
  { left: 38, top: 22, w: 18, h: 52, rotate: 4, skew: 2.5, opacity: 0.3, seconds: 37, delay: -3 },
  { left: 80, top: 14, w: 24, h: 70, rotate: -2.5, skew: -1.8, opacity: 0.26, seconds: 29, delay: -19 },
  { left: 62, top: 34, w: 20, h: 46, rotate: 3, skew: 1, opacity: 0.22, seconds: 41, delay: -9 },
];

export default function PaperDrift({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {PANELS.map((p, i) => (
        <span
          key={i}
          className="paper-drift absolute block bg-ink-raised"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.w}%`,
            height: `${p.h}%`,
            opacity: p.opacity,
            mixBlendMode: 'multiply',
            animationDuration: `${p.seconds}s`,
            animationDelay: `${p.delay}s`,
            ['--rot' as string]: `${p.rotate}deg`,
            ['--skw' as string]: `${p.skew}deg`,
          }}
        />
      ))}
    </div>
  );
}
