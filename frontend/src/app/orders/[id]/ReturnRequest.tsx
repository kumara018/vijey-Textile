'use client';

import { useRef, useState } from 'react';
import { returnsAPI } from '@/lib/api';
import type { ReturnRequestCreatePayload } from '@/lib/contracts';
import type { Order } from '@/types';
import { ActionButton } from '@/components/system/Action';
import { Announce } from '@/components/system/States';

/**
 * Raising a return or an exchange.
 *
 * Extracted from the order page because it is a form with its own rules, and
 * a 1,100-line route was how the old version stopped being reviewable.
 *
 * THE RULES ARE THE SERVER'S, RESTATED HONESTLY:
 *   · reason is a closed set of two — size_issue or damage. Not "change of
 *     mind", which the policy explicitly excludes, so the form never offers it
 *     and then rejects it.
 *   · 2 photos required, 3 allowed. Enforced here because the type cannot
 *     express it, and because a request rejected for too few photos after
 *     upload is a wasted round trip on a phone connection.
 *   · an exchange must be for the same price or more. The price difference is
 *     payable; there is no refund for choosing something cheaper.
 *
 * Photos upload one at a time as they are chosen, so a slow connection shows
 * progress rather than stalling on submit. Each uploaded photo can be removed,
 * and removing one moves focus to the group heading — the cart's lesson, in
 * the place it matters most, because these are the evidence for a refund.
 */

const REASONS = [
  { value: 'size_issue' as const, label: 'The size does not fit' },
  { value: 'damage' as const, label: 'It arrived damaged' },
];

