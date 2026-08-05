'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { LogoMark } from '@/components/Logo';
import DeviceLimitModal from '@/components/DeviceLimitModal';

// ─── Password rules ───────────────────────────────────────────────────────────
const RULES = [
  { test: (p: string) => p.length >= 8,                     label: 'At least 8 characters'    },
  { test: (p: string) => /[A-Z]/.test(p),                   label: 'One uppercase letter'      },
  { test: (p: string) => /[a-z]/.test(p),                   label: 'One lowercase letter'      },
  { test: (p: string) => /\d/.test(p),                      label: 'One number'                },
  { test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p), label: 'One special character'     },
];

// ─── Country codes (comprehensive) ────────────────────────────────────────────
const COUNTRY_CODES = [
  // South Asia
  { code: '+91',  flag: '🇮🇳', label: 'India (+91)'           },
  { code: '+92',  flag: '🇵🇰', label: 'Pakistan (+92)'         },
  { code: '+880', flag: '🇧🇩', label: 'Bangladesh (+880)'      },
  { code: '+94',  flag: '🇱🇰', label: 'Sri Lanka (+94)'        },
  { code: '+977', flag: '🇳🇵', label: 'Nepal (+977)'           },
  { code: '+975', flag: '🇧🇹', label: 'Bhutan (+975)'          },
  { code: '+960', flag: '🇲🇻', label: 'Maldives (+960)'        },
  // Gulf / Middle East
  { code: '+971', flag: '🇦🇪', label: 'UAE (+971)'             },
  { code: '+966', flag: '🇸🇦', label: 'Saudi Arabia (+966)'    },
  { code: '+974', flag: '🇶🇦', label: 'Qatar (+974)'           },
  { code: '+973', flag: '🇧🇭', label: 'Bahrain (+973)'         },
  { code: '+968', flag: '🇴🇲', label: 'Oman (+968)'            },
  { code: '+965', flag: '🇰🇼', label: 'Kuwait (+965)'          },
  { code: '+962', flag: '🇯🇴', label: 'Jordan (+962)'          },
  { code: '+961', flag: '🇱🇧', label: 'Lebanon (+961)'         },
  { code: '+964', flag: '🇮🇶', label: 'Iraq (+964)'            },
  { code: '+98',  flag: '🇮🇷', label: 'Iran (+98)'             },
  { code: '+972', flag: '🇮🇱', label: 'Israel (+972)'          },
  // Southeast Asia
  { code: '+65',  flag: '🇸🇬', label: 'Singapore (+65)'        },
  { code: '+60',  flag: '🇲🇾', label: 'Malaysia (+60)'         },
  { code: '+66',  flag: '🇹🇭', label: 'Thailand (+66)'         },
  { code: '+62',  flag: '🇮🇩', label: 'Indonesia (+62)'        },
  { code: '+63',  flag: '🇵🇭', label: 'Philippines (+63)'      },
  { code: '+84',  flag: '🇻🇳', label: 'Vietnam (+84)'          },
  { code: '+95',  flag: '🇲🇲', label: 'Myanmar (+95)'          },
  { code: '+855', flag: '🇰🇭', label: 'Cambodia (+855)'        },
  { code: '+856', flag: '🇱🇦', label: 'Laos (+856)'            },
  // East Asia
  { code: '+81',  flag: '🇯🇵', label: 'Japan (+81)'            },
  { code: '+82',  flag: '🇰🇷', label: 'South Korea (+82)'      },
  { code: '+86',  flag: '🇨🇳', label: 'China (+86)'            },
  { code: '+852', flag: '🇭🇰', label: 'Hong Kong (+852)'       },
  { code: '+886', flag: '🇹🇼', label: 'Taiwan (+886)'          },
  // Oceania
  { code: '+61',  flag: '🇦🇺', label: 'Australia (+61)'        },
  { code: '+64',  flag: '🇳🇿', label: 'New Zealand (+64)'      },
  { code: '+679', flag: '🇫🇯', label: 'Fiji (+679)'            },
  // Europe
  { code: '+44',  flag: '🇬🇧', label: 'UK (+44)'               },
  { code: '+353', flag: '🇮🇪', label: 'Ireland (+353)'         },
  { code: '+33',  flag: '🇫🇷', label: 'France (+33)'           },
  { code: '+49',  flag: '🇩🇪', label: 'Germany (+49)'          },
  { code: '+39',  flag: '🇮🇹', label: 'Italy (+39)'            },
  { code: '+34',  flag: '🇪🇸', label: 'Spain (+34)'            },
  { code: '+351', flag: '🇵🇹', label: 'Portugal (+351)'        },
  { code: '+31',  flag: '🇳🇱', label: 'Netherlands (+31)'      },
  { code: '+32',  flag: '🇧🇪', label: 'Belgium (+32)'          },
  { code: '+41',  flag: '🇨🇭', label: 'Switzerland (+41)'      },
  { code: '+43',  flag: '🇦🇹', label: 'Austria (+43)'          },
  { code: '+46',  flag: '🇸🇪', label: 'Sweden (+46)'           },
  { code: '+47',  flag: '🇳🇴', label: 'Norway (+47)'           },
  { code: '+45',  flag: '🇩🇰', label: 'Denmark (+45)'          },
  { code: '+358', flag: '🇫🇮', label: 'Finland (+358)'         },
  { code: '+30',  flag: '🇬🇷', label: 'Greece (+30)'           },
  { code: '+48',  flag: '🇵🇱', label: 'Poland (+48)'           },
  { code: '+7',   flag: '🇷🇺', label: 'Russia (+7)'            },
  { code: '+380', flag: '🇺🇦', label: 'Ukraine (+380)'         },
  // Americas
  { code: '+1',   flag: '🇺🇸', label: 'USA / Canada (+1)'      },
  { code: '+52',  flag: '🇲🇽', label: 'Mexico (+52)'           },
  { code: '+55',  flag: '🇧🇷', label: 'Brazil (+55)'           },
  { code: '+54',  flag: '🇦🇷', label: 'Argentina (+54)'        },
  { code: '+57',  flag: '🇨🇴', label: 'Colombia (+57)'         },
  { code: '+56',  flag: '🇨🇱', label: 'Chile (+56)'            },
  { code: '+51',  flag: '🇵🇪', label: 'Peru (+51)'             },
  // Africa
  { code: '+27',  flag: '🇿🇦', label: 'South Africa (+27)'     },
  { code: '+234', flag: '🇳🇬', label: 'Nigeria (+234)'         },
  { code: '+254', flag: '🇰🇪', label: 'Kenya (+254)'           },
  { code: '+233', flag: '🇬🇭', label: 'Ghana (+233)'           },
  { code: '+20',  flag: '🇪🇬', label: 'Egypt (+20)'            },
  { code: '+212', flag: '🇲🇦', label: 'Morocco (+212)'         },
  { code: '+256', flag: '🇺🇬', label: 'Uganda (+256)'          },
  { code: '+255', flag: '🇹🇿', label: 'Tanzania (+255)'        },
  { code: '+251', flag: '🇪🇹', label: 'Ethiopia (+251)'        },
];

