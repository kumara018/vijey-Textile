'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authAPI, addressAPI } from '@/lib/api';
import { performLogout } from '@/lib/auth';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { Field } from '@/components/system/Field';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine, Announce } from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';
import { relativeTime, describeDevice, type DeviceSession } from '@/components/auth/DeviceChoice';

/**
 * Your account.
 *
 * The previous version hid three things behind tabs — profile, password,
 * devices. Tabs are the same defect the /support accordions had: content that
 * exists but cannot be seen, linked to from elsewhere, and invisible to a page
 * search. This is a short page; all three are sections, with a contents rail
 * on wide screens.
 *
 * The devices section is the customer-facing half of the session work. It uses
 * the same row design as the sign-in eviction step, because it is the same
 * information and a person should not have to learn it twice.
 *
 * Cart lessons applied throughout:
 *   · revoking a device removes the row that had focus → focus lands on the
 *     section heading
 *   · every non-navigating change is announced
 *   · the current device is marked, and signing it out is confirmed first
 *     because it ends the session you are using to read this
 */

interface SessionRow extends DeviceSession {
  is_current?: boolean;
}

const SECTIONS = [
  { id: 'profile', label: 'Your details' },
  { id: 'addresses', label: 'Saved addresses' },
  { id: 'password', label: 'Password' },
  { id: 'devices', label: 'Devices signed in' },
];

/** Mirrors backend/models.py::Address. */
interface Addr {
  id: number;
  label?: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}
type AddrDraft = Omit<Addr, 'id' | 'is_default'>;

const EMPTY_ADDR: AddrDraft = {
  label: 'Home', full_name: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', pincode: '',
};