export default function ReturnRequest({
  order,
  onRaised,
  canReturn,
  canExchange,
}: {
  order: Order;
  onRaised: () => void;
  canReturn: boolean;
  canExchange: boolean;
}) {
  const items = (order.items_snapshot ?? []) as any[];

  const [type, setType] = useState<'return' | 'exchange' | ''>('');
  const [productId, setProductId] = useState<number | ''>(items.length === 1 ? items[0].product_id : '');
  const [reason, setReason] = useState<'size_issue' | 'damage' | ''>('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const photosHeading = useRef<HTMLParagraphElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 3 - images.length;
    if (room <= 0) { setError('Three photos is the maximum.'); return; }

    setUploading(true);
    setError('');
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await returnsAPI.uploadImage(form);
        setImages((prev) => [...prev, res.data.url]);
        setAnnouncement('Photo added.');
      } catch {
        setError('One of those photos would not upload. Try a smaller file.');
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
    setAnnouncement('Photo removed.');
    photosHeading.current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) { setError('Choose whether you want a refund or an exchange.'); return; }
    if (!productId) { setError('Choose which piece this is about.'); return; }
    if (!reason) { setError('Choose a reason.'); return; }
    if (images.length < 2) { setError('Two photos are required so we can see the problem. Three is the maximum.'); return; }

    setSubmitting(true);
    setError('');
    const payload: ReturnRequestCreatePayload = {
      order_id: order.id,
      product_id: Number(productId),
      request_type: type,
      reason,
      description: description.trim() || null,
      images,
    };
    try {
      await returnsAPI.create(payload);
      onRaised();
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'We could not raise that request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Announce message={announcement} />

      <fieldset>
        <legend className="text-rule uppercase text-paper-faint">What would you like?</legend>
        <div className="mt-4 flex flex-col gap-1">
          {canReturn && (
            <label className="flex cursor-pointer items-start gap-4 border-b border-ink-edge/40 py-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-bright">
              <input type="radio" name="request_type" className="sr-only"
                checked={type === 'return'} onChange={() => { setType('return'); setError(''); }} />
              <span aria-hidden="true" className={type === 'return' ? 'text-brass-bright' : 'text-paper-faint'}>—</span>
              <span>
                <span className={`block ${type === 'return' ? 'text-paper' : 'text-paper-muted'}`}>
                  Return for a refund
                </span>
                <span className="mt-1 block text-xs text-paper-faint">
                  Refunded to your original payment method once the piece is picked up.
                </span>
              </span>
            </label>
          )}
          {canExchange && (
            <label className="flex cursor-pointer items-start gap-4 border-b border-ink-edge/40 py-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-bright">
              <input type="radio" name="request_type" className="sr-only"
                checked={type === 'exchange'} onChange={() => { setType('exchange'); setError(''); }} />
              <span aria-hidden="true" className={type === 'exchange' ? 'text-brass-bright' : 'text-paper-faint'}>—</span>
              <span>
                <span className={`block ${type === 'exchange' ? 'text-paper' : 'text-paper-muted'}`}>
                  Exchange for something else
                </span>
                <span className="mt-1 block text-xs text-paper-faint">
                  Any piece of the same price or more — you pay only the difference. There is no
                  refund for choosing something cheaper. We will contact you to arrange the swap.
                </span>
              </span>
            </label>
          )}
        </div>
      </fieldset>

      {items.length > 1 && (
        <div className="mt-8">
          <label htmlFor="rr-product" className="block text-rule uppercase text-paper-faint">
            Which piece?
          </label>
          <select
            id="rr-product"
            value={productId}
            onChange={(e) => { setProductId(Number(e.target.value)); setError(''); }}
            className="mt-2.5 w-full border-b border-ink-edge bg-transparent pb-2.5 text-paper transition-colors duration-500 motion-reduce:transition-none focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
          >
            <option value="" className="bg-ink">Choose a piece</option>
            {items.map((it, i) => (
              <option key={i} value={it.product_id} className="bg-ink text-paper">
                {it.name}{it.size ? ` — size ${it.size}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="mt-8">
        <legend className="text-rule uppercase text-paper-faint">Why?</legend>
        <p className="mt-2 text-xs text-paper-faint">
          These are the only two reasons the policy allows. Change of mind is not one.
        </p>
        <div className="mt-4 flex flex-col gap-1">
          {REASONS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-center gap-4 border-b border-ink-edge/40 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-bright">
              <input type="radio" name="reason" className="sr-only"
                checked={reason === r.value} onChange={() => { setReason(r.value); setError(''); }} />
              <span aria-hidden="true" className={reason === r.value ? 'text-brass-bright' : 'text-paper-faint'}>—</span>
              <span className={reason === r.value ? 'text-paper' : 'text-paper-muted'}>{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8">
        <p ref={photosHeading} tabIndex={-1} className="text-rule uppercase text-paper-faint focus:outline-none">
          Photos — two required, three maximum
        </p>
        <p className="mt-2 text-xs text-paper-faint">
          Clear pictures of the problem. This is what the review is based on.
        </p>

        {images.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-3">
            {images.map((url, i) => (
              <li key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-24 w-20 border border-ink-edge object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="mt-1 block w-full text-center text-xs text-paper-faint transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {images.length < 3 && (
          <div className="mt-4">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => upload(e.target.files)}
              disabled={uploading}
              className="block w-full text-sm text-paper-muted file:mr-4 file:cursor-pointer file:border file:border-ink-edge file:bg-transparent file:px-5 file:py-2 file:text-xs file:uppercase file:tracking-[0.14em] file:text-paper hover:file:border-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            />
            {uploading && <p className="mt-2 text-xs text-paper-faint">Uploading…</p>}
          </div>
        )}
      </div>

      <div className="mt-8">
        <label htmlFor="rr-desc" className="block text-rule uppercase text-paper-faint">
          Anything else? (optional)
        </label>
        <textarea
          id="rr-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-2.5 w-full resize-y border-b border-ink-edge bg-transparent pb-2.5 text-paper transition-colors duration-500 motion-reduce:transition-none focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
        />
      </div>

      {error && <p role="alert" className="mt-6 text-sm text-brass-bright">{error}</p>}

      <div className="mt-9">
        <ActionButton type="submit" disabled={submitting || uploading}>
          {submitting ? 'Sending…' : 'Send request'}
        </ActionButton>
      </div>
    </form>
  );
}
