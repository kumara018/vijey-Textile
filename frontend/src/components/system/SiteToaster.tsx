'use client';

import { Toaster, ToastBar, type Toast } from 'react-hot-toast';

/**
 * Notifications, in the shop's own hand.
 *
 * WHAT THIS REPLACES. react-hot-toast's default card: a white rounded pill
 * with a coloured tick, dropped on top of a site that has no white, no pill
 * radii and no icon set of that weight anywhere else. Restyling it through
 * `toastOptions.style` — which is what was here — only repaints the box. The
 * tick, the type and the shape stayed the library's, and it read as something
 * bolted on rather than part of the shop. It is also the single most-seen
 * surface after the header, because it fires on every add-to-cart.
 *
 * WHY IT IS DONE HERE RATHER THAN AT THE CALL SITES. There are eight
 * `toast.success` / `toast.error` calls across the app and no reason for any
 * of them to know what a notification looks like. The render prop intercepts
 * every toast, whatever raised it, so appearance lives in one file and the
 * call sites keep saying only what happened.
 *
 * THE DESIGN IS THE SITE'S, not a themed version of the library's:
 *
 *   A SQUARE CARD with a hairline edge. Nothing on this site has a 12px
 *   radius; the plates, the fields and the buttons are all square or nearly.
 *
 *   A CERISE RULE DOWN THE LEADING EDGE instead of an icon — the same
 *   vocabulary as the footer's selvedge and the rules that grow under links
 *   on hover. Success and failure differ by the colour of that rule, so the
 *   status is legible before the words are read, and no glyph is needed.
 *
 *   THE UPPERCASE RULE LABEL says the CATEGORY, the line under it says the
 *   thing. Same two-level pattern as the Contact and Help menus, so a
 *   notification reads like the rest of the shop's furniture.
 *
 * `ToastBar` is kept as the wrapper because it owns the enter and exit
 * animation and respects the library's dismiss timing; only its children are
 * replaced. Colours come from the palette, so this follows any future relight
 * without being touched.
 */
export default function SiteToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={10}
      toastOptions={{ duration: 3200 }}
    >
      {(t: Toast) => (
        <ToastBar
          toast={t}
          style={{
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
            maxWidth: 'min(92vw, 24rem)',
          }}
        >
          {({ message }) => {
            const bad = t.type === 'error';
            return (
              <div
                className={`flex w-full items-stretch border bg-ink-deep shadow-[0_6px_24px_-12px_rgba(43,33,24,0.35)] ${
                  bad ? 'border-critical/50' : 'border-ink-edge'
                }`}
              >
                {/* The rule, not an icon. Colour carries the status. */}
                <span
                  aria-hidden="true"
                  className={`w-[3px] shrink-0 ${bad ? 'bg-critical' : 'bg-brass-bright'}`}
                />
                <div className="min-w-0 px-4 py-3">
                  <span
                    className={`block text-rule uppercase ${
                      bad ? 'text-critical' : 'text-brass-bright'
                    }`}
                  >
                    {bad ? 'Something went wrong' : 'Done'}
                  </span>
                  {/* The library hands `message` back as a node, so whatever a
                      call site passed renders unchanged — only its dress
                      changes. */}
                  <span className="mt-1 block text-sm leading-snug text-paper [&>*]:!m-0 [&>*]:!p-0">
                    {message}
                  </span>
                </div>
              </div>
            );
          }}
        </ToastBar>
      )}
    </Toaster>
  );
}
