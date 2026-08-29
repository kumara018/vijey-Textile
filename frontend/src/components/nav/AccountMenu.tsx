'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { performLogout } from '@/lib/auth';

/**
 * The account menu that opens under the person icon.
 *
 * WHAT IT REPLACES. The icon was a plain link to /account. One click, one
 * destination, and every other thing a signed-in customer might want —
 * their orders, the pieces they kept, a return, signing out, signing in as
 * somebody else — was a second navigation away, discoverable only by landing
 * on the account page first and reading it.
 *
 * Amazon's answer is the one asked for by name: the icon opens a short menu
 * of the things you actually came for, with the account-level actions at the
 * top and the places below. That structure is right and it is borrowed
 * wholesale. What is not borrowed is the look — this is ink and brass, a
 * single hairline panel, no shadows stacked on shadows, no blue.
 *
 * BEHAVIOUR, AND WHY EACH PIECE IS HERE:
 *
 *   It closes on Escape, on a click outside, and on route change (the Link
 *   onClick), because a menu that survives navigation is a menu that covers
 *   the page you just asked for.
 *
 *   Focus returns to the trigger on Escape. Without that, dismissing with the
 *   keyboard drops focus to the top of the document and a keyboard user has
 *   to tab back through the whole header.
 *
 *   It is a real <button> with aria-expanded, not a div with a click handler,
 *   so it is reachable and announced.
 *
 *   Signed out, it does not pretend to be a menu — it goes straight to the
 *   sign-in page. A menu whose every item says "sign in first" is a menu that
 *   wastes a click.
 */

export default function AccountMenu() {
  const { user, sessions, switchAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (!user) {
    return (
      <Link
        href="/auth/login"
        aria-label="Sign in"
        className="flex h-10 w-10 items-center justify-center rounded-full text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
      >
        <User size={18} />
      </Link>
    );
  }

  const first = (user.full_name || '').trim().split(' ')[0] || 'your account';

  /* Every saved account except the one currently active. Filtered by id
     rather than by token, because a refreshed token would otherwise make an
     account appear twice — once as itself and once as "another account". */
  const others = (sessions ?? []).filter((s) => s.user.id !== user?.id);

  const item =
    'block w-full px-5 py-2.5 text-left text-sm text-paper-muted transition-colors duration-300 hover:bg-ink-deep/[0.06] hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-maroon-300';

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account, ${first}`}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300 ${
          open ? 'text-paper' : 'text-paper-muted hover:text-paper'
        }`}
      >
        <User size={18} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Your account"
          className="absolute right-0 top-12 z-50 w-64 border border-ink-edge bg-night/95 py-2 backdrop-blur-md"
        >
          <p className="px-5 pb-2 pt-1 text-rule uppercase text-paper-faint">
            Hello, {first}
          </p>

          <Link href="/account" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Your account
          </Link>
          {/**
            * THE ACCOUNTS ALREADY SIGNED IN, SWITCHED TO IN ONE TAP.
            *
            * This was a link to the sign-in page, which meant switching back
            * to an account you had signed into five minutes ago asked for the
            * password and the emailed code all over again. The session was
            * never lost — AuthContext keeps a live token per account in
            * `sessions`, and `switchAccount` applies one instantly. The data
            * was there the whole time; only the menu did not use it.
            *
            * Amazon and Google both work this way: the accounts you have
            * signed into are listed, and moving between them is immediate.
            * Proving you own an account is what signing IN is for; proving it
            * again to return to a session you already hold is a toll on the
            * customer for nothing.
            *
            * Anyone not already in the list still signs in properly, which is
            * the link at the bottom.
            */}
          {others.length > 0 && (
            <>
              <div className="my-2 h-px bg-ink-raised" />
              <p className="px-5 pb-1 text-rule uppercase text-paper-faint">
                Also signed in
              </p>
              {others.map((s) => (
                <button
                  key={s.user.id}
                  type="button"
                  role="menuitem"
                  className={item}
                  onClick={async () => { setOpen(false); await switchAccount(s); }}
                >
                  <span className="block truncate">{s.user.full_name?.split(' ')[0] || s.user.email}</span>
                  <span className="block truncate text-caption text-paper-faint">
                    {s.user.is_admin ? 'Admin' : s.user.email}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* A navigation, not a sign-out — you stay signed in until someone
              else actually signs in. */}
          <Link href="/auth/login?switch=1" role="menuitem" className={item} onClick={() => setOpen(false)}>
            {others.length > 0 ? 'Use another account' : 'Switch account'}
          </Link>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => { setOpen(false); performLogout(); }}
          >
            Sign out
          </button>

          <div className="my-2 h-px bg-ink-raised" />

          <Link href="/orders" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Your orders
          </Link>
          <Link href="/wishlist" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Kept pieces
          </Link>
          <Link href="/account/addresses" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Saved addresses
          </Link>
          <Link href="/account/security" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Sign-in &amp; security
          </Link>
          <Link href="/support" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Help &amp; returns
          </Link>

          {user.is_admin && (
            <>
              <div className="my-2 h-px bg-ink-raised" />
              <Link
                href="/admin"
                role="menuitem"
                className={`${item} text-brass-bright hover:text-brass-bright`}
                onClick={() => setOpen(false)}
              >
                The workroom
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
