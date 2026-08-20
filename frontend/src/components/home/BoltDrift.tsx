'use client';

/**
 * Bolts of cloth stacked on a counter, behind the opening line.
 *
 * WHAT THIS IS AND IS NOT. Two motifs were tried here and both were rejected:
 * eighteen flat vertical pleats, then nine panels turning in real CSS 3D. The
 * objection each time was the same — stripes across the opening read as
 * pattern laid OVER the page rather than as something the page is made of.
 *
 * The sister shop's opening was never the thing being complained about, so
 * this borrows its logic rather than its look: a few large, soft, overlapping
 * planes at low contrast, and nothing else. Where that one is loose sheets of
 * pattern paper scattered on a table, this is folded BOLTS stacked on a
 * counter — squarer, heavier, sitting in a row rather than thrown down. Same
 * restraint, different object, so the two shops do not read as one.
 *
 * THE DEPTH IS REAL, AND IT IS SMALL ON PURPOSE. The container carries a
 * `perspective` and each bolt sits at its own `translateZ` with a slight
 * `rotateY`, so nearer bolts are genuinely larger and their edges converge —
 * the browser is projecting them, not shading them to look projected. But the
 * turn is a few degrees, not thirty: a stack of cloth on a counter is very
 * nearly square to you, and exaggerating it is what made the last attempt look
 * like decoration.
 *
 * `mixBlendMode: multiply` is what keeps it from becoming a sticker. Each bolt
 * darkens the sandal ground rather than painting a shape on top of it, so
 * where two overlap the fold reads as a third, deeper tone — which is exactly
 * what stacked cloth does, and it means the motif can never be lighter than
 * the page it sits on.
 *
 * SIX ELEMENTS. No canvas, no WebGL, no images, no JavaScript after mount,
 * `transform` and nothing else — composited on the GPU, never touching layout,
 * so it cannot stutter a scroll or behave differently in landscape. Durations
 * are non-harmonic so the composition never visibly loops.
 *
 * Under `prefers-reduced-motion` the stack stays and stops breathing.
 */

/** Deterministic, so the server and the browser draw the same stack. */
const BOLTS = [
  { left: 46, top:  6, w: 30, h: 74, z: -150, turn:  5.5, tone: 0.30, secs: 23, delay:  0 },
  { left: 58, top: 14, w: 26, h: 66, z:  -95, turn:  3.0, tone: 0.24, secs: 29, delay: -6 },
  { left: 70, top:  2, w: 24, h: 82, z:  -55, turn:  1.0, tone: 0.20, secs: 19, delay: -3 },
  { left: 80, top: 18, w: 22, h: 60, z:  -20, turn: -2.0, tone: 0.16, secs: 31, delay: -9 },
  { left: 38, top: 22, w: 20, h: 54, z: -190, turn:  7.0, tone: 0.14, secs: 26, delay: -13 },
  { left: 88, top:  8, w: 18, h: 70, z: -120, turn: -4.0, tone: 0.12, secs: 21, delay: -17 },
];

export default function BoltDrift({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ perspective: '1100px', perspectiveOrigin: '68% 45%' }}
    >
      {BOLTS.map((b, i) => (
        <span
          key={i}
          className="bolt-drift absolute block"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: `${b.w}%`,
            height: `${b.h}%`,
            /* The sandal band, at a fraction of its strength. `multiply` means
               this DARKENS the warm-white page rather than covering it. */
            background: `rgba(198,183,161,${b.tone})`,
            mixBlendMode: 'multiply',
            transform: `translateZ(${b.z}px) rotateY(${b.turn}deg)`,
            animationDuration: `${b.secs}s`,
            animationDelay: `${b.delay}s`,
            ['--z' as string]: `${b.z}px`,
            ['--turn' as string]: `${b.turn}deg`,
          }}
        />
      ))}
    </div>
  );
}
