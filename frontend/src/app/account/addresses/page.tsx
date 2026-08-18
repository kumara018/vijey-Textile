'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { addressAPI } from '@/lib/api';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { Field } from '@/components/system/Field';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { ErrorState, SkeletonLine, Announce } from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * Saved addresses.
 *
 * `addressAPI` has had getAll / add / update / remove / setDefault since it was
 * written, and no page in this shop ever called one of them. A customer could
 * save an address during checkout and then had no way to see it, correct it or
 * delete it — so a wrong pincode on the address every future order defaults to
 * was permanent. This is that feature finally having somewhere to live.
 */

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

const EMPTY: AddrDraft = {
  label: 'Home', full_name: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', pincode: '',
};

function AddressesInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<Addr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AddrDraft>(EMPTY);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1800);
    return () => clearTimeout(t);
  }, [announcement]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await addressAPI.getAll();
      setRows(res.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (!user) return null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: (keyof AddrDraft)[] = ['full_name', 'phone', 'address_line1', 'city', 'state', 'pincode'];
    if (required.some((k) => !String(draft[k] ?? '').trim())) {
      setAnnouncement('Every line except the second address line is needed.');
      return;
    }
    setSaving(true);
    try {
      await addressAPI.add({ ...draft, is_default: rows.length === 0 });
      setDraft(EMPTY);
      setOpen(false);
      await load();
      setAnnouncement('Address saved.');
    } catch {
      setAnnouncement('We could not save that address.');
    } finally {
      setSaving(false);
    }
  };

  const makeUsual = async (id: number) => {
    setBusy(id);
    try { await addressAPI.setDefault(id); await load(); setAnnouncement('Usual address changed.'); }
    catch { setAnnouncement('We could not change that.'); }
    finally { setBusy(null); }
  };

  const remove = async (id: number) => {
    setBusy(id);
    try { await addressAPI.remove(id); setRows((p) => p.filter((a) => a.id !== id)); setAnnouncement('Address removed.'); }
    catch { setAnnouncement('We could not remove that.'); }
    finally { setBusy(null); }
  };

  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow="Your account"
        title="Saved addresses"
        standfirst="Somewhere to send a piece without writing it out again. The usual one is filled in for you at checkout."
      />

      <Announce message={announcement} />

      <div className="mb-10">
        <ActionLink href="/account" tone="quiet" arrow={false}>&larr; Your account</ActionLink>
      </div>

      {error ? (
        <ErrorState
          title="We could not load your addresses"
          body="Your account is fine — this is a problem reaching our server."
          onRetry={load}
        />
      ) : loading ? (
        <div className="space-y-3"><SkeletonLine /><SkeletonLine /><SkeletonLine /></div>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="text-paper-muted">None saved yet.</p>
          ) : (
            <ul>
              {rows.map((a, i) => (
                <li
                  key={a.id}
                  className={`flex flex-wrap items-start gap-x-8 gap-y-3 py-6 ${i > 0 ? 'border-t border-ink-edge/60' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-paper">
                      {a.full_name}
                      {a.is_default && <span className="ml-3 text-rule uppercase text-brass-bright">Usual</span>}
                    </p>
                    <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-paper-muted">
                      {a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}, {a.city}, {a.state} {a.pincode}
                    </p>
                    <p className="mt-1.5 text-rule uppercase text-paper-faint">{a.phone}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-6">
                    {!a.is_default && (
                      <ActionButton tone="quiet" arrow={false} disabled={busy === a.id} onClick={() => makeUsual(a.id)}>
                        Make usual
                      </ActionButton>
                    )}
                    <ActionButton tone="quiet" arrow={false} disabled={busy === a.id} onClick={() => remove(a.id)}>
                      {busy === a.id ? 'Working…' : 'Remove'}
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!open ? (
            <div className="mt-10">
              <ActionButton tone="quiet" onClick={() => setOpen(true)}>Add an address</ActionButton>
            </div>
          ) : (
            <form onSubmit={add} noValidate className="mt-10 max-w-[26rem] space-y-7 border-t border-ink-edge/60 pt-10">
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
                <ActionButton type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save address'}
                </ActionButton>
                <ActionButton tone="quiet" arrow={false} type="button"
                  onClick={() => { setOpen(false); setDraft(EMPTY); }}>
                  Cancel
                </ActionButton>
              </div>
            </form>
          )}
        </>
      )}
    </PageShell>
  );
}

export default function AddressesPage() {
  return (
    <RouteErrorBoundary routeName="your addresses" fallbackHref="/account" fallbackLabel="Back to your account">
      <AddressesInner />
    </RouteErrorBoundary>
  );
}
