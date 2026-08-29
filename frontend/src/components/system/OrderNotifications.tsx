'use client';

import { useEffect, useState } from 'react';
import { enablePush, disablePush, isSubscribed, permissionState } from '@/lib/push';

/**
 * "Tell me when this moves" — on the order page, after the order exists.
 *
 * WHY IT IS HERE AND NOT ON THE SHOPFRONT. A notification prompt is asked once
 * and remembered forever. Ask on arrival and almost everybody dismisses it,
 * because they have no reason yet to want anything — and the browser records
 * that as a refusal it will never revisit. The chance is spent on the worst
 * possible moment.
 *
 * Somebody looking at an order they have just paid for has the reason. That is
 * the moment the prompt is an answer to a question they already have, rather
 * than an interruption.
 *
 * WHY IT IS OFFERED AT ALL. It is the only channel this shop has that nobody
 * can price or switch off. SMS always costs. WhatsApp's free service window
 * closes on 1 October 2026. This costs nothing, forever, worldwide.
 *
 * It never replaces the email. A customer who says no must not quietly stop
 * hearing about their order.
 */
export default function OrderNotifications() {
  const [state, setState] = useState<'checking' | 'off' | 'on' | 'blocked' | 'unavailable'>('checking');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = permissionState();
      if (permission === 'unsupported') { if (!cancelled) setState('unavailable'); return; }
      if (permission === 'denied') { if (!cancelled) setState('blocked'); return; }
      const already = await isSubscribed();
      if (!cancelled) setState(already ? 'on' : 'off');
    })();
    return () => { cancelled = true; };
  }, []);

  // Nothing is rendered where nothing can be done. A control that cannot work
  // is worse than no control: it invites a press and then does nothing.
  if (state === 'checking' || state === 'unavailable') return null;

  const turnOn = async () => {
    setBusy(true); setNote(null);
    const outcome = await enablePush();
    setBusy(false);

    if (outcome.ok) { setState('on'); setNote(null); return; }

    // Each refusal means something different and needs a different sentence.
    // "Something went wrong" here would leave somebody re-pressing a button
    // their own browser has already refused.
    setNote(
      outcome.reason === 'denied'
        ? 'Your browser has blocked notifications for this site. You can allow them in the padlock menu beside the address bar.'
        : outcome.reason === 'dismissed'
          ? 'No problem — we will still email you about this order.'
          : outcome.reason === 'not-configured'
            ? 'Notifications are not switched on for this shop yet.'
            : 'We could not switch that on just now. Your order updates will still come by email.',
    );
    if (outcome.reason === 'denied') setState('blocked');
  };

  const turnOff = async () => {
    setBusy(true); setNote(null);
    await disablePush();
    setBusy(false);
    setState('off');
    setNote('Turned off on this device. Emails continue as normal.');
  };

  return (
    <section
      aria-labelledby="notify-heading"
      className="mt-[6vh] border-t border-ink-edge/60 pt-8"
    >
      <h2 id="notify-heading" className="text-rule uppercase text-brass-bright">
        Updates on this device
      </h2>

      {state === 'blocked' ? (
        <p className="mt-4 max-w-[54ch] text-paper-muted">
          Notifications are blocked for this site in your browser. You can allow them from the
          padlock beside the address bar — until then we will email you, as always.
        </p>
      ) : (
        <>
          <p className="mt-4 max-w-[54ch] text-paper-muted">
            {state === 'on'
              ? 'This device will buzz when your parcel is packed, sent and out for delivery. You will still get every email.'
              : 'We can buzz this device the moment your parcel is packed, sent and out for delivery — alongside the emails, never instead of them.'}
          </p>

          <button
            type="button"
            onClick={state === 'on' ? turnOff : turnOn}
            disabled={busy}
            className="mt-6 text-caption uppercase text-paper underline decoration-brass/60 underline-offset-4 transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright disabled:opacity-50"
          >
            {busy
              ? 'Just a moment…'
              : state === 'on'
                ? 'Turn off on this device'
                : 'Notify me on this device'}
          </button>
        </>
      )}

      {note && (
        <p role="status" className="mt-4 max-w-[54ch] text-caption text-paper-faint">
          {note}
        </p>
      )}
    </section>
  );
}
