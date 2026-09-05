'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/lib/api';
import { redirectAfterLogin } from '@/lib/auth';
import AuthShell from '@/components/system/AuthShell';
import { Field, Step } from '@/components/system/Field';
import { ActionButton } from '@/components/system/Action';
import { Announce } from '@/components/system/States';
import DeviceChoice, { type DeviceSession } from '@/components/auth/DeviceChoice';

/**
 * Create an account.
 *
 * Same shell, same chrome, same step motion as sign in — the two are one flow
 * and a customer bounced here from a failed sign-in should not feel they have
 * changed buildings.
 *
 * `?identifier=` carries whatever they typed on the sign-in screen. It is
 * routed into the email or the phone field depending on its shape, so nobody
 * types their number twice. That is the entire payoff of branching after the
 * 401 rather than asking the server whether the account exists.
 *
 * The password rules are shown as a live checklist rather than as an error
 * after submission. A rule you can only discover by failing is a bad rule, and
 * these are strict — the same five the backend enforces.
 */

const RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p), label: 'One lowercase letter' },
  { test: (p: string) => /\d/.test(p), label: 'One number' },
  { test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p), label: 'One special character' },
];

const looksLikeEmail = (v: string) => v.includes('@');
const tenDigits = (v: string) => v.replace(/\D/g, '').slice(-10);

type Stage = 'details' | 'code' | 'device';