function AccountInner() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [announcement, setAnnouncement] = useState('');

  /* ── Profile ────────────────────────────────────────────────────────── */
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  /* ── Password ───────────────────────────────────────────────────────── */
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');

  /**
   * ── Addresses ─────────────────────────────────────────────────────────
   *
   * `addressAPI` has had getAll / add / update / remove / setDefault since it
   * was written, and no page in this shop has ever called one of them. A
   * customer could save an address during checkout and then had no way to see
   * it, change it or delete it — which also means no way to correct a wrong
   * pincode on the address every future order defaults to.
   */
  const [addresses, setAddresses] = useState<Addr[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrError, setAddrError] = useState(false);
  const [addrBusy, setAddrBusy] = useState<number | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [draft, setDraft] = useState<AddrDraft>(EMPTY_ADDR);

  /* ── Devices ────────────────────────────────────────────────────────── */
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const devicesHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? '');
    setPhone(user.phone ?? '');
  }, [user]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(false);
    try {
      const res = await authAPI.getSessions();
      setSessions(res.data ?? []);
    } catch {
      setSessionsError(true);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadSessions();
  }, [user, loadSessions]);

  const loadAddresses = useCallback(async () => {
    setAddrLoading(true);
    setAddrError(false);
    try {
      const res = await addressAPI.getAll();
      setAddresses(res.data ?? []);
    } catch {
      setAddrError(true);
    } finally {
      setAddrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadAddresses();
  }, [user, loadAddresses]);

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: (keyof AddrDraft)[] = ['full_name', 'phone', 'address_line1', 'city', 'state', 'pincode'];
    if (required.some((k) => !String(draft[k] ?? '').trim())) {
      setAnnouncement('Every line except the second address line is needed.');
      return;
    }
    setAddrSaving(true);
    try {
      await addressAPI.add({ ...draft, is_default: addresses.length === 0 });
      setDraft(EMPTY_ADDR);
      setAddrOpen(false);
      await loadAddresses();
      setAnnouncement('Address saved.');
    } catch {
      setAnnouncement('We could not save that address.');
    } finally {
      setAddrSaving(false);
    }
  };

  const makeUsual = async (id: number) => {
    setAddrBusy(id);
    try { await addressAPI.setDefault(id); await loadAddresses(); setAnnouncement('Usual address changed.'); }
    catch { setAnnouncement('We could not change that.'); }
    finally { setAddrBusy(null); }
  };

  const removeAddress = async (id: number) => {
    setAddrBusy(id);
    try { await addressAPI.remove(id); setAddresses((p) => p.filter((a) => a.id !== id)); setAnnouncement('Address removed.'); }
    catch { setAnnouncement('We could not remove that.'); }
    finally { setAddrBusy(null); }
  };

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1800);
    return () => clearTimeout(t);
  }, [announcement]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    if (fullName.trim().length < 2) { setProfileError('Enter your full name.'); return; }
    setSavingProfile(true);
    try {
      await authAPI.updateProfile({ full_name: fullName.trim(), phone: phone.trim() });
      setAnnouncement('Your details have been saved.');
    } catch (err: any) {
      setProfileError(err?.response?.data?.detail || 'We could not save that. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!currentPw) { setPwError('Enter your current password.'); return; }
    if (newPw.length < 8) { setPwError('Your new password needs at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('The two new passwords do not match.'); return; }
    setSavingPw(true);
    try {
      await authAPI.updateProfile({ current_password: currentPw, new_password: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setAnnouncement('Your password has been changed.');
    } catch (err: any) {
      setPwError(err?.response?.data?.detail || 'We could not change your password. Check your current one.');
    } finally {
      setSavingPw(false);
    }
  };

  const revoke = async (s: SessionRow) => {
    setRevokingId(s.id);
    setConfirmingId(null);
    try {
      await authAPI.revokeSession(s.id);
      if (s.is_current) {
        // Signing out the device you are reading this on ends the session.
        logout();
        return;
      }
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
      setAnnouncement(`${describeDevice(s)} signed out.`);
      devicesHeading.current?.focus();
    } catch {
      setAnnouncement('We could not sign that device out. Please try again.');
    } finally {
      setRevokingId(null);
    }
  };

  /**
   * Sign out every other device, atomically.  (AUTH-SPEC R5)
   *
   * Two-step, because this is destructive and irreversible from the customer's
   * side: the first press arms it and the second commits, the same pattern the
   * per-device control already uses. Nobody should be able to log their family
   * out of a shared tablet with one stray tap.
   */
  const revokeAll = async () => {
    if (!confirmingAll) { setConfirmingAll(true); return; }
    setRevokingAll(true);
    setConfirmingAll(false);
    try {
      const res = await authAPI.revokeAllSessions(true);
      const n = res.data?.revoked ?? 0;
      await loadSessions();
      setAnnouncement(
        n === 0
          ? 'No other devices were signed in.'
          : `${n} other ${n === 1 ? 'device was' : 'devices were'} signed out. This one is still signed in.`,
      );
      devicesHeading.current?.focus();
    } catch {
      setAnnouncement('We could not sign the other devices out. Please try again.');
    } finally {
      setRevokingAll(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow="Your account"
        title={user.full_name || 'Your account'}
        standfirst={user.email}
      />

      <Announce message={announcement} />

      <div className="grid gap-x-16 gap-y-[7vh] lg:grid-cols-12">
        <nav aria-label="Contents" className="lg:col-span-3">
          <div className="lg:sticky lg:top-32">
            <ol className="space-y-3">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="group flex items-baseline gap-3 text-sm text-paper-muted transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                  >
                    <span className="text-rule tabular-nums text-paper-faint transition-colors duration-500 group-hover:text-brass-bright motion-reduce:transition-none">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
            {/**
              * Everything that is not on this page, in one place.
              *
              * THE ADMIN DASHBOARD HAD NO LINK ANYWHERE ON THE SITE — not in
              * the Index, not in the footer, not here. Whoever runs the shop
              * had to know to type /admin. It is listed for admins now, and
              * only for admins.
              */}
            <div className="mt-10 flex flex-col items-start gap-4 border-t border-ink-edge/60 pt-8">
              <p className="text-rule uppercase text-paper-faint">Elsewhere</p>
              <ActionLink href="/orders" tone="quiet">Your orders</ActionLink>
              <ActionLink href="/wishlist" tone="quiet">Kept pieces</ActionLink>
              <ActionLink href="/support" tone="quiet">Help &amp; policies</ActionLink>
              {user.is_admin && <ActionLink href="/admin" tone="quiet">The workroom</ActionLink>}
            </div>
          </div>
        </nav>

        <div className="lg:col-span-8 lg:col-start-5">
          {/* ── Details ──────────────────────────────────────────────── */}
          <section id="profile" className="scroll-mt-32">
            <h2 className="font-display text-band font-light text-paper">Your details</h2>
            <form onSubmit={saveProfile} noValidate className="mt-8 max-w-[26rem] space-y-7">
              <Field
                label="Full name"
                name="full_name"
                autoComplete="name"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setProfileError(''); }}
                error={profileError || undefined}
              />
              <Field
                label="Mobile number"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setProfileError(''); }}
              />
              <Field
                label="Email"
                name="email"
                value={user.email}
                readOnly
                disabled
                hint="Your email is the address every code and invoice goes to. Contact us to change it."
              />
              <div className="pt-2">
                <ActionButton type="submit" disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save details'}
                </ActionButton>
              </div>
            </form>
          </section>

          {/* ── Saved addresses ──────────────────────────────────────── */}
          <section id="addresses" className="mt-[9vh] scroll-mt-32 border-t border-ink-edge/60 pt-10">
            <h2 className="font-display text-band font-light text-paper">Saved addresses</h2>
            <p className="mt-3 max-w-[38ch] text-paper-muted">
              Somewhere to send a piece without writing it out again. The usual one is
              filled in for you at checkout.
            </p>

            {addrError ? (
              <div className="mt-8">
                <ErrorState
                  title="We could not load your addresses"
                  body="Your account is fine — this is a problem reaching our server."
                  onRetry={loadAddresses}
                />
              </div>
            ) : addrLoading ? (
              <div className="mt-8 space-y-3">
                <SkeletonLine /><SkeletonLine /><SkeletonLine />
              </div>
            ) : (
              <>
                {addresses.length === 0 ? (
                  <p className="mt-8 text-paper-muted">None saved yet.</p>
                ) : (
                  <ul className="mt-8">
                    {addresses.map((a, i) => (
                      <li
                        key={a.id}
                        className={`flex flex-wrap items-start gap-x-8 gap-y-3 py-6 ${i > 0 ? 'border-t border-ink-edge/60' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-paper">
                            {a.full_name}
                            {a.is_default && (
                              <span className="ml-3 text-rule uppercase text-brass-bright">Usual</span>
                            )}
                          </p>
                          <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-paper-muted">
                            {a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}, {a.city}, {a.state} {a.pincode}
                          </p>
                          <p className="mt-1.5 text-rule uppercase text-paper-faint">{a.phone}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-6">
                          {!a.is_default && (
                            <ActionButton tone="quiet" arrow={false} disabled={addrBusy === a.id}
                              onClick={() => makeUsual(a.id)}>
                              Make usual
                            </ActionButton>
                          )}
                          <ActionButton tone="quiet" arrow={false} disabled={addrBusy === a.id}
                            onClick={() => removeAddress(a.id)}>
                            {addrBusy === a.id ? 'Working…' : 'Remove'}
                          </ActionButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {!addrOpen ? (
                  <div className="mt-8">
                    <ActionButton tone="quiet" onClick={() => setAddrOpen(true)}>Add an address</ActionButton>
                  </div>
                ) : (
                  <form onSubmit={addAddress} noValidate className="mt-8 max-w-[26rem] space-y-7 border-t border-ink-edge/60 pt-8">
                    {([
                      ['full_name', 'Full name', 'name'],
                      ['phone', 'Mobile number', 'tel'],
                      ['address_line1', 'Address', 'address-line1'],
                      ['address_line2', 'Address, second line (optional)', 'address-line2'],
                      ['city', 'City', 'address-level2'],
                      ['state', 'State', 'address-level1'],
                      ['pincode', 'Pincode', 'postal-code'],
                    ] as [keyof AddrDraft, string, string][]).map(([key, label, ac]) => (
                      <Field
                        key={key}
                        label={label}
                        name={key}
                        autoComplete={ac}
                        value={draft[key] ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      />
                    ))}
                    <div className="flex items-center gap-8 pt-2">
                      <ActionButton type="submit" disabled={addrSaving}>
                        {addrSaving ? 'Saving…' : 'Save address'}
                      </ActionButton>
                      <ActionButton tone="quiet" arrow={false} type="button"
                        onClick={() => { setAddrOpen(false); setDraft(EMPTY_ADDR); }}>
                        Cancel
                      </ActionButton>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>

          {/* ── Password ─────────────────────────────────────────────── */}
          <section id="password" className="mt-[9vh] scroll-mt-32 border-t border-ink-edge/60 pt-10">
            <h2 className="font-display text-band font-light text-paper">Password</h2>
            {/* Asked directly: "why password change is showing". Because this is
                the only way to change it while you still know it — the reset
                flow is for when you do not, and it costs an email round trip.
                Saying so is cheaper than being asked a second time. */}
            <p className="mt-3 max-w-[38ch] text-paper-muted">
              Change it whenever you like — you will need the current one. If you have
              forgotten it, sign out and use &ldquo;Forgotten password&rdquo; instead.
            </p>
            <form onSubmit={savePassword} noValidate className="mt-8 max-w-[26rem] space-y-7">
              <Field
                label="Current password"
                name="current_password"
                type="password"
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => { setCurrentPw(e.target.value); setPwError(''); }}
              />
              <Field
                label="New password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setPwError(''); }}
                hint="At least 8 characters, with an uppercase, a lowercase, a number and a symbol."
              />
              <Field
                label="Confirm new password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwError(''); }}
                error={pwError || undefined}
              />
              <div className="pt-2">
                <ActionButton type="submit" disabled={savingPw}>
                  {savingPw ? 'Changing…' : 'Change password'}
                </ActionButton>
              </div>
            </form>
          </section>

          {/* ── Devices ──────────────────────────────────────────────── */}
          <section id="devices" className="mt-[9vh] scroll-mt-32 border-t border-ink-edge/60 pt-10">
            <h2
              ref={devicesHeading}
              tabIndex={-1}
              className="font-display text-band font-light text-paper focus:outline-none"
            >
              Devices signed in
            </h2>
            <p className="mt-5 max-w-[54ch] text-lede text-paper-muted">
              You can be signed in on up to four devices at once. If you see one you do not
              recognise, sign it out and change your password.
            </p>

            {/**
              * Sign out everywhere. One server-side transaction, not a loop over
              * the list — see authAPI.revokeAllSessions for why that distinction
              * is the whole point of this control existing.
              *
              * Only shown when there is something to do. A button that reports
              * "no other devices were signed in" is a button that should not
              * have been offered.
              */}
            {!sessionsLoading && !sessionsError && sessions.filter((s) => !s.is_current).length > 0 && (
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                <button
                  type="button"
                  onClick={revokeAll}
                  onBlur={() => setConfirmingAll(false)}
                  disabled={revokingAll}
                  className="text-caption uppercase text-paper-faint underline decoration-brass/50 underline-offset-4 transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright disabled:opacity-50"
                >
                  {revokingAll
                    ? 'Signing out…'
                    : confirmingAll
                      ? 'Tap again to confirm'
                      : 'Sign out all other devices'}
                </button>
                {confirmingAll && (
                  <span className="text-caption text-paper-faint">
                    This one stays signed in.
                  </span>
                )}
              </div>
            )}

            {sessionsLoading && (
              <Skeleton label="Loading your devices">
                <div className="mt-8 space-y-6">
                  {[0, 1].map((i) => (
                    <div key={i} className="space-y-3 border-t border-ink-edge/60 pt-6">
                      <SkeletonLine w="w-20" h="h-2" />
                      <SkeletonLine w="w-2/3" h="h-4" />
                      <SkeletonLine w="w-1/3" h="h-3" />
                    </div>
                  ))}
                </div>
              </Skeleton>
            )}

            {sessionsError && !sessionsLoading && (
              <ErrorState
                title="We could not load your devices"
                body="Your account is fine — this is a problem reaching our server."
                onRetry={loadSessions}
                fallbackHref="/orders"
                fallbackLabel="Your orders"
              />
            )}

            {!sessionsLoading && !sessionsError && (
              <ul className="mt-8">
                {sessions.map((s) => {
                  const busy = revokingId === s.id;
                  const confirming = confirmingId === s.id;
                  return (
                    <li key={s.id} className="border-t border-ink-edge/60 py-6 first:border-t-0 first:pt-0">
                      <div className="flex items-start justify-between gap-5">
                        <div className="min-w-0">
                          <p className="text-rule uppercase text-paper-faint">
                            {s.device_type === 'mobile' ? 'Phone' : s.device_type === 'tablet' ? 'Tablet' : 'Computer'}
                            {s.is_current && <span className="text-brass-bright"> · This device</span>}
                          </p>
                          <p className="mt-1.5 text-paper">{describeDevice(s)}</p>
                          {s.location && <p className="mt-1 text-xs text-paper-faint">{s.location}</p>}
                          <p
                            className="mt-1 text-xs text-paper-faint"
                            title={s.last_active_at ? new Date(s.last_active_at).toLocaleString() : undefined}
                          >
                            {relativeTime(s.last_active_at)}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {/* Signing out the current device ends the session
                              being used to read this, so it is confirmed and
                              worded as what it does. */}
                          {confirming ? (
                            <div className="flex flex-col items-end gap-2">
                              <p className="text-xs text-paper-muted">Sign out this device?</p>
                              <div className="flex items-center gap-5">
                                <ActionButton tone="lead" arrow={false} disabled={busy} onClick={() => revoke(s)}>
                                  {busy ? 'Signing out…' : 'Yes, sign out'}
                                </ActionButton>
                                <ActionButton tone="quiet" arrow={false} onClick={() => setConfirmingId(null)}>
                                  Keep
                                </ActionButton>
                              </div>
                            </div>
                          ) : (
                            <ActionButton
                              tone="quiet"
                              arrow={false}
                              disabled={busy}
                              onClick={() => (s.is_current ? setConfirmingId(s.id) : revoke(s))}
                              aria-label={`Sign out ${describeDevice(s)}`}
                            >
                              {busy ? 'Signing out…' : 'Sign out'}
                            </ActionButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* "Sign out everywhere" is above, and it is a single atomic
                call. This note used to say the feature was deliberately absent
                while it waited for a real endpoint — AUTH-SPEC R5 shipped that
                endpoint and the button was wired to it, but the note was never
                removed, so the file contradicted itself a hundred lines apart.
                Doing it as N client-side DELETEs remains wrong for the original
                reason: not atomic, and a partial failure leaves somebody
                believing they are safe when they are not. */}
          </section>

          {/**
            * Leaving, in order of how permanent it is.
            *
            * "Switch account" is a sign-out that lands on the sign-in page
            * rather than the homepage, so somebody handing the phone over
            * arrives where they need to be. It is deliberately NOT the
            * multi-account switch: keeping two accounts signed in at once
            * fights a backend that caps a customer at four devices and emails
            * them about every new sign-in.
            */}
          <div className="mt-[9vh] flex flex-col items-start gap-6 border-t border-ink-edge/60 pt-10">
            <p className="text-rule uppercase text-paper-faint">Leaving</p>
            <ActionButton tone="quiet" arrow={false} onClick={() => performLogout('/auth/login')}>
              Switch account
            </ActionButton>
            <ActionButton tone="quiet" arrow={false} onClick={() => performLogout()}>
              Sign out
            </ActionButton>
            <ActionLink href="/account/delete" tone="quiet" arrow={false}>
              Close your account
            </ActionLink>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function AccountPage() {
  return (
    <RouteErrorBoundary routeName="your account" fallbackHref="/" fallbackLabel="Return home">
      <AccountInner />
    </RouteErrorBoundary>
  );
}
