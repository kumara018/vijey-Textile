'use client';

import { useEffect, useRef, useState } from 'react';
import { ActionButton } from '@/components/system/Action';
import { Announce } from '@/components/system/States';

/**
 * The device-limit step, resolved IN the sign-in flow.
 *
 * The backend enforces MAX_DEVICES = 4 at session creation, which is the last
 * thing `verify-login-otp` does — so this arrives AFTER the customer has
 * already proved who they are with a password and an OTP. It is not a
 * rejection; it is one more decision on the way in. Treating it as an error
 * screen or a modal misrepresents where they are.
 *
 * `pending_token` is a 5-minute purpose-scoped action token, and
 * `sessions/evict-and-login` revokes the chosen device and returns a full
 * Token with NO re-authentication. So this resolves in place and lands the
 * customer exactly where they were going. No modal, no bounce, no dead end.
 *
 * Two details that matter and are easy to get wrong:
 *
 *  - THE CURRENT DEVICE IS NOT IN THE LIST. It has no session yet — that is
 *    the one being created. So there is no way to sign yourself out in order
 *    to sign yourself in, and the UI says so rather than leaving people to
 *    work it out.
 *  - THE TOKEN EXPIRES IN FIVE MINUTES. Someone who walks away and comes back
 *    gets a 401 "This request has expired". That must return them to the start
 *    with their identifier kept, not show a raw error.
 */

export interface DeviceSession {
  id: number;
  device_name?: string | null;
  os_name?: string | null;
  browser_name?: string | null;
  device_type?: string | null;
  location?: string | null;
  created_at?: string | null;
  last_active_at?: string | null;
}

/** "active 2 hours ago" — a person reads elapsed time faster than a timestamp. */
export function relativeTime(iso?: string | null): string {
  if (!iso) return 'Last active unknown';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Last active unknown';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Active now';
  if (mins < 60) return `Active ${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Active ${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `Active ${days} day${days === 1 ? '' : 's'} ago`;
}

const TYPE_LABEL: Record<string, string> = {
  mobile: 'Phone',
  tablet: 'Tablet',
  desktop: 'Computer',
};

/** Everything a person needs to recognise which of their devices this is. */
export function describeDevice(s: DeviceSession): string {
  const parts = [s.device_name, s.os_name, s.browser_name].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Unrecognised device';
}

export default function DeviceChoice({
  sessions,
  onChoose,
  busyId,
  error,
}: {
  sessions: DeviceSession[];
  onChoose: (id: number) => void;
  busyId: number | null;
  error?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState('');

  // Arriving here is a change of task, not a change of page — move focus so a
  // keyboard or screen-reader user is not left on the OTP field that vanished.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1500);
    return () => clearTimeout(t);
  }, [announcement]);

  return (
    <div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-xl font-light text-paper focus:outline-none"
      >
        You&rsquo;re signed in on four devices
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-muted">
        That&rsquo;s the maximum. Sign one out to continue on this device — you won&rsquo;t need
        to enter your password again.
      </p>
      <p className="mt-2 text-xs text-paper-faint">
        This device isn&rsquo;t listed: it&rsquo;s the one you&rsquo;re adding.
      </p>

      <Announce message={announcement} />

      {error && (
        <p role="alert" className="mt-5 text-xs text-brass-bright">
          {error}
        </p>
      )}

      <ul className="mt-7">
        {sessions.map((s) => {
          const busy = busyId === s.id;
          const label = describeDevice(s);
          return (
            <li key={s.id} className="border-t border-ink-edge/60 py-5 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-rule uppercase text-paper-faint">
                    {TYPE_LABEL[s.device_type ?? ''] ?? 'Device'}
                  </p>
                  <p className="mt-1.5 text-paper">{label}</p>
                  {s.location && <p className="mt-1 text-xs text-paper-faint">{s.location}</p>}
                  <p
                    className="mt-1 text-xs text-paper-faint"
                    title={s.last_active_at ? new Date(s.last_active_at).toLocaleString() : undefined}
                  >
                    {relativeTime(s.last_active_at)}
                  </p>
                </div>

                <ActionButton
                  tone="quiet"
                  arrow={false}
                  disabled={busy || busyId !== null}
                  onClick={() => {
                    setAnnouncement(`Signing out ${label}.`);
                    onChoose(s.id);
                  }}
                  aria-label={`Sign out ${label} and continue on this device`}
                  className="shrink-0"
                >
                  {busy ? 'Signing out…' : 'Sign out'}
                </ActionButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
