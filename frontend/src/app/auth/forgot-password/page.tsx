'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, KeyRound, Send } from 'lucide-react';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep]             = useState<'request' | 'reset'>('request');
  const [identifier, setIdentifier] = useState('');
  const [emailHint, setEmailHint]   = useState('');
  const [form, setForm]             = useState({ otp: '', password: '', confirm: '' });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showPass, setShowPass]     = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { setError('Email or mobile number is required'); return; }
    setLoading(true); setError('');
    try {
      const res = await authAPI.forgotPassword({ identifier: identifier.trim() });
      setEmailHint(res.data.email_hint || '');
      toast.success('OTP sent! Check your email.');
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Try again.');
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.otp || form.otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    if (form.password.length < 8)           { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirm)     { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword({
        identifier:       identifier.trim(),
        otp_code:         form.otp,
        new_password:     form.password,
        confirm_password: form.confirm,
      });
      toast.success('Password reset successfully! Please login.');
      router.push('/auth/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#fff9f2]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Vijey Textile" style={{ height: '52px', width: 'auto', mixBlendMode: 'multiply', display: 'block' }} />
            <div className="flex flex-col text-left">
              <span className="font-bold text-maroon-900 leading-tight" style={{ fontFamily: 'Georgia, serif', fontSize: '18px', letterSpacing: '1.5px' }}>VIJEY TEXTILE</span>
              <span className="text-maroon-500 leading-tight mt-0.5" style={{ fontSize: '9px', letterSpacing: '1.5px' }}>Luxury Kid&apos;s &amp; Girls Clothing</span>
            </div>
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 'request' ? 'Forgot Password?' : 'Enter OTP'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'request'
              ? 'We\'ll send an OTP to your registered email'
              : `OTP sent to ${emailHint || 'your email'}`}
          </p>
        </div>

        <div className="card p-8 shadow-lg">
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-5">
              <div>
                <label className="label">Email or Mobile Number *</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                  placeholder="email@example.com or 9876543210"
                  className="input-field"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {loading
                  ? <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Sending OTP...</>
                  : <><Send size={18} /> Send OTP</>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="label">6-Digit OTP *</label>
                <input
                  type="text"
                  maxLength={6}
                  value={form.otp}
                  onChange={(e) => { setForm({ ...form, otp: e.target.value.replace(/\D/, '') }); setError(''); }}
                  placeholder="Enter OTP from email"
                  className="input-field text-center text-2xl tracking-widest font-bold"
                />
              </div>
              <div>
                <label className="label">New Password *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(''); }}
                    placeholder="Min 8 chars, uppercase, number, symbol"
                    className="input-field pr-12"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 text-xs">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Min 8 chars · Uppercase · Number · Symbol (!@#$...)</p>
              </div>
              <div>
                <label className="label">Confirm New Password *</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={(e) => { setForm({ ...form, confirm: e.target.value }); setError(''); }}
                  placeholder="Re-enter new password"
                  className="input-field"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {loading
                  ? <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Resetting...</>
                  : <><KeyRound size={18} /> Reset Password</>}
              </button>
              <button type="button" onClick={() => { setStep('request'); setError(''); }}
                className="w-full text-sm text-maroon-700 hover:underline text-center">
                Resend OTP
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-orange-100 text-center">
            <Link href="/auth/login" className="flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-maroon-800">
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
