'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api, { addressAPI } from '@/lib/api';

/**
 * Where this order is going — the line Amazon puts in its header.
 *
 * WHY IT IS WORTH HAVING IN A SHOP THIS SIZE. Everything here ships from one
 * counter in Erode. The question a customer three states away actually has,
 * before they look at a single piece, is "do you even come to me" — and until
 * now the only way to find out was to fill a bag, sign in, and reach checkout.
 * That is the most expensive possible moment to learn the answer is no.
 *
 * TWO SOURCES OF TRUTH, IN ORDER OF HOW MUCH THEY ARE WORTH.
 *
 *   A SIGNED-IN CUSTOMER'S USUAL ADDRESS. Real, already theirs, and it carries
 *   a city we can print without guessing. Nothing is fetched or invented.
 *
 *   A PINCODE THEY TYPED. Kept in localStorage, so it survives the visit. It
 *   shows the pincode and NOT a city — the obvious move is to look the place
 *   up and print "Deliver to Coimbatore 641001", but the shipping API returns
 *   no place name, so that would mean a second service and a name this shop
 *   cannot vouch for. A wrong city under a "Deliver to" heading is worse than
 *   no city: it reads as the site knowing something about you, incorrectly.
 *
 * AND A THIRD STATE THAT MATTERS MORE THAN EITHER. When the courier API is
 * unconfigured or does not answer, the endpoint returns `checked: false`, and
 * this says "we will confirm" rather than "we do not deliver there". Telling
 * somebody the shop cannot reach them because a call timed out would lose an
 * order the shop could have fulfilled.
 */

const KEY = 'delivery_pincode';

interface Known { pincode?: string; city?: string; name?: string; assumed?: boolean; unknown?: boolean }

export default function DeliverTo() {
  const { user } = useAuth();
  const [known, setKnown] = useState<Known | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /* The saved usual address wins — it is real, and it has a city. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user) {
        try {
          const res = await addressAPI.getAll();
          const rows: any[] = res.data ?? [];
          const usual = rows.find((a) => a.is_default) ?? rows[0];
          if (usual && !cancelled) {
            setKnown({ pincode: usual.pincode, city: usual.city, name: usual.full_name });
            return;
          }
        } catch { /* fall through to the typed pincode */ }
      }
      if (cancelled) return;
      const saved = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
      if (saved) { setKnown({ pincode: saved }); return; }

      /**
       * NOT SIGNED IN AND NOTHING TYPED: ASK THE CONNECTION, NOT THE SHOP.
       *
       * This used to fall back to the SHOP'S own pincode — 638004, Erode. It
       * was labelled as an assumption, and it is still the wrong thing to
       * show: a customer in Chennai reads a specific pincode as a statement
       * about where THEY are, and it is simply false. "Deliver to Erode
       * 638004" to somebody who has never told us anything is a claim, not a
       * default.
       *
       * /api/geo resolves it from the IP at Vercel's edge — no permission
       * prompt, no third-party call, nothing to rate-limit. GPS is not used
       * here on purpose: a location prompt on arrival, before a customer has
       * seen a single piece, is an interruption most people dismiss, and the
       * dismissal sticks. GPS belongs at checkout, where somebody is already
       * filling in an address, and that is where it is.
       *
       * If the edge cannot place the IP — running locally, a VPN, a mobile
       * carrier's range — it says so and the control shows "Choose your
       * location" rather than inventing one. An honest blank beats a precise
       * fiction.
       */
      try {
        const res = await fetch('/api/geo');
        const geo = await res.json();
        if (cancelled) return;
        if (geo?.found && (geo.city || geo.pincode)) {
          setKnown({ pincode: geo.pincode ?? undefined, city: geo.city ?? undefined, assumed: true });
          return;
        }
      } catch { /* offline or blocked — fall through to asking */ }
      if (!cancelled) setKnown({ unknown: true });
    })();
    return () => { cancelled = true; };
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = draft.trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) { setNote('That is not a six-digit pincode.'); return; }
    setBusy(true); setNote(null);
    try {
      const res = await api.get('/api/shipping/serviceability', { params: { pincode: pin } });
      const d = res.data ?? {};
      localStorage.setItem(KEY, pin);
      setKnown({ pincode: pin });
      setEditing(false);
      if (d.checked === false) setNote('Saved. We will confirm delivery when you order.');
      else if (d.serviceable === false) setNote('We do not reach that pincode yet — call the counter and we will try.');
      else setNote(null);
    } catch {
      /* Still save it. The customer told us where they are; a failed check is
         our problem, not a reason to forget their pincode. */
      localStorage.setItem(KEY, pin);
      setKnown({ pincode: pin });
      setEditing(false);
      setNote('Saved. We will confirm delivery when you order.');
    } finally {
      setBusy(false);
    }
  };

  const Pin = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M8 14.5S13 10.2 13 6.6A5 5 0 0 0 3 6.6C3 10.2 8 14.5 8 14.5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="8" cy="6.5" r="1.7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {editing ? (
        <form onSubmit={save} className="flex items-center gap-3">
          <span className="text-brass-bright"><Pin /></span>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            aria-label="Your pincode"
            placeholder="Pincode"
            className="w-24 border-b border-brass-bright bg-transparent pb-1 text-caption uppercase tracking-[0.12em] text-paper placeholder:text-paper-faint focus:outline-none"
          />
          <button type="submit" disabled={busy}
            className="text-caption uppercase text-paper transition-colors duration-500 hover:text-brass-bright disabled:text-paper-faint">
            {busy ? 'Checking…' : 'Save'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setNote(null); }}
            className="text-caption uppercase text-paper-faint transition-colors duration-500 hover:text-paper">
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(known?.pincode ?? ''); setEditing(true); }}
          className="group flex items-center gap-2 text-caption uppercase text-paper-muted transition-colors duration-500 hover:text-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
        >
          <span className="text-brass-bright"><Pin /></span>
          {/**
            * THREE STATES, AND THEY MUST NOT LOOK ALIKE.
            *
            *   known      a saved address or a pincode the customer typed —
            *              stated plainly, because it is a fact.
            *   detected   resolved from the connection — shown, but the
            *              control reads "Change" so it is clearly a starting
            *              point rather than a record of anything they said.
            *   unknown    the edge could not place the IP. It asks instead of
            *              inventing a pincode. Showing the shop's own city
            *              here, which is what it used to do, tells a customer
            *              in Chennai they are in Erode.
            */}
          {known?.unknown ? (
            <>
              <span className="text-paper group-hover:text-brass-bright">Choose your location</span>
            </>
          ) : (
            <>
              Deliver to{' '}
              <span className="text-paper group-hover:text-brass-bright">
                {/* Signed in, the name comes first — it is how a customer
                    recognises WHICH of their addresses this is, and it is the
                    only visible sign the shop knows who they are. */}
                {[known?.name?.split(' ')[0], known?.city, known?.pincode].filter(Boolean).join(' ')}
              </span>
              <span className="text-brass-bright" aria-hidden="true">&middot;</span>
              <span className="text-brass-bright">Change</span>
            </>
          )}
        </button>
      )}

      {note && <span className="text-caption text-paper-faint">{note}</span>}
    </div>
  );
}
