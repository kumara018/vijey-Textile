'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, Save, Package,
  MapPin, HelpCircle, UserX, LogOut, ShieldCheck, AlertCircle,
  CheckCircle, RefreshCw, Home, ChevronRight, Laptop, Smartphone,
  Tablet, MonitorSmartphone,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/lib/api';
import { performLogout } from '@/lib/auth';
import { DeviceSession } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'password' | 'devices';

function deviceIcon(type?: string) {
  if (type === 'mobile') return Smartphone;
  if (type === 'tablet') return Tablet;
  return Laptop;
}

function deviceTypeLabel(type?: string) {
  if (type === 'mobile') return 'Mobile';
  if (type === 'tablet') return 'Tablet';
  if (type === 'desktop') return 'Desktop';
  return 'Device';
}

function fmtWhen(iso?: string) {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Active now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AccountPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();

  // Redirect if not logged in — but wait for auth to restore from localStorage first
  useEffect(() => {
    if (authLoading) return;          // still restoring — don't redirect yet
    if (!user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('profile');

  // ── Profile form ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [phone,    setPhone]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone((user as any).phone || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setProfileMsg({ type: 'err', text: 'Name cannot be empty.' }); return; }
    setSaving(true); setProfileMsg(null);
    try {
      await authAPI.updateProfile({ full_name: fullName.trim(), phone: phone.trim() });
      await refresh();
      setProfileMsg({ type: 'ok', text: 'Profile updated successfully!' });
      toast.success('Profile saved!');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update profile. Please try again.';
      setProfileMsg({ type: 'err', text: msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showCurr,   setShowCurr]   = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwMsg,      setPwMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw) { setPwMsg({ type: 'err', text: 'Enter your current password.' }); return; }
    if (newPw.length < 6) { setPwMsg({ type: 'err', text: 'New password must be at least 6 characters.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: 'err', text: 'Passwords do not match.' }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      await authAPI.updateProfile({ current_password: currentPw, new_password: newPw });
      setPwMsg({ type: 'ok', text: 'Password changed successfully!' });
      toast.success('Password updated!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to change password. Check your current password.';
      setPwMsg({ type: 'err', text: msg });
    } finally {
      setPwSaving(false);
    }
  };

  // ── Linked Devices ────────────────────────────────────────────────────────
  const [sessions,      setSessions]      = useState<DeviceSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId,    setRevokingId]    = useState<number | null>(null);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await authAPI.getSessions();
      setSessions(res.data);
    } catch {
      toast.error('Could not load your linked devices. Please try again.');
    } finally {
      setSessionsLoading(false);
      setSessionsLoaded(true);
    }
  };

  // Load once eagerly (powers the summary count on Profile too), not just on tab click
  useEffect(() => {
    if (user && !sessionsLoaded) loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRevoke = async (session: DeviceSession) => {
    setRevokingId(session.id);
    try {
      await authAPI.revokeSession(session.id);
      if (session.is_current) {
        toast.success('Signed out.');
        performLogout();
        return;
      }
      toast.success(`Signed out of ${session.device_name || 'that device'}.`);
      setSessions(prev => prev.filter(s => s.id !== session.id));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not sign out that device.');
    } finally {
      setRevokingId(null);
    }
  };

  if (!user) return null; // wait for redirect

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-maroon-700 flex items-center gap-1"><Home size={12} /> Home</Link>
        <ChevronRight size={12} />
        <span className="text-gray-800 font-medium">My Account</span>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-maroon-100 flex items-center justify-center flex-shrink-0">
          <User size={32} className="text-maroon-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.full_name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
          <span className={`inline-block mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${user.is_admin ? 'bg-maroon-100 text-maroon-800' : 'bg-green-50 text-green-700'}`}>
            {user.is_admin ? '⚙ Admin Account' : '👤 Customer Account'}
          </span>
        </div>
      </div>

      {/* ── Linked Devices notice bar ───────────────────────────────────── */}
      {sessionsLoaded && (
        <button
          onClick={() => setTab('devices')}
          className="w-full mb-6 flex items-center gap-3 card p-4 hover:shadow-md hover:border-maroon-200 border-2 border-transparent transition-shadow text-left"
        >
          <div className="w-10 h-10 rounded-full bg-maroon-100 flex items-center justify-center flex-shrink-0">
            <MonitorSmartphone size={18} className="text-maroon-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Signed in on {sessions.length} of 4 devices
            </p>
            <p className="text-xs text-gray-500">Tap to see where and when — sign out of any device you don&apos;t recognize.</p>
          </div>
          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
        </button>
      )}

      {/* ── Quick links ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Package,    label: 'My Orders',       href: '/orders'         },
          { icon: MapPin,     label: 'Saved Addresses', href: '/account#addr'   },
          { icon: HelpCircle, label: 'Help & Policies', href: '/support'        },
          { icon: UserX,      label: 'Delete Account',  href: '/account/delete', danger: true },
        ].map(({ icon: Icon, label, href, danger }) => (
          <Link key={label} href={href}
            className={`card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow border-2 ${danger ? 'border-transparent hover:border-red-200 hover:bg-red-50' : 'border-transparent hover:border-maroon-100'}`}>
            <Icon size={20} className={danger ? 'text-red-500' : 'text-maroon-700'} />
            <span className={`text-xs font-semibold ${danger ? 'text-red-500' : 'text-gray-700'}`}>{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'profile',  label: 'Profile Info',    icon: User },
          { key: 'password', label: 'Change Password', icon: Lock },
          { key: 'devices',  label: 'Linked Devices',  icon: MonitorSmartphone },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? 'bg-white shadow text-maroon-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ──────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-5">Personal Information</h2>

          {profileMsg && (
            <div className={`mb-5 flex items-start gap-3 rounded-xl p-4 border ${profileMsg.type === 'ok' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {profileMsg.type === 'ok'
                ? <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                : <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />}
              <p className={`text-sm ${profileMsg.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{profileMsg.text}</p>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Full name */}
            <div>
              <label className="label">Full Name *</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setProfileMsg(null); }}
                  placeholder="Your full name"
                  className="input-field pl-9"
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email — read only */}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  className="input-field pl-9 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Email address cannot be changed.</p>
            </div>

            {/* Phone */}
            <div>
              <label className="label">Mobile Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="input-field pl-9"
                  maxLength={15}
                  autoComplete="tel"
                />
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              {saving
                ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
                : <><Save size={16} /> Save Changes</>}
            </button>
          </form>
        </div>
      )}

      {/* ── Password Tab ─────────────────────────────────────────────── */}
      {tab === 'password' && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-2">Change Password</h2>
          <p className="text-sm text-gray-500 mb-5">Choose a strong password of at least 6 characters.</p>

          {pwMsg && (
            <div className={`mb-5 flex items-start gap-3 rounded-xl p-4 border ${pwMsg.type === 'ok' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {pwMsg.type === 'ok'
                ? <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                : <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />}
              <p className={`text-sm ${pwMsg.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{pwMsg.text}</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-5">
            {/* Current password */}
            <div>
              <label className="label">Current Password *</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showCurr ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => { setCurrentPw(e.target.value); setPwMsg(null); }}
                  placeholder="Your current password"
                  className="input-field pl-9 pr-12"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowCurr(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  {showCurr ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="label">New Password *</label>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => { setNewPw(e.target.value); setPwMsg(null); }}
                  placeholder="At least 6 characters"
                  className="input-field pl-9 pr-12"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength indicator */}
              {newPw.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      newPw.length < 6 ? (i <= 1 ? 'bg-red-400' : 'bg-gray-200')
                      : newPw.length < 9 ? (i <= 2 ? 'bg-orange-400' : 'bg-gray-200')
                      : newPw.length < 12 ? (i <= 3 ? 'bg-yellow-400' : 'bg-gray-200')
                      : 'bg-green-400'
                    }`} />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">
                    {newPw.length < 6 ? 'Weak' : newPw.length < 9 ? 'Fair' : newPw.length < 12 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="label">Confirm New Password *</label>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showConf ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => { setConfirmPw(e.target.value); setPwMsg(null); }}
                  placeholder="Re-enter new password"
                  className={`input-field pl-9 pr-12 ${confirmPw && confirmPw !== newPw ? 'border-red-300 focus:border-red-400' : ''}`}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPw && confirmPw !== newPw && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>

            <button type="submit" disabled={pwSaving}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              {pwSaving
                ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Updating...</>
                : <><Lock size={16} /> Update Password</>}
            </button>
          </form>
        </div>
      )}

      {/* ── Linked Devices Tab ───────────────────────────────────────── */}
      {tab === 'devices' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-gray-800 text-lg">Linked Devices</h2>
            <button onClick={loadSessions} disabled={sessionsLoading}
              className="text-xs font-medium text-maroon-700 hover:underline flex items-center gap-1 disabled:text-gray-400">
              <RefreshCw size={12} className={sessionsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Every device currently signed in to your account — up to 4 at a time. Don&apos;t recognize one? Sign it out immediately.
          </p>

          {sessionsLoading && sessions.length === 0 ? (
            <div className="py-8 flex justify-center">
              <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-maroon-700" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No active devices found.</p>
          ) : (
            <div className="space-y-2.5">
              {sessions.map(s => {
                const Icon = deviceIcon(s.device_type);
                return (
                  <div key={s.id} className={`flex items-center gap-3 p-4 rounded-xl border ${s.is_current ? 'border-maroon-300 bg-maroon-50' : 'border-gray-200'}`}>
                    <div className="w-11 h-11 rounded-full bg-white border border-maroon-100 flex items-center justify-center flex-shrink-0">
                      <Icon size={19} className="text-maroon-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{s.device_name || 'Unknown device'}</p>
                        {s.is_current && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full">This device</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {deviceTypeLabel(s.device_type)} · {s.location || 'Unknown location'} · {fmtWhen(s.last_active_at || s.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(s)}
                      disabled={revokingId === s.id}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 flex-shrink-0"
                    >
                      {revokingId === s.id ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Danger zone ──────────────────────────────────────────────── */}
      <div className="mt-8 card border-red-100 p-5">
        <h3 className="font-bold text-red-700 mb-3 text-sm uppercase tracking-wide">Danger Zone</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.open('/auth/login?add=1', '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <RefreshCw size={15} /> Add Another Account
          </button>
          <button onClick={performLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">
            <LogOut size={15} /> Sign Out
          </button>
          <Link href="/account/delete"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors">
            <UserX size={15} /> Delete My Account
          </Link>
        </div>
      </div>

    </div>
  );
}