function RegisterInner() {
  const { login } = useAuth();
  const params = useSearchParams();
  const prefill = params.get('identifier')?.trim() ?? '';

  const [stage, setStage] = useState<Stage>('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(looksLikeEmail(prefill) ? prefill : '');
  const [phone, setPhone] = useState(!looksLikeEmail(prefill) ? tenDigits(prefill) : '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const [pendingToken, setPendingToken] = useState('');
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [evictingId, setEvictingId] = useState<number | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Focus the first field that is still empty — someone arriving with their
  // number already filled should land on the name, not be sent back over it.
  useEffect(() => {
    if (stage === 'details') nameRef.current?.focus();
    if (stage === 'code') codeRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1500);
    return () => clearTimeout(t);
  }, [announcement]);

  const failedRules = RULES.filter((r) => !r.test(password));

  const validate = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.full_name = 'Enter your full name.';
    else if (!/^[a-zA-Z\s]+$/.test(fullName.trim())) e.full_name = 'Letters and spaces only.';
    if (!email.trim()) e.email = 'We need an email address to send your code to.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'That email address does not look right.';
    const ph = phone.replace(/\D/g, '');
    if (!ph) e.phone = 'Enter your mobile number.';
    else if (!/^[6-9]\d{9}$/.test(ph)) e.phone = 'Enter a 10-digit Indian mobile number starting 6–9.';
    if (!password) e.password = 'Choose a password.';
    else if (failedRules.length) e.password = 'This password does not meet all five rules yet.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitDetails = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setBusy(true);
    try {
      await authAPI.register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: `+91${phone.replace(/\D/g, '')}`,
        password,
      });
      setStage('code');
      setAnnouncement('We sent a code to your email and phone.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (!err?.response) setFormError('We could not reach the shop. Check your connection and try again.');
      else setFormError(typeof detail === 'string' ? detail : 'We could not create that account. Please check your details.');
    } finally {
      setBusy(false);
    }
  };

  const finish = (token: string, u: { is_admin?: boolean }) => {
    login(token, u as never);
    redirectAfterLogin(Boolean(u?.is_admin));
  };

  const submitCode = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!code.trim()) { setFormError('Enter the code we sent you.'); return; }
    setBusy(true);
    setFormError('');
    try {
      const res = await authAPI.verifyRegisterOtp({
        identifier: email.trim().toLowerCase(),
        otp_code: code.trim(),
      });
      finish(res.data.access_token, res.data.user);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 409 && detail?.code === 'device_limit') {
        setPendingToken(detail.pending_token);
        setSessions(detail.sessions ?? []);
        setStage('device');
        setFormError('');
      } else if (!err?.response) {
        setFormError('We could not reach the shop. Check your connection and try again.');
      } else {
        setFormError(typeof detail === 'string' ? detail : 'That code is not right, or it has expired.');
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await authAPI.resendRegisterOtp({ identifier: email.trim().toLowerCase() });
      setCode('');
      setAnnouncement('We sent a new code.');
    } catch {
      setFormError('We could not send another code just now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const chooseDevice = async (sessionId: number) => {
    setEvictingId(sessionId);
    setFormError('');
    try {
      const res = await authAPI.evictAndLogin({ pending_token: pendingToken, session_id: sessionId });
      finish(res.data.access_token, res.data.user);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setStage('code');
        setCode('');
        setFormError('That took a little too long — enter a fresh code to continue.');
      } else if (status === 404) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setFormError('That device was already signed out. Choose another.');
      } else {
        setFormError(err?.response?.data?.detail || 'We could not sign that device out. Try another.');
      }
    } finally {
      setEvictingId(null);
    }
  };

  return (
    <AuthShell
      /* Most people arrive here from the sign-in form, sent by the lookup —
         so back means back to signing in, not out to the shop. The device
         chooser gets none: the code is already accepted by then. */
      back={
        stage === 'details'
          ? { label: prefill ? 'Back to signing in' : 'Back to the shop', href: prefill ? '/auth/login' : '/' }
          : stage === 'code'
            ? { label: 'Back to your details', onClick: () => { setStage('details'); setErrors({}); } }
            : undefined
      }
      title={stage === 'details' ? 'Create an account' : stage === 'code' ? 'Check your email' : 'One more thing'}
      standfirst={
        stage === 'details'
          ? 'So we can send your order confirmations and call you if anything is wrong.'
          : stage === 'code'
            ? 'We sent a six-digit code to your email and your phone.'
            : undefined
      }
      footer={
        stage === 'details' ? (
          <p className="text-center text-sm text-paper-faint">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="text-paper underline underline-offset-4 transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
            >
              Sign in
            </Link>
          </p>
        ) : undefined
      }
    >
      <Announce message={announcement} />

      {formError && (
        <p role="alert" className="mb-6 text-xs text-brass-bright">
          {formError}
        </p>
      )}

      {stage === 'details' && (
        <Step stepKey="details">
          <form onSubmit={submitDetails} noValidate className="space-y-7">
            <Field
              ref={nameRef}
              label="Full name"
              name="full_name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, full_name: '' })); }}
              error={errors.full_name || undefined}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
              error={errors.email || undefined}
            />
            <Field
              label="Mobile number"
              name="phone"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setErrors((p) => ({ ...p, phone: '' })); }}
              error={errors.phone || undefined}
              hint="Indian mobile, 10 digits. We add +91."
            />
            <div>
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                error={errors.password || undefined}
              />
              {/* Live checklist. A rule you can only discover by failing is a
                  bad rule — and these five are what the server enforces. */}
              <ul className="mt-3 space-y-1">
                {RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <li key={r.label} className="flex items-center gap-2.5 text-xs">
                      <span aria-hidden="true" className={ok ? 'text-brass-bright' : 'text-paper-faint/50'}>
                        {ok ? '—' : '·'}
                      </span>
                      <span className={ok ? 'text-paper-muted' : 'text-paper-faint'}>{r.label}</span>
                      <span className="sr-only">{ok ? 'met' : 'not yet met'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="pt-2">
              <ActionButton type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create account'}
              </ActionButton>
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
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setFormError(''); }}
              className="tracking-[0.4em]"
            />
            <div className="mt-9 flex flex-col items-start gap-6">
              <ActionButton type="submit" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify and continue'}
              </ActionButton>
              <ActionButton tone="quiet" arrow={false} onClick={resend} disabled={busy}>
                Send another code
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
            error={formError || undefined}
          />
        </Step>
      )}
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
