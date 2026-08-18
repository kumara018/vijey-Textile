'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { performLogout } from '@/lib/auth';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { ActionButton, ActionLink } from '@/components/system/Action';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * Your account — a hub, and nothing else on it.
 *
 * THE MISTAKE THIS CORRECTS. This page used to carry every part of an account
 * at once: details, addresses, a password form, a device list, down one
 * scroll. That was a deliberate move away from the tab strip before it — tabs
 * hide two thirds of a settings page behind a click — and it over-corrected.
 * Opening your account to check an order and being shown "Current password /
 * New password / Confirm new password" is a page answering a question nobody
 * asked, and the shopkeeper said so.
 *
 * A password field is not something you look at; it is somewhere you go once
 * you have decided to change a password. Amazon, named as the standard, keeps
 * Your Account as a grid of destinations and Login & security on its own page.
 * The hub answers "what can I do here"; each page answers one of those and
 * nothing else.
 *
 * The same destinations sit in the menu under the account icon
 * (components/nav/AccountMenu.tsx), so none of them is ever more than one
 * click away from anywhere on the site — which is what "everything should be
 * in the account menu" asks for.
 *
 * The sections themselves were not rewritten. They moved, whole, to
 * /account/security and /account/addresses, because the error states, focus
 * management and announcements in them are real work and re-typing them would
 * have been the surest way to lose some of it.
 */

/* Typed up front so the admin entry, which alone carries `accent`, does not
   widen the array into a union TypeScript then refuses to read `accent` from. */
interface Place { label: string; note: string; href: string; accent?: boolean }

const PLACES: Place[] = [
  { label: 'Your orders',        note: 'Track, return or exchange', href: '/orders' },
  { label: 'Sign-in & security', note: 'Password and devices',      href: '/account/security' },
  { label: 'Saved addresses',    note: 'Where pieces are sent',     href: '/account/addresses' },
  { label: 'Kept pieces',        note: 'Everything you saved',      href: '/wishlist' },
  { label: 'Help & policies',    note: 'Shipping, returns, terms',  href: '/support' },
];

function AccountInner() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  if (!user) return null;

  const places = user.is_admin
    ? [...PLACES, { label: 'The workroom', note: 'Manage the shop', href: '/admin', accent: true }]
    : PLACES;

  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow="Your account"
        title={user.full_name || 'Your account'}
        standfirst={user.email}
      />

      {/**
        * Each tile carries its own hairline with a real gap rather than a
        * joined ruled block: the tile count is not fixed (the workroom exists
        * only for admins) and the column count changes at every breakpoint, so
        * any arrangement depending on a full last row shows an empty filled
        * cell on some screen.
        */}
      <nav aria-label="Your account" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {places.map(({ label, note, href, accent }) => (
          <Link
            key={label}
            href={href}
            className="group border border-ink-edge/70 p-7 transition-colors duration-500 hover:border-brass-bright/50 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright"
          >
            <span
              className={`block font-display text-[1.3rem] font-light leading-snug transition-colors duration-500 motion-reduce:transition-none ${
                accent ? 'text-brass-bright' : 'text-paper group-hover:text-white'
              }`}
            >
              {label}
            </span>
            <span className="mt-2 block text-rule uppercase text-paper-faint transition-colors duration-500 group-hover:text-paper-muted motion-reduce:transition-none">
              {note}
            </span>
          </Link>
        ))}
      </nav>

      {/* Leaving, in order of how permanent it is. These stay on the hub
          because they are one-line actions, not pages — a screen whose only
          content is a "Sign out" button would be worse than this. */}
      <div className="mt-[9vh] flex flex-col items-start gap-6 border-t border-ink-edge/60 pt-10">
        <p className="text-rule uppercase text-paper-faint">Leaving</p>

        {/* A navigation, not a sign-out. Signing out first cost you the
            session you arrived with the moment you changed your mind. */}
        <ActionLink href="/auth/login?switch=1" tone="quiet" arrow={false}>
          Switch account
        </ActionLink>
        <p className="-mt-3 max-w-[46ch] text-sm text-paper-faint">
          Opens the sign-in page so someone else can use their own account. You stay
          signed in here until they do — change your mind and nothing is lost.
        </p>

        <ActionButton tone="quiet" arrow={false} onClick={() => performLogout()}>
          Sign out
        </ActionButton>

        <ActionLink href="/account/delete" tone="quiet" arrow={false}>
          Close your account
        </ActionLink>
      </div>
    </PageShell>
  );
}

export default function AccountPage() {
  return (
    <RouteErrorBoundary routeName="your account" fallbackHref="/" fallbackLabel="Return home">
      <AccountInner />
    </RouteErrorBoundary>
  );
}
