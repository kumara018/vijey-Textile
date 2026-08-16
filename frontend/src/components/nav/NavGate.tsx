'use client';

import { usePathname } from 'next/navigation';
import OverlayNav from './OverlayNav';

/**
 * Decides whether the site navigation appears at all.
 *
 * The auth screens are a single focused card on an otherwise empty page —
 * no nav, no footer, no competing links. The only way back to the store is
 * the logo above the card. That is deliberate: every extra affordance on a
 * sign-in page is an invitation to abandon it, and the one escape hatch
 * people actually look for is the wordmark.
 *
 * A separate gate rather than an early return inside OverlayNav, so that
 * component's hook order stays untouched — an early return above its hooks
 * would be a conditional-hook bug, and below them it would still run every
 * effect and subscription on a page that never shows it.
 */
export default function NavGate() {
  const pathname = usePathname();
  if (pathname.startsWith('/auth')) return null;
  return <OverlayNav />;
}

/**
 * The same rule for the cinematic overlays.
 *
 * The letterbox bars and the sound toggle are atmosphere for a storefront.
 * On a sign-in page the toggle is a fixed button sitting in the corner of an
 * otherwise empty screen, which is exactly the "one more thing to click
 * instead of signing in" the stripped chrome exists to remove — and it was
 * still rendering after the nav and footer were gone.
 */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/auth')) return null;
  return <>{children}</>;
}
