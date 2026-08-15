/**
 * Cubic-bezier easing, evaluated per frame.
 *
 * Deliberately not a spring. A spring overshoots and settles, which is the
 * signature of app UI — it says "this control responded to you". Film camera
 * moves do not overshoot: a dolly is a heavy object on a track, it accelerates
 * slowly, travels, and decelerates into its mark. The long tail on these
 * curves is what makes a move read as weight rather than as animation.
 *
 * These are the same curves the CSS/GSAP layer uses, kept here so a camera move
 * and a DOM reveal that start together actually stay together.
 */

/**
 * Newton-Raphson solve for t given x on a cubic bezier with fixed endpoints
 * (0,0) and (1,1). CSS's cubic-bezier() does the same thing — the curve is
 * parametric, so you cannot read y directly from progress.
 */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a;
  const B = (a: number, b: number) => 3 * b - 6 * a;
  const C = (a: number) => 3 * a;

  const calc = (t: number, a: number, b: number) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t: number, a: number, b: number) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= (calc(t, x1, x2) - x) / d;
    }
    return calc(t, y1, y2);
  };
}

/** Long, weighted lead-in and a very long tail. The primary camera curve. */
export const easeCamera = bezier(0.22, 0.61, 0.24, 1.0);

/** Slightly quicker off the mark, for reveals that follow a move. */
export const easeReveal = bezier(0.33, 0.0, 0.16, 1.0);

/** Symmetrical, for continuous scroll-linked motion with no start or end. */
export const easeScroll = bezier(0.45, 0.05, 0.55, 0.95);

/**
 * Frame-rate independent progress toward a target.
 *
 * A fixed per-frame factor arrives twice as fast at 120Hz as at 60Hz, so the
 * same move feels different on different hardware. Normalising against a 60Hz
 * step fixes the rate without giving up exponential decay.
 */
export function approach(current: number, target: number, rate: number, delta: number): number {
  const k = 1 - Math.pow(1 - rate, Math.min(delta, 0.1) * 60);
  return current + (target - current) * k;
}

/** Reveal duration floor from the design system — never snappier than this. */
export const REVEAL_MS = 520;
