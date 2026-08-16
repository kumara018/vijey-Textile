'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authAPI } from '@/lib/api';
import AuthShell from '@/components/system/AuthShell';
import { Field, Step } from '@/components/system/Field';
import { ActionButton } from '@/components/system/Action';
import { Announce } from '@/components/system/States';

/**
 * Forgotten password.
 *
 * identifier → code + new password → back to sign in.
 *
 * `?identifier=` carries what was typed on the sign-in screen, so the flow
 * never asks for it twice.
 *
 * ON THE COPY, DELIBERATELY:
 *
 * The server currently returns an `email_hint` for a known account and a
 * generic message for an unknown one — which is an account-enumeration leak
 * (AUTH-SPEC R2). When that is fixed, `email_hint` disappears and any screen
 * that depended on it to tell the customer WHICH inbox to check would read as
 * broken.
 *
 * So this screen never depends on it. The standfirst says "the email address
 * registered to this account" unconditionally, and the hint is shown only as a
 * bonus when present. The day R2 lands, nothing here needs to change and
 * nothing degrades — which is the whole point of writing the copy this way
 * before the fix rather than after it.
 */

type Stage = 'identifier' | 'reset';

function ForgotInner() {
  const params = useSearchParams();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('identifier');
  const [identifier, setIdentifier] = useState(params.get('identifier')?.trim() ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hint, setHint] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const identifierRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === 'identifier') identifierRef.current?.focus();
    if (stage === 'reset') codeRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1500);
    return () => clearTimeout(t);
  }, [announcement]);

  const submitIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { setError('Enter your phone number or email.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await authAPI.forgotPassword({ identifier: identifier.trim() });
      // Bonus only. The flow does not depend on this existing — see the note
      // at the top of this file.
      setHint(res.data?.email_hint || '');
      setStage('reset');
      setAnnouncement('If that account exists, a code is on its way.');
    } catch (err: any) {
      if (!err?.response) setError('We could not reach the shop. Check your connection and try again.');
      else setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Enter the code we sent you.'); return; }
    if (password.length < 8) { setError('Your new password needs at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    setError('');
    try {
      await authAPI.resetPassword({
        identifier: identifier.trim(),
        // schemas.OTPVerify: otp_code (not otp), and confirm_password is
        // required — the server compares the two itself.
        otp_code: code.trim(),
        new_password: password,
        confirm_password: confirm,
      });
      // Straight to sign-in with the identifier kept, so the very next thing
      // they do is the thing they came to do.
      router.replace(`/auth/login?identifier=${encodeURIComponent(identifier.trim())}`);
    } catch (err: any) {
      if (!err?.response) setError('We could not reach the shop. Check your connection and try again.');
      else setError(err.response?.data?.detail || 'That code is not right, or it has expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={stage === 'identifier' ? 'Reset your password' : 'Choose a new password'}
      standfirst={
        stage === 'identifier'
          ? 'Tell us the phone number or email on your account and we will send a code to the email address registered to it.'
          : hint
            ? `Enter the code we sent to ${hint}, then choose a new password.`
            : 'Enter the code we sent to the email address registered to this account, then choose a new password.'
      }
      footer={
        <p className="text-center text-sm text-paper-faint">
          Remembered it?{' '}
          <Link
            href="/auth/login"
            className="text-paper underline underline-offset-4 transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <Announce message={announcement} />

      {stage === 'identifier' && (
        <Step stepKey="identifier">
          <form onSubmit={submitIdentifier} noValidate>
            <Field
              ref={identifierRef}
              label="Phone or email"
              name="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
              error={error || undefined}
            />
            <div className="mt-9">
              <ActionButton type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send code'}
              </ActionButton>
            </div>
          </form>
        </Step>
      )}

      {stage === 'reset' && (
        <Step stepKey="reset">
          <form onSubmit={submitReset} noValidate className="space-y-7">
            <Field
              ref={codeRef}
              label="Six-digit code"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              className="tracking-[0.4em]"
            />
            <Field
              label="New password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              error={error || undefined}
              hint="At least 8 characters, with an uppercase, a lowercase, a number and a symbol."
            />
            <Field
              label="Confirm new password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            />
            <div className="pt-2">
              <ActionButton type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save and sign in'}
              </ActionButton>
            </div>
          </form>
        </Step>
      )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotInner />
    </Suspense>
  );
}
