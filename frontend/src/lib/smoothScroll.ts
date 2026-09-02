'use client';

/**
 * ONE HANDLE ON THE PAGE'S SCROLL — AND ONE RULE ABOUT WHAT LENIS MAY EAT.
 *
 * Lenis takes the window's scroll away from the browser. It listens for wheel
 * events, calls preventDefault() on them, and writes the scroll position
 * itself on every frame. Two things follow from that, and both of them were
 * live bugs on this shop.
 *
 * 1. window.scrollTo() is no longer how you move the page. Lenis keeps its own
 *    target offset and writes that back on the next frame, so a native jump is
 *    either lost in the race or actively undone. Anything that wants to move
 *    the page has to ask LENIS, not the window — which is what the registry
 *    below exists to make possible from components that never see the
 *    instance. ThreeProvider owns it; everyone else borrows it through here.
 *
 * 2. Lenis eats the wheel EVERYWHERE, including over a scrollable panel nested
 *    inside the page. Measured on the live site rather than assumed: a wheel
 *    event dispatched inside a nested `overflow-y-auto` div came back with
 *    defaultPrevented === true. That is precisely the reported symptom — a
 *    dialog you can only scroll by catching the scrollbar and dragging it,
 *    because the wheel does nothing at all.
 *
 *    Lenis's escape hatch is the `prevent` predicate: return true for a node
 *    and Lenis leaves the event alone for the browser to handle natively. The
 *    documented alternative is tagging each container with
 *    `data-lenis-prevent`, and that was rejected on purpose — it means finding
 *    every scrollable panel across two shops today (there are a dozen: the
 *    admin dialogs, the account menu, the mobile nav, the error stack traces,
 *    the thumbnail rail) and then remembering to tag the next one forever.
 *    shouldPreventSmoothing() asks the only question that actually matters,
 *    so a panel added tomorrow is correct without anybody remembering this.
 */

type ScrollTarget = number | string | HTMLElement;

type ScrollOptions = {
  /** Pixels to add to a resolved element's position — negative leaves air above it. */
  offset?: number;
};

/**
 * The slice of Lenis this module needs. Typed structurally rather than
 * imported so that nothing here drags the Lenis chunk into a bundle — the
 * whole point of ThreeProvider's dynamic import is that most routes never
 * download it.
 */
export type PageScroller = {
  scrollTo: (target: number, options?: { immediate?: boolean }) => void;
  stop: () => void;
  start: () => void;
};

let scroller: PageScroller | null = null;

/** ThreeProvider calls this when Lenis starts, and with null when it tears down. */
export function registerScroller(next: PageScroller | null): void {
  scroller = next;
}

/**
 * Move the page.
 *
 * INSTANT AND NATIVE, ALWAYS — and that is a measured decision, not a
 * shortcut. Three mechanisms were tried against a running Lenis on the dev
 * server:
 *
 *   window.scrollTo({behavior:'smooth'})  did not move the page AT ALL
 *   window.scrollTo({behavior:'auto'})    moved it, and it stayed moved
 *   lenis.scrollTo(...)                   works, when you can reach the instance
 *
 * The first is the trap. A smooth native scroll is a slow animation, and Lenis
 * overwrites the scroll position on every frame for the whole duration, so the
 * page never travels — silently, with no error anywhere. The first version of
 * this function used exactly that as its "no Lenis registered" fallback, which
 * meant a missing registration degraded into doing nothing rather than into
 * doing the plain thing.
 *
 * So the native instant scroll leads, unconditionally: Lenis resynchronises
 * itself from the resulting scroll event, and on the visits where Lenis never
 * starts at all it is simply the whole answer. The instance, when it is
 * reachable, is then told directly as well, so its own target offset matches
 * immediately instead of being corrected a frame later.
 */
export function scrollPageTo(target: ScrollTarget, options: ScrollOptions = {}): void {
  if (typeof window === 'undefined') return;

  let top: number;
  if (typeof target === 'number') {
    top = target;
  } else {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;
    top = element.getBoundingClientRect().top + window.scrollY + (options.offset ?? 0);
  }
  top = Math.max(0, top);

  window.scrollTo({ top, behavior: 'auto' });
  scroller?.scrollTo(top, { immediate: true });
}

/**
 * Freeze the page behind a dialog.
 *
 * Counted rather than boolean: closing one dialog opened over another must not
 * unfreeze the page while the first is still up. `overflow: hidden` alone is
 * not enough while Lenis is running — it keeps its rAF loop and keeps writing
 * scroll positions — so the scroller is stopped too, and started again only
 * when the last lock is released.
 */
let locks = 0;
let restoreOverflow = '';

export function lockPageScroll(): void {
  if (typeof document === 'undefined') return;
  locks += 1;
  if (locks > 1) return;

  restoreOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  scroller?.stop();
}

export function unlockPageScroll(): void {
  if (typeof document === 'undefined') return;
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;

  document.body.style.overflow = restoreOverflow;
  scroller?.start();
}

/**
 * Lenis's `prevent` predicate: true means "this is not yours, leave it to the
 * browser". Lenis walks the ancestors of whatever the wheel landed on and asks
 * this about each one.
 *
 * The document itself is the one thing Lenis IS for, so the walk must not
 * disqualify it — html and body routinely report as scrollable, and returning
 * true for either would silently switch smooth scrolling off site-wide.
 *
 * Order matters for cost. This runs per ancestor per wheel event, so the
 * attribute check (free) comes first, then the overflow measurement, and
 * getComputedStyle — the only genuinely expensive call — runs only for the few
 * elements that actually have something to scroll.
 */
export function shouldPreventSmoothing(node: HTMLElement): boolean {
  if (!node || node.nodeType !== 1) return false;
  if (node === document.body || node === document.documentElement) return false;

  // The standard Lenis opt-out, still honoured for anything that wants to be
  // explicit — including elements that scroll horizontally only.
  if (node.hasAttribute('data-lenis-prevent')) return true;

  if (node.scrollHeight <= node.clientHeight + 1) return false;

  const overflowY = getComputedStyle(node).overflowY;
  return overflowY === 'auto' || overflowY === 'scroll';
}
