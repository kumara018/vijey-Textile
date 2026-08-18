'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/lib/api';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { Field } from '@/components/system/Field';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { Announce } from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * Closing your account.
 *
 * The most destructive thing a customer can do here, so the page is built
 * around one principle: NOBODY SHOULD DELETE AN ACCOUNT BY ACCIDENT, AND
 * NOBODY SHOULD BE TRAPPED IN ONE.
 *
 * The old page led with two side-by-side cards, the red one visually louder,
 * and described deactivation as "Like Amazon" — which tells a customer nothing
 * about their own data. Both paths now state exactly what happens, in the same
 * weight, and the reversible one is presented first because it is the right
 * answer for most people who arrive here.
 *
 * Deletion is permanent, so it says so plainly and lists what goes. It is
 * confirmed by an OTP sent to the registered email — proof the person asking
 * is the person who owns the account, which matters most on the one action
 * that cannot be undone.
 *
 * There is no scare styling, no red, no warning triangle. A customer choosing
 * to leave is making a legitimate decision and is owed a clear description of
 * its consequences, not an attempt to frighten them out of it.
 */

type Mode = 'choose' | 'deactivate' | 'delete';
type Step = 'explain' | 'otp';

function DeleteAccountInner() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('choose');
  const [step, setStep] = useState<Step>('explain');
  const [otp, setOtp] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const otpRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (step === 'otp') otpRef.current?.focus();
    else headingRef.current?.focus();
  }, [step, mode]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1800);
    return () => clearTimeout(t);
  }, [announcement]);

  const sendCode = async (which: 'deactivate' | 'delete') => {
    setBusy(true);
    setError('');
    try {
      const res = which === 'deactivate'
        ? await authAPI.requestDeactivateAccount()
        : await authAPI.requestDeleteAccount();
      setEmailHint(res.data?.email_hint || '');
      setMode(which);
      setStep('otp');
      setAnnouncement('We sent a confirmation code to your registered email.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'We could not send a code just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) { setError('Enter the code we sent you.'); return; }
    setBusy(true);
    setError('');
    try {
      if (mode === 'deactivate') {
        await authAPI.confirmDeactivateAccount({ otp_code: otp.trim() });
      } else {
        await authAPI.confirmDeleteAccount({ otp_code: otp.trim() });
      }
      // Either way the session is over. logout() clears the token and cookie
      // and returns to the storefront.
      logout();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'That code is not right, or it has expired.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <PageShell rhythm="tight">
      <Announce message={announcement} />

      <PageHeader
        eyebrow="Your account"
        title="Closing your account"
        standfirst="Two options, and they are genuinely different. Read both before you choose — one can be undone and one cannot."
      />

      <div className="max-w-[46rem]">
        <h2 ref={headingRef} tabIndex={-1} className="sr-only focus:outline-none">
          {step === 'otp' ? 'Confirm with a code' : 'Choose what to do'}
        </h2>

        {error && <p role="alert" className="mb-7 text-sm text-brass-bright">{error}</p>}

        {step === 'explain' && (
          <>
            {/* ── Pause ────────────────────────────────────────────── */}
            <section className="border-t border-ink-edge/60 pt-8">
              <div className="flex items-baseline gap-5">
                <span className="text-rule tabular-nums text-brass-bright">01</span>
                <h3 className="font-display text-band font-light text-paper">Pause it</h3>
              </div>
              <p className="mt-6 max-w-[54ch] text-lede text-paper-muted">
                Your account is suspended for <strong className="text-paper">7 days</strong>. Nothing
                is deleted — your orders, addresses and kept pieces stay exactly as they are. Sign
                in again at any point in those 7 days and everything comes back.
              </p>
              <p className="mt-4 max-w-[54ch] text-sm text-paper-faint">
                If you do not sign in within 7 days, the account is deleted permanently.
              </p>
              <div className="mt-7">
                <ActionButton arrow={false} disabled={busy} onClick={() => sendCode('deactivate')}>
                  {busy ? 'Sending…' : 'Pause my account'}
                </ActionButton>
              </div>
            </section>

            {/* ── Delete ───────────────────────────────────────────── */}
            <section className="mt-[7vh] border-t border-ink-edge/60 pt-8">
              <div className="flex items-baseline gap-5">
                <span className="text-rule tabular-nums text-brass-bright">02</span>
                <h3 className="font-display text-band font-light text-paper">Delete it permanently</h3>
              </div>
              <p className="mt-6 max-w-[54ch] text-lede text-paper-muted">
                This cannot be undone. There is no grace period and no way for us to restore it
                afterwards.
              </p>
              <ul className="mt-6 max-w-[54ch] space-y-2.5 text-sm text-paper-muted">
                {[
                  'Your sign-in, name, email and phone number',
                  'Your saved addresses',
                  'Your kept pieces and your bag',
                  'Your reviews',
                ].map((line) => (
                  <li key={line} className="flex items-baseline gap-3 border-b border-ink-edge/40 pb-2.5">
                    <span aria-hidden="true" className="text-paper-faint">—</span>
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-[54ch] text-sm text-paper-faint">
                Past orders and their invoices are kept, because we are required to hold sales
                records for tax purposes. They are no longer linked to a sign-in you can use.
              </p>
              <div className="mt-7">
                <ActionButton arrow={false} disabled={busy} onClick={() => sendCode('delete')}>
                  {busy ? 'Sending…' : 'Delete my account permanently'}
                </ActionButton>
              </div>
            </section>

            <div className="mt-[7vh] border-t border-ink-edge/60 pt-8">
              <ActionLink href="/account">Keep my account</ActionLink>
            </div>
          </>
        )}

        {step === 'otp' && (
          <form onSubmit={confirm} noValidate className="border-t border-ink-edge/60 pt-8">
            <h3 className="font-display text-band font-light text-paper">
              {mode === 'deactivate' ? 'Confirm pausing your account' : 'Confirm permanent deletion'}
            </h3>
            <p className="mt-5 max-w-[54ch] text-lede text-paper-muted">
              We sent a six-digit code to {emailHint || 'the email address registered to this account'}.
              {mode === 'delete' && (
                <> Entering it deletes your account immediately and permanently.</>
              )}
            </p>

            <div className="mt-8 max-w-xs">
              <Field
                ref={otpRef}
                label="Six-digit code"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                className="tracking-[0.4em]"
              />
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-4">
              <ActionButton type="submit" arrow={false} disabled={busy}>
                {busy
                  ? 'Working…'
                  : mode === 'deactivate' ? 'Pause my account' : 'Delete permanently'}
              </ActionButton>
              <ActionButton
                tone="quiet"
                arrow={false}
                onClick={() => { setStep('explain'); setOtp(''); setError(''); }}
              >
                Go back
              </ActionButton>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}

export default function DeleteAccountPage() {
  return (
    <RouteErrorBoundary routeName="closing your account" fallbackHref="/account" fallbackLabel="Your account">
      <DeleteAccountInner />
    </RouteErrorBoundary>
  );
}
