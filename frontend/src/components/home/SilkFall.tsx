'use client';

/**
 * The silk fall — the opening composition.
 *
 * WHAT WAS WRONG WITH WHAT IT REPLACES. `PleatFall` drew eighteen flat vertical
 * bands. Flat is the operative word: every band sat on the same plane at the
 * same distance, so the only thing separating them was opacity. It read as
 * wallpaper — a printed stripe, not cloth — and it was called out as such more
 * than once.
 *
 * THIS ONE IS ACTUALLY IN THREE DIMENSIONS, not shaded to look like it. The
 * container holds a real `perspective`, and each panel is placed at its own
 * `translateZ` and turned on its own `rotateY`. That means the browser is
 * projecting them: panels nearer the viewer are genuinely wider on screen,
 * their edges converge toward a vanishing point, and when they turn they
 * foreshorten the way a hanging length of silk does. None of that can be
 * faked with opacity, which is exactly why the flat version never convinced.
 *
 * THE LIGHT IS THE POINT. Silk is worth looking at because of what it does
 * with light: a bright band that slides along the fold as the cloth moves.
 * Each panel carries a three-stop gradient — shadow, sheen, shadow — and the
 * sheen sits at a different height on each one, so the highlights form a
 * broken diagonal across the composition rather than a row of identical
 * stripes. The turn animation moves each panel through its own light.
 *
 * WHY IT CANNOT MAKE THE PAGE STUTTER. Nine elements. No canvas, no WebGL, no
 * capability detection, no images, no JavaScript after mount. `transform` and
 * nothing else, so every frame is composited on the GPU and never touches
 * layout or the main thread — which is what lets it run identically on a phone
 * and in landscape, since it is layout rather than a render target that has to
 * be sized and resized. The durations are mutually non-harmonic (17-31s), so
 * the composition never visibly loops.
 *
 * `prefers-reduced-motion` keeps the depth and stops the movement: the panels
 * hold their turned positions, which is still a three-dimensional image.
 */

/** Deterministic, so the server and the browser project the same fall. */
const PANELS = Array.from({ length: 9 }, (_, i) => {
  const t = i / 8;
  return {
    /* Spread across the width, widening toward the right the way a fall opens
       out as it drops. */
    left: -4 + t * 104,
    width: 13 + Math.sin(t * Math.PI) * 7,
    /* Depth. Panels alternate near and far so the eye reads layers rather
       than a single receding wall. */
    z: (i % 3 === 0 ? -160 : i % 3 === 1 ? -40 : -95) + Math.sin(t * Math.PI) * 30,
    /* The turn. Panels on the left face right and vice versa, so the whole
       composition reads as wrapping around the viewer. */
    turn: (0.5 - t) * 34,
    /* Where the sheen sits on this panel, as a percentage down its length. */
    sheen: 22 + ((i * 37) % 56),
    opacity: 0.26 + (i % 2 === 0 ? 0.2 : 0.06),
    seconds: 17 + (i % 5) * 3.5,
    delay: -(i % 7) * 2.9,
  };
});

export default function SilkFall({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ perspective: '900px', perspectiveOrigin: '50% 42%' }}
    >
      {PANELS.map((p, i) => (
        <span
          key={i}
          className="silk-panel absolute top-[-8%] block h-[116%]"
          style={{
            left: `${p.left}%`,
            width: `${p.width}%`,
            opacity: p.opacity,
            /* Shadow, sheen, shadow — the fold catching the light. Colours are
               the shop's own raised ground and its near-white, so the silk is
               made of the palette rather than of grey. */
            background: `linear-gradient(
              to right,
              rgba(220,195,203,0) 0%,
              rgba(220,195,203,0.85) 18%,
              rgba(255,251,252,0.95) ${p.sheen}%,
              rgba(220,195,203,0.85) 82%,
              rgba(220,195,203,0) 100%
            )`,
            transform: `translateZ(${p.z}px) rotateY(${p.turn}deg)`,
            animationDuration: `${p.seconds}s`,
            animationDelay: `${p.delay}s`,
            ['--z' as string]: `${p.z}px`,
            ['--turn' as string]: `${p.turn}deg`,
          }}
        />
      ))}
    </div>
  );
}