// ─── InputRow defined OUTSIDE the component ───────────────────────────────────
// IMPORTANT: If this is inside the component, React unmounts+remounts the input
// on every keystroke (new function reference = new component type) → focus loss.
interface InputRowProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}
function InputRow({ label, error, required = true, children }: InputRowProps) {
  return (
    <div>
      <label className="label">{label}{required && ' *'}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-red-600 text-xs mt-1">
          <AlertCircle size={13} />{error}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function RegisterPageInner() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // In switch-account mode (?add=1) allow registration even when logged in.
  // Reactive via useSearchParams — window.location.search can be stale on the
  // very first render right after a client-side <Link> transition, which was
  // causing isAddMode to read as false and bounce admins straight to /admin
  // before they could fill out the "Create your account" form.
  const isAddMode = searchParams.get('add') === '1';

  const [fullName,    setFullName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone,       setPhone]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [agreeTerms,  setAgreeTerms]  = useState(false);
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [apiError,    setApiError]    = useState('');

  // ── OTP verification step (dual-channel: email + SMS/WhatsApp) ───────────
  const [step,       setStep]       = useState<'form' | 'otp'>('form');
  const [otp,        setOtp]        = useState('');
  const [emailHint,  setEmailHint]  = useState('');
  const [timer,      setTimer]      = useState(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Device-limit (max 4 devices) state ────────────────────────────────────
  const [deviceLimit, setDeviceLimit] = useState<{ pendingToken: string; sessions: any[] } | null>(null);
  const [evicting,     setEvicting]   = useState(false);

  useEffect(() => () => { if (resendIntervalRef.current) clearInterval(resendIntervalRef.current); }, []);

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

  // True once the visitor has typed anything into the form. Once this is true
  // we must NEVER redirect them away — an already-logged-in admin/user landing
  // here to test/create a new account should never get yanked mid-keystroke
  // into their own dashboard just because a background auth refresh resolved.
  const hasStartedForm = Boolean(fullName || email || phone || password || confirm);

  // Redirect if already logged in (wait for auth to finish loading first)
  // Skip redirect in add/switch mode — user wants to register a NEW account
  // Skip redirect once the form has any input — never abandon in-progress typing
  useEffect(() => {
    if (authLoading) return;
    if (hasStartedForm) return;
    if (user && !isAddMode) {
      router.replace(user.is_admin ? '/admin' : '/');
    }
  }, [user, authLoading, router, isAddMode, hasStartedForm]);

  const clearErr = (key: string) =>
    setErrors(prev => ({ ...prev, [key]: '' }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    const name = fullName.trim();
    if (!name)                              e.fullName = 'Full name is required';
    else if (name.length < 2)              e.fullName = 'Name must be at least 2 characters';
    else if (!/^[a-zA-Z\s]+$/.test(name)) e.fullName = 'Name must contain only letters and spaces';

    const em = email.trim();
    if (!em)                                        e.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.email = 'Enter a valid email address';

    const ph = phone.replace(/\D/g, '');
    if (!ph) {
      e.phone = 'Mobile number is required';
    } else if (countryCode === '+91' && !/^[6-9]\d{9}$/.test(ph)) {
      e.phone = 'Enter a valid 10-digit Indian number (starts with 6–9)';
    } else if (countryCode !== '+91' && (ph.length < 7 || ph.length > 15)) {
      e.phone = 'Enter a valid mobile number (7–15 digits)';
    }

    const failed = RULES.filter(r => !r.test(password));
    if (!password)         e.password = 'Password is required';
    else if (failed.length) e.password = `Need: ${failed.map(r => r.label).join(', ')}`;

    if (!confirm)                  e.confirm = 'Please confirm your password';
    else if (password !== confirm) e.confirm = 'Passwords do not match';

    if (!agreeTerms) e.terms = 'You must agree to the Terms & Conditions';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      const fullPhone = countryCode + phone.replace(/\D/g, '');
      const res = await authAPI.register({
        full_name:        fullName.trim(),
        email:            email.trim().toLowerCase(),
        phone:            fullPhone,
        password,
        confirm_password: confirm,
        agree_terms:      agreeTerms,
      });
      setEmailHint(res.data.email_hint || email.trim());
      setStep('otp');
      startResendTimer();
      toast.success('OTP sent to your email and mobile — enter it below to finish creating your account.');
    } catch (err: any) {
      if (!err.response) {
        setApiError('⏳ Server is starting up. Please wait 15 seconds and try again.');
      } else {
        const detail = err.response?.data?.detail;
        if (Array.isArray(detail)) setApiError(detail.map((d: any) => d.msg).join('. '));
        else setApiError(detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const completeSignUp = (access_token: string, newUser: any) => {
    login(access_token, newUser);
    toast.success('Account created! Welcome to Vijey Textile! 🎉');
    // Hard navigation — signals Chrome/Safari to offer "Save Password"
    window.location.href = '/';
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setApiError('Enter the 6-digit OTP sent to your email/mobile'); return; }
    setLoading(true);
    setApiError('');
    try {
      const res = await authAPI.verifyRegisterOtp({ identifier: email.trim().toLowerCase(), otp_code: otp });
      completeSignUp(res.data.access_token, res.data.user);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409 && detail?.code === 'device_limit') {
        setDeviceLimit({ pendingToken: detail.pending_token, sessions: detail.sessions || [] });
        return;
      }
      setApiError(typeof detail === 'string' ? detail : 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0 || loading) return;
    setLoading(true);
    setApiError('');
    try {
      await authAPI.resendRegisterOtp({ identifier: email.trim().toLowerCase() });
      setOtp('');
      startResendTimer();
      toast.success('New OTP sent!');
    } catch (err: any) {
      setApiError(err.response?.data?.detail || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEvictAndLogin = async (sessionId: number) => {
    if (!deviceLimit) return;
    setEvicting(true);
    try {
      const res = await authAPI.evictAndLogin({ pending_token: deviceLimit.pendingToken, session_id: sessionId });
      setDeviceLimit(null);
      completeSignUp(res.data.access_token, res.data.user);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not sign out that device. Please try again.');
    } finally {
      setEvicting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-maroon-100">

      {/* Standalone header */}
      <div className="bg-brand-gradient text-white py-4 px-6 flex items-center shadow-md gap-3">
        {/* Left — Back to Login always; also Home when no account logged in */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/auth/login?add=1"
            className="flex flex-col items-start text-sm text-white/80 hover:text-white transition-colors leading-tight"
          >
            <span className="text-xs">← Back to</span>
            <span className="font-semibold text-white">Login</span>
          </Link>
          {!user && (
            <>
              <span className="text-white/30 text-lg">|</span>
              <Link
                href="/"
                className="flex flex-col items-start text-sm text-white/80 hover:text-white transition-colors leading-tight"
              >
                <span className="text-xs">←</span>
                <span className="font-semibold text-white">Home</span>
              </Link>
            </>
          )}
          {user && (
            <>
              <span className="text-white/30 text-lg">|</span>
              <Link
                href="/"
                className="flex flex-col items-start text-sm text-white/80 hover:text-white transition-colors leading-tight"
              >
                <span className="text-xs">← Back to</span>
                <span className="font-semibold text-white truncate max-w-[110px]">
                  {user.full_name?.split(' ')[0] || 'Account'}
                </span>
              </Link>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center leading-tight">
          <Link href="/" className="flex items-center gap-2.5 leading-tight">
            <LogoMark size={30} className="text-white flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-white font-bold uppercase leading-tight" style={{ fontSize: '15px', letterSpacing: '0.04em' }}>Vijey Textile</span>
              <span className="text-maroon-300 font-semibold uppercase leading-tight mt-0.5" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>Luxury Kid&apos;s &amp; Girls Clothing</span>
            </div>
          </Link>
        </div>

        {/* Right spacer to keep logo centered */}
        <div className="w-14" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 'form' ? 'Create your account' : 'Verify your account'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'form'
              ? 'Join thousands of happy customers at Vijey Textile.'
              : `OTP sent to ${emailHint} and your mobile number.`}
          </p>
        </div>

        <div className="card p-8 shadow-lg">

          {apiError && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{apiError}</p>
            </div>
          )}

          {step === 'form' && (
          <form onSubmit={handleSubmit} noValidate autoComplete="on" className="space-y-4">

            {/* Full Name */}
            <InputRow label="Full Name" error={errors.fullName}>
              <input
                id="full_name" name="name" type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); clearErr('fullName'); setApiError(''); }}
                placeholder="Enter your full name"
                className={`input-field ${errors.fullName ? 'border-red-400' : ''}`}
                autoComplete="name"
              />
            </InputRow>

            {/* Email */}
            <InputRow label="Email Address" error={errors.email}>
              <input
                id="email" name="email" type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); clearErr('email'); setApiError(''); }}
                placeholder="your@email.com"
                className={`input-field ${errors.email ? 'border-red-400' : ''}`}
                autoComplete="email"
              />
            </InputRow>

            {/* Mobile Number — country code dropdown + number field */}
            <InputRow label="Mobile Number" error={errors.phone}>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={e => { setCountryCode(e.target.value); clearErr('phone'); }}
                  className="input-field w-32 flex-shrink-0 px-2 cursor-pointer"
                  aria-label="Country code"
                >
                  {COUNTRY_CODES.map((c, i) => (
                    <option key={`${c.code}-${i}`} value={c.code}>{c.flag} {c.label}</option>
                  ))}
                </select>
                <input
                  id="phone" name="tel" type="tel"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value.replace(/[^\d]/g, ''));
                    clearErr('phone');
                    setApiError('');
                  }}
                  placeholder={countryCode === '+91' ? '9876543210' : 'Mobile number'}
                  className={`input-field flex-1 ${errors.phone ? 'border-red-400' : ''}`}
                  autoComplete="tel-national"
                  inputMode="numeric"
                  maxLength={15}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {countryCode === '+91'
                  ? 'Enter 10-digit number starting with 6–9'
                  : 'Enter number without country code'}
              </p>
            </InputRow>

            {/* Password */}
            <InputRow label="Password" error={errors.password}>
              <div className="relative">
                <input
                  id="password" name="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearErr('password'); setApiError(''); }}
                  placeholder="Create a strong password"
                  className={`input-field pr-12 ${errors.password ? 'border-red-400' : ''}`}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Strength checklist */}
              {password && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {RULES.map(r => {
                    const ok = r.test(password);
                    return (
                      <div key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle size={11} className={ok ? 'text-green-500' : 'text-gray-300'} />
                        {r.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </InputRow>

            {/* Confirm Password */}
            <InputRow label="Confirm Password" error={errors.confirm}>
              <div className="relative">
                <input
                  id="confirm_password" name="confirm_password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); clearErr('confirm'); setApiError(''); }}
                  placeholder="Re-enter your password"
                  className={`input-field pr-12 ${errors.confirm ? 'border-red-400' : ''}`}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1">
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </InputRow>

            {/* Terms checkbox */}
            <div>
              <label className={`flex items-start gap-3 cursor-pointer group ${errors.terms ? 'text-red-600' : 'text-gray-700'}`}>
                <div className="relative mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => { setAgreeTerms(e.target.checked); clearErr('terms'); }}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                    ${agreeTerms ? 'bg-maroon-800 border-maroon-800'
                      : errors.terms ? 'border-red-400'
                      : 'border-gray-300 group-hover:border-maroon-400'}`}>
                    {agreeTerms && <CheckCircle size={12} className="text-white" fill="white" />}
                  </div>
                </div>
                <span className="text-sm leading-relaxed">
                  I agree to Vijey Textile&apos;s{' '}
                  <Link href="/support#terms" className="text-maroon-800 underline font-medium" target="_blank">
                    Terms & Conditions
                  </Link>{' '}and{' '}
                  <Link href="/support#privacy" className="text-maroon-800 underline font-medium" target="_blank">
                    Privacy Policy
                  </Link>.
                </span>
              </label>
              {errors.terms && (
                <p className="flex items-center gap-1 text-red-600 text-xs mt-1.5">
                  <AlertCircle size={13} />{errors.terms}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading
                ? <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Creating account...</>
                : <><UserPlus size={18} /> Create Account</>}
            </button>
          </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} noValidate className="space-y-5">
              <div>
                <label className="label">6-Digit OTP *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setApiError(''); }}
                  placeholder="• • • • • •"
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Sent to <strong>{emailHint}</strong> and your mobile via SMS/WhatsApp. Check inbox + spam folder.
                </p>
              </div>

              <button type="submit" disabled={loading || otp.length !== 6}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60">
                {loading
                  ? <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Verifying…</>
                  : <><ShieldCheck size={18} /> Verify & Create Account</>}
              </button>

              <div className="flex items-center justify-between text-sm pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={timer > 0 || loading}
                  className="flex items-center gap-1.5 font-medium text-maroon-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  <RefreshCw size={14} />
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtp(''); setApiError(''); }}
                  className="text-gray-500 hover:text-gray-700 hover:underline"
                >
                  ← Edit details
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-maroon-200 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-maroon-800 font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
      </div>

      {deviceLimit && (
        <DeviceLimitModal
          sessions={deviceLimit.sessions}
          loading={evicting}
          onPick={handleEvictAndLogin}
          onClose={() => setDeviceLimit(null)}
        />
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-maroon-100"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-maroon-700" /></div>}>
      <RegisterPageInner />
    </Suspense>
  );
}
