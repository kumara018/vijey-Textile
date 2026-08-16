'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supportAPI } from '@/lib/api';
import AuthShell from '@/components/system/AuthShell';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { Announce } from '@/components/system/States';

/**
 * Rate a support conversation.
 *
 * Reached from a one-time link in an email, by someone who is not necessarily
 * signed in and who arrived to do exactly one thing. So it uses AuthShell —
 * the same stripped frame as sign-in: logo, one card, no navigation. A page
 * with a single job should not offer a menu.
 *
 * THE RATING IS A RADIOGROUP, NOT A ROW OF STARS.
 *
 * The old version was five buttons with a hover state and an emoji caption.
 * That is unusable without a mouse: no arrow-key movement, no announced
 * selection, and the value lived in a hover variable. Radios give arrow keys,
 * one tab stop, and "4 of 5" read out — and the visible mark is driven by
 * :checked, so the keyboard and the pointer agree.
 *
 * A token that is expired or already used is a normal outcome here, not an
 * error: people click these links twice, or a week late. It is worded as a
 * fact rather than a failure.
 */

const SCALE = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Not good' },
  { value: 3, label: 'Fine' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
];

export default function RateSupportPage() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let cancelled = false;
    supportAPI
      .getRatingPage(token)
      .then((res) => { if (!cancelled) setInfo(res.data); })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err?.response?.data?.detail ||
            'This link has expired or has already been used.',
        );
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1500);
    return () => clearTimeout(t);
  }, [announcement]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setFormError('Choose a rating first.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      // submitTokenRating, not submitRating: the latter posts to
      // /api/support/rating, a different (authenticated) endpoint. The
      // token-scoped one is POST /api/support/rate/{token}.
      await supportAPI.submitTokenRating(token, { rating, comment: comment.trim() || undefined });
      setSubmitted(true);
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'We could not save that. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthShell title="One moment">
        <p className="text-sm text-paper-muted">Checking your link…</p>
      </AuthShell>
    );
  }

  if (loadError) {
    return (
      <AuthShell
        title="This link is no longer active"
        standfirst={loadError}
      >
        <p className="text-sm leading-relaxed text-paper-muted">
          Rating links work once and expire after a while. If you still want to tell us how it
          went, reply to the email or call the shop — we would rather hear it late than not
          at all.
        </p>
        <div className="mt-8">
          <ActionLink href="/support">Ways to reach us</ActionLink>
        </div>
      </AuthShell>
    );
  }

  if (submitted) {
    return (
      <AuthShell title="Thank you" standfirst="Your rating has been recorded.">
        <p className="text-sm leading-relaxed text-paper-muted">
          A real person reads these. If something went wrong and you would like it put right,
          tell us and we will.
        </p>
        <div className="mt-8">
          <ActionLink href="/products">See every piece</ActionLink>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="How did we do?"
      standfirst={
        info?.agent_name
          ? `About your conversation with ${info.agent_name}.`
          : 'About your recent conversation with us.'
      }
    >
      <Announce message={announcement} />

      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend className="text-rule uppercase text-paper-faint">Your rating</legend>
          <div className="mt-5 space-y-1">
            {SCALE.map((s) => (
              <label
                key={s.value}
                className={`flex cursor-pointer items-baseline gap-4 border-b border-ink-edge/40 py-3 transition-colors duration-500 motion-reduce:transition-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-bright ${
                  rating === s.value ? 'text-paper' : 'text-paper-muted hover:text-paper'
                }`}
              >
                <input
                  type="radio"
                  name="rating"
                  value={s.value}
                  checked={rating === s.value}
                  onChange={() => { setRating(s.value); setFormError(''); setAnnouncement(`${s.value} of 5, ${s.label}.`); }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`text-rule tabular-nums ${rating === s.value ? 'text-brass-bright' : 'text-paper-faint'}`}
                >
                  {s.value}
                </span>
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-8">
          <label htmlFor="comment" className="block text-rule uppercase text-paper-faint">
            Anything else? (optional)
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-2.5 w-full resize-y border-b border-ink-edge bg-transparent pb-2.5 text-paper transition-colors duration-500 motion-reduce:transition-none focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
          />
        </div>

        {formError && (
          <p role="alert" className="mt-5 text-xs text-brass-bright">{formError}</p>
        )}

        <div className="mt-9">
          <ActionButton type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send rating'}
          </ActionButton>
        </div>
      </form>
    </AuthShell>
  );
}
