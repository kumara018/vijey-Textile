'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/lib/api';
import { redirectAfterLogin } from '@/lib/auth';
import AuthShell from '@/components/system/AuthShell';
import { Field, Step } from '@/components/system/Field';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { Announce } from '@/components/system/States';
import DeviceChoice, { type DeviceSession } from '@/components/auth/DeviceChoice';

/**
 * Sign in — progressive, one field at a time.
 *
 * THE FLOW
 *   identifier → password → code → (device choice, only if at the cap)
 *
 * The single field takes a phone number or an email with no type toggle,
 * because `_find_user` on the backend already resolves either. Once entered it
 * is echoed back as a quiet caption with an Edit affordance, so the customer
 * can see what they typed without it occupying a form control.
 *
 * WHY THE BRANCH TO REGISTRATION SITS AFTER THE PASSWORD, NOT BEFORE
 *
 * Amazon asks the server "does this account exist?" the moment you press
 * Continue, and branches immediately. That endpoint is an account-enumeration
 * oracle: anyone can walk a list of phone numbers and learn which belong to
 * customers. Amazon accepts that trade because they have rate limiting, bot
 * detection and device fingerprinting; this backend currently has none of
 * those, and its identifier is an Indian mobile number — densely packed and
 * cheap to enumerate — rather than a sparse email address.
 *
 * So the branch happens where the server already gives a uniform answer: the
 * existing 401 on `send-login-otp`, which is identical for "no such account"
 * and "wrong password". A returning customer signs in. A new one types one
 * wrong password and is then offered "Create an account with this number",
 * carrying the identifier forward. One extra keystroke, no new oracle.
 *
 * See AUTH-SPEC.md — the endpoint-based version is specified there and waits
 * on backend work.
 */

type Stage = 'identifier' | 'password' | 'code' | 'device';

