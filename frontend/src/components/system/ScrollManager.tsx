'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { scrollPageTo } from '@/lib/smoothScroll';

/**
 * CLICKING THE SHOP'S NAME TAKES YOU TO THE TOP OF THE SHOP.
 *
 * Every large store behaves this way and this one did not. Reproduced on the
 * live site before it was written: scrolled to 2000px on the homepage, clicked
 * the masthead, and landed at 2000px on the homepage.
 *
 * Nothing was broken in the ordinary sense — it is a gap between two correct
 * behaviours. Next resets the scroll when the ROUTE changes, and the shop's
 * own reset (in ThreeProvider, where Lenis lives) is keyed on `pathname`. A
 * link from `/` to `/` changes neither, so neither fires, and the page simply
 * stays where it was. Same gap, same silence, when a shelf filter appends a
 * query string to the path you are already on.
 *
 * Handled once here, on the document, rather than as an onClick added to the
 * masthead — because the masthead is not the only link that does this. The
 * footer signs off with the shop's name, the nav offers the shelf while you
 * are standing on the shelf, and every category chip is a link to the page
 * you are already reading. One listener covers all of them, and covers the
 * ones added later.
 *
 * The guards below are the standard set for intercepting a click on a link:
 * anything that is not a plain left-click on a same-origin, same-page,
 * non-anchored target is left entirely alone.
 */
export default function ScrollManager() {
  const pathname = usePathname();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Modified clicks open tabs and windows; those are not this page's
      // business.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor) return;

      if (anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      // A hash link is a request to go to a PARTICULAR place on the page. It
      // is the one case where scrolling to the top is the opposite of what was
      // asked for.
      if (url.hash) return;

      // A genuine route change already resets on its own. Only the same page
      // needs help — including the same path carrying a different query, which
      // is what a shelf filter is.
      if (url.pathname !== pathname) return;

      scrollPageTo(0);
    };

    /*
     * CAPTURE, and no `defaultPrevented` guard — both for the same reason.
     *
     * The first version of this listened in the bubble phase and skipped any
     * click that had already been prevented, which is the usual courtesy. It
     * did nothing at all, and the reason is that the courtesy is wrong here:
     * React attaches its handlers at the app's root container, BELOW the
     * document, so Next's Link had already called preventDefault() — which is
     * simply how it takes over a navigation — by the time this ran. Every
     * single in-app link looked to it like a click somebody else had handled.
     *
     * Capture runs before any of that, which is also what makes it robust
     * against a handler in between that stops propagation.
     */
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  return null;
}
