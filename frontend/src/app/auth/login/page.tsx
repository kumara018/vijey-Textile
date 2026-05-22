'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, ShieldCheck, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/lib/api';
import { redirectAfterLogin } from '@/lib/auth';
import toast from 'react-hot-toast';

type Step = 'credentials' | 'otp';

export default function LoginPage() {
  const { login, user, sessions, switchAccount, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect if already logged in — but NOT when adding another account (?add=1)
  // Wait for auth to finish loading before redirecting (avoids flash on refresh)
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    const params  = new URLSearchParams(window.location.search);
    const addMode = params.get('add') === '1';
    if (!addMode) router.replace(user.is_admin ? '/admin' : '/');
  }, [user, authLoading, router]);

  // Derive isAddMode for UI labels (always safe on client)
  const isAddMode = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('add') === '1'
    : false;

  // ── Step 1 fields ─────────────────────────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);

  // ── Step 2 fields ─────────────────────────────────────────────────────────
  const [otp,       setOtp]       = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [timer,     setTimer]     = useState(60);    // resend cooldown

  // ── Shared state ──────────────────────────────────────────────────────────
  const [step,    setStep]    = useState<Step>('credentials');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── Retry state (replaces the old infinite-loop setTimeout) ───────────────
  const [retryIn,   setRetryIn]   = useState(0);   // countdown seconds
  const retryCountRef    = useRef(0);               // max 1 auto-retry
  const retryTimeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendIntervalRef= useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    if (retryTimeoutRef.current)  clearTimeout(retryTimeoutRef.current);
    if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    if (resendIntervalRef.current)clearInterval(resendIntervalRef.current);
  }, []);

  const cancelPendingRetry = useCallback(() => {
    if (retryTimeoutRef.current)  { clearTimeout(retryTimeoutRef.current);  retryTimeoutRef.current  = null; }
    if (retryIntervalRef.current) { clearInterval(retryIntervalRef.current); retryIntervalRef.current = null; }
    setRetryIn(0);
  }, []);

  // ── OTP resend countdown ──────────────────────────────────────────────────
  const startResendTimer = useCallback(() => {
    setTimer(60);
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    resendIntervalRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(resendIntervalRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  // ── Step 1: verify credentials → send OTP ────────────────────────────────
  const handleSendOtp = useCallback(async (e: React.FormEvent, isRetry = false) => {
    if (!isRetry) {
      e.preventDefault();
      retryCountRef.current = 0;   // reset counter on every fresh submit
      cancelPendingRetry();
    }
    if (!identifier.trim()) { setError('Email or mobile number is required'); return; }
    if (!password)           { setError('Password is required');               return; }

    // ── Check if account is already signed in ────────────────────────────────
    const id = identifier.trim().toLowerCase();
    const alreadySaved = sessions.find(s =>
      s.user.email?.toLowerCase() === id ||
      s.user.phone?.replace(/\D/g, '').slice(-10) === id.replace(/\D/g, '').slice(-10)
    );
    if (alreadySaved) {
      toast.error(
        `"${alreadySaved.user.full_name}" is already signed in. Switch from the account menu.`,
        { duration: 4000, icon: '⚠️' }
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authAPI.sendLoginOtp({ identifier: identifier.trim(), password });
      retryCountRef.current = 0;
      setEmailHint(res.data.email_hint || '');
      setStep('otp');
      startResendTimer();
      toast.success('OTP generated! Check your email or use the code below.');
    } catch (err: any) {
      if (!err.response && retryCountRef.current < 1) {
        // ── First network failure → schedule exactly ONE auto-retry ──────────
        retryCountRef.current += 1;
        const WAIT = 20;
        setRetryIn(WAIT);

        // Countdown display
        let count = WAIT;
        retryIntervalRef.current = setInterval(() => {
          count -= 1;
          setRetryIn(count);
          if (count <= 0) {
            clearInterval(retryIntervalRef.current!);
            retryIntervalRef.current = null;
          }
        }, 1000);

        // Single retry after WAIT seconds
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          handleSendOtp(e, true);
        }, WAIT * 1000);

      } else if (!err.response) {
        // ── Already retried once — stop, let user decide ──────────────────
        cancelPendingRetry();
        setError('Server is temporarily unavailable. Please check your internet and click "Send OTP" to try again.');
      } else {
        // ── HTTP error (wrong password, etc.) — no retry ──────────────────
        retryCountRef.current = 0;
        cancelPendingRetry();
        setError(err.response?.data?.detail || 'Incorrect email/phone or password.');
      }
    } finally {
      setLoading(false);
    }
  }, [identifier, password, cancelPendingRetry, startResendTimer]);

  // ── Step 2: verify OTP → login ────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Enter the 6-digit OTP sent to your email'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await authAPI.verifyLoginOtp({ identifier: identifier.trim(), otp_code: otp });
      const { access_token, user } = res.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      login(access_token, user);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}! 👋`);
      redirectAfterLogin(user.is_admin);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (timer > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      await authAPI.sendLoginOtp({ identifier: identifier.trim(), password });
      setOtp('');
      startResendTimer();
      toast.success('New OTP generated!');
    } catch (err: any) {
      if (!err.response) {
        setError('Connection issue. Please wait a moment and try again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to resend OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fff9f2]">

      {/* Standalone header */}
      <div className="bg-brand-gradient text-white py-4 px-6 flex items-center shadow-md gap-3">
        {/* Left — Home when guest, Back to account when logged in */}
        {user ? (
          <Link
            href="/"
            className="flex flex-col items-start text-sm text-white/80 hover:text-white transition-colors leading-tight flex-shrink-0"
          >
            <span className="text-xs">← Back to</span>
            <span className="font-semibold text-white truncate max-w-[110px]">
              {user.full_name?.split(' ')[0] || 'Account'}
            </span>
          </Link>
        ) : (
          <Link
            href="/"
            className="flex flex-col items-start text-sm text-white/80 hover:text-white transition-colors leading-tight flex-shrink-0"
          >
            <span className="text-xs">←</span>
            <span className="font-semibold text-white">Home</span>
          </Link>
        )}
        <div className="flex-1 flex flex-col items-center leading-tight">
          <Link href="/" className="flex items-center gap-2.5 leading-tight">
            <img src="/logo.png" alt="Vijey Textile" style={{ height: '52px', width: 'auto', mixBlendMode: 'multiply', display: 'block' }} />
            <div className="flex flex-col">
              <span className="text-white font-bold tracking-widest leading-tight" style={{ fontFamily: 'Georgia, serif', fontSize: '17px', letterSpacing: '1.5px' }}>VIJEY TEXTILE</span>
              <span className="text-maroon-300 leading-tight mt-0.5" style={{ fontSize: '9px', letterSpacing: '1.5px' }}>Luxury Kid&apos;s &amp; Girls Clothing</span>
            </div>
          </Link>
        </div>
        {/* Right spacer always present to keep logo centered */}
        <div className="w-14" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 'credentials'
              ? (isAddMode ? 'Switch Account' : 'Sign in to your account')
              : 'Verify your identity'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'credentials'
              ? (isAddMode ? 'Sign in with a different account or create a new one' : 'Enter your email or mobile number')
              : `OTP sent to ${emailHint}`}
          </p>
        </div>

        <div className="card p-8 shadow-lg">

          {/* ── Retry countdown banner ───────────────────────────────── */}
          {retryIn > 0 && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-600 flex-shrink-0" />
                  <p className="text-amber-800 text-sm">
                    Server is starting up — retrying in <strong>{retryIn}s</strong>…
                  </p>
                </div>
                <button
                  onClick={() => { cancelPendingRetry(); retryCountRef.current = 1; }}
                  className="text-xs text-amber-600 hover:text-amber-800 font-medium ml-2 flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
              <p className="text-amber-600 text-xs mt-1 ml-6">
                This is a one-time delay while the server wakes up (Render free tier).
              </p>
            </div>
          )}

          {/* ── Error banner (only shown when no countdown) ──────────── */}
          {error && retryIn === 0 && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* ── STEP 1: Credentials ──────────────────────────────────── */}
          {step === 'credentials' && (
            <form onSubmit={handleSendOtp} noValidate autoComplete="on" className="space-y-5">
              <div>
                <label className="label">Email or Mobile Number *</label>
                <input
                  id="identifier" name="username" type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setError(''); cancelPendingRetry(); retryCountRef.current = 0; }}
                  placeholder="email@example.com or 9876543210"
                  className="input-field"
                  autoComplete="username"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="label mb-0">Password *</label>
                  <Link href="/auth/forgot-password" className="text-xs text-maroon-700 hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password" name="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); cancelPendingRetry(); retryCountRef.current = 0; }}
                    placeholder="Enter your password"
                    className="input-field pr-12"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || retryIn > 0}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60"
              >
                {loading
                  ? <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Sending OTP…</>
                  : retryIn > 0
                  ? <><Clock size={18} /> Retrying in {retryIn}s…</>
                  : <><Mail size={18} /> Send OTP</>}
              </button>
            </form>
          )}

          {/* ── STEP 2: OTP ──────────────────────────────────────────── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} noValidate className="space-y-5">

              <div>
                <label className="label">6-Digit OTP *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="• • • • • •"
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Sent to <strong>{emailHint}</strong>. Check inbox + spam folder.
                </p>
              </div>

              <button type="submit" disabled={loading || otp.length !== 6}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60">
                {loading
                  ? <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Verifying…</>
                  : <><ShieldCheck size={18} /> Verify & Sign In</>}
              </button>

              <div className="flex items-center justify-between text-sm pt-1">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={timer > 0 || loading}
                  className="flex items-center gap-1.5 font-medium text-maroon-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  <RefreshCw size={14} />
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}
                  className="text-gray-500 hover:text-gray-700 hover:underline"
                >
                  ← Change email/password
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-orange-100 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link
                href={isAddMode ? '/auth/register?add=1' : '/auth/register'}
                className="text-maroon-800 font-semibold hover:underline"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