function SignInInner() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [stage, setStage] = useState<Stage>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [emailHint, setEmailHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Set when the 401 arrives — offers registration without asking the server. */
  const [offerRegister, setOfferRegister] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Device-limit state
  const [pendingToken, setPendingToken] = useState('');
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [evictingId, setEvictingId] = useState<number | null>(null);

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const isAddMode = params.get('add') === '1';

  // Already signed in, and not deliberately adding another account.
  useEffect(() => {
    if (authLoading || !user || isAddMode) return;
    if (stage !== 'identifier' || identifier) return;
    router.replace(user.is_admin ? '/admin' : '/');
  }, [user, authLoading, isAddMode, router, stage, identifier]);

  // Focus follows the step. Without this a keyboard user has to tab back into
  // the form after every advance, which makes a three-step flow feel like
  // three separate pages.
  useEffect(() => {
    const el =
      stage === 'identifier' ? identifierRef.current
      : stage === 'password' ? passwordRef.current
      : stage === 'code' ? codeRef.current
      : null;
    el?.focus();
  }, [stage]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1500);
    return () => clearTimeout(t);
  }, [announcement]);

  const editIdentifier = () => {
    setStage('identifier');
    setError('');
    setOfferRegister(false);
    setPassword('');
  };

  const submitIdentifier = (e: React.FormEvent) => {
    e.preventDefault();
    const v = identifier.trim();
    if (!v) { setError('Enter your phone number or email to continue.'); return; }
    setError('');
    setStage('password');
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    setError('');
    setOfferRegister(false);
    try {
      const res = await authAPI.sendLoginOtp({ identifier: identifier.trim(), password });
      setEmailHint(res.data?.email_hint || '');
      setStage('code');
      setAnnouncement('We sent a code to your registered email.');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        // Uniform on the server for "no account" and "wrong password" — so we
        // offer both readings rather than claiming to know which it was.
        setError('That password is not right for this phone or email.');
        setOfferRegister(true);
      } else if (status === 403) {
        setError(err.response?.data?.detail || 'This account cannot sign in right now.');
      } else if (!err?.response) {
        setError('We could not reach the shop. Check your connection and try again.');
      } else {
        setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Shared by the code step and the device step — both end in a real token.
   *
   * redirectAfterLogin does a full document navigation rather than a router
   * push, deliberately: a hard reload guarantees every provider re-reads the
   * new token instead of racing a client transition.
   */
  const finish = (token: string, u: { is_admin?: boolean }) => {
    login(token, u as never);
    redirectAfterLogin(Boolean(u?.is_admin));
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Enter the code we sent you.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await authAPI.verifyLoginOtp({ identifier: identifier.trim(), otp: code.trim() });
      finish(res.data.access_token, res.data.user);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      // The device cap is enforced at session creation — the very last thing
      // verify-login-otp does. So this 409 means the code was CORRECT.
      if (err?.response?.status === 409 && detail?.code === 'device_limit') {
        setPendingToken(detail.pending_token);
        setSessions(detail.sessions ?? []);
        setStage('device');
        setError('');
      } else if (!err?.response) {
        setError('We could not reach the shop. Check your connection and try again.');
      } else {
        setError(typeof detail === 'string' ? detail : 'That code is not right, or it has expired.');
      }
    } finally {
      setBusy(false);
    }
  };

  const chooseDevice = async (sessionId: number) => {
    setEvictingId(sessionId);
    setError('');
    try {
      const res = await authAPI.evictAndLogin({ pending_token: pendingToken, session_id: sessionId });
      finish(res.data.access_token, res.data.user);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        // pending_token lives 5 minutes. Expired is not an error the customer
        // caused, so it returns to the code step with the identifier kept.
        setStage('code');
        setCode('');
        setError('That took a little too long — enter a fresh code to continue.');
      } else if (status === 404) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setError('That device was already signed out. Choose another.');
      } else {
        setError(err?.response?.data?.detail || 'We could not sign that device out. Try another.');
      }
    } finally {
      setEvictingId(null);
    }
  };

  const titles: Record<Stage, string> = {
    identifier: 'Sign in',
    password: 'Sign in',
    code: 'Check your email',
    device: 'One more thing',
  };

  return (
    <AuthShell
      title={titles[stage]}
      standfirst={
        stage === 'identifier'
          ? 'Use the phone number or email address on your account.'
          : stage === 'code'
            ? emailHint
              ? `We sent a six-digit code to ${emailHint}.`
              : 'We sent a six-digit code to your registered email.'
            : undefined
      }
      footer={
        stage === 'identifier' ? (
          <p className="text-center text-sm text-paper-faint">
            New here?{' '}
            <Link
              href="/auth/register"
              className="text-paper underline underline-offset-4 transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
            >
              Create an account
            </Link>
          </p>
        ) : undefined
      }
    >
      <Announce message={announcement} />

      {/* The identifier, once given, is context rather than a field. */}
      {stage !== 'identifier' && (
        <div className="mb-7 flex items-baseline justify-between gap-4 border-b border-ink-edge/60 pb-4">
          <span className="min-w-0 truncate text-sm text-paper-muted">{identifier}</span>
          <ActionButton tone="quiet" arrow={false} onClick={editIdentifier} className="shrink-0">
            Edit
          </ActionButton>
        </div>
      )}

      {stage === 'identifier' && (
        <Step stepKey="identifier">
          <form onSubmit={submitIdentifier} noValidate>
            <Field
              ref={identifierRef}
              label="Phone or email"
              name="identifier"
              autoComplete="username"
              inputMode="email"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
              error={error || undefined}
            />
            <div className="mt-9">
              <ActionButton type="submit">Continue</ActionButton>
            </div>
          </form>
        </Step>
      )}

      {stage === 'password' && (
        <Step stepKey="password">
          <form onSubmit={submitPassword} noValidate>
            <Field
              ref={passwordRef}
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); setOfferRegister(false); }}
              error={error || undefined}
            />

            <div className="mt-9 flex flex-col items-start gap-6">
              <ActionButton type="submit" disabled={busy}>
                {busy ? 'Checking…' : 'Continue'}
              </ActionButton>

              {/* Offered only after a failed attempt — the server never told us
                  whether this account exists, and neither does this wording. */}
              {offerRegister && (
                <ActionLink
                  href={`/auth/register?identifier=${encodeURIComponent(identifier.trim())}`}
                  tone="quiet"
                >
                  Create an account with this
                </ActionLink>
              )}

              <ActionLink
                href={`/auth/forgot-password?identifier=${encodeURIComponent(identifier.trim())}`}
                tone="quiet"
                arrow={false}
              >
                Forgotten your password?
              </ActionLink>
            </div>
          </form>
        </Step>
      )}

      {stage === 'code' && (
        <Step stepKey="code">
          <form onSubmit={submitCode} noValidate>
            <Field
              ref={codeRef}
              label="Six-digit code"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              error={error || undefined}
              className="tracking-[0.4em]"
            />
            <div className="mt-9">
              <ActionButton type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </ActionButton>
            </div>
          </form>
        </Step>
      )}

      {stage === 'device' && (
        <Step stepKey="device">
          <DeviceChoice
            sessions={sessions}
            onChoose={chooseDevice}
            busyId={evictingId}
            error={error || undefined}
          />
        </Step>
      )}
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
