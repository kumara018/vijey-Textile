'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Recent searches, the way a shop that expects return visits does it.
 *
 * WHY THIS IS WORTH HAVING. Somebody looking for a lehenga for a wedding does
 * not decide in one visit. They search, leave, come back, and search the same
 * thing again — retyping it on a phone keyboard every time. Showing what they
 * looked for last removes that, and it is the reason every large storefront
 * keeps this list.
 *
 * WHY EACH ENTRY CAN BE REMOVED ON ITS OWN, and not only cleared wholesale. A
 * search history is personal. Somebody buying a gift, or who mistyped
 * something they would rather not see suggested to whoever picks up the phone
 * next, needs to remove ONE line without losing the rest. Offering only "clear
 * everything" makes the private case cost the useful case, so people stop
 * using the feature. Both operations exist here for that reason.
 *
 * localStorage rather than the server: this is a convenience, not an account
 * record. Keeping it on the device means it needs no login, survives a signed
 * out visit, never travels over the network, and is genuinely gone when the
 * customer clears it — there is no copy of it anywhere else to reconcile.
 *
 * Reading happens in an effect rather than in the initial state, because
 * localStorage does not exist while this renders on the server, and reaching
 * for it there throws.
 */

/**
 * The list rules, as pure functions.
 *
 * Pulled out of the hook deliberately. This project's test suite runs in Node
 * with no jsdom, on the grounds that a component test against a fake DOM is
 * how you get a passing test and a broken page. That is a good rule, and it
 * means the interesting logic here — de-duplication, ordering, the cap — has
 * to live somewhere it can be tested without pretending to be a browser.
 * These take a list and return a list; the hook only wires them to storage.
 */

/** The shortest term worth remembering. One character is noise. */
export const MIN_TERM = 2;

/** How many to keep. Beyond this the list stops being a shortcut. */
export const LIMIT = 8;

/**
 * Add a term. Case-insensitive de-duplication, and a repeat moves to the
 * front — searching the same thing again is the strongest signal it is still
 * what somebody is looking for. Returns the list unchanged if the term is too
 * short to be worth keeping.
 */
export function nextHistory(prev: string[], raw: string): string[] {
  const term = raw.trim();
  if (term.length < MIN_TERM) return prev;
  const without = prev.filter((t) => t.toLowerCase() !== term.toLowerCase());
  return [term, ...without].slice(0, LIMIT);
}

/** Remove one term, matched exactly as stored. */
export function withoutTerm(prev: string[], term: string): string[] {
  return prev.filter((t) => t !== term);
}

const KEY = 'vijey.searchHistory';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    // Corrupt or unavailable (private mode, storage disabled). A missing
    // history is a missing convenience, never an error worth surfacing.
    return [];
  }
}

function write(terms: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(terms));
  } catch {
    /* Storage full or blocked — the search itself still works. */
  }
}

export function useSearchHistory() {
  const [terms, setTerms] = useState<string[]>([]);

  useEffect(() => { setTerms(read()); }, []);

  /** Record a term that was actually searched for. */
  const record = useCallback((raw: string) => {
    setTerms((prev) => {
      const next = nextHistory(prev, raw);
      if (next !== prev) write(next);
      return next;
    });
  }, []);

  /** Remove one line. */
  const remove = useCallback((term: string) => {
    setTerms((prev) => {
      const next = withoutTerm(prev, term);
      write(next);
      return next;
    });
  }, []);

  /** Remove all of it. */
  const clear = useCallback(() => {
    setTerms([]);
    write([]);
  }, []);

  return { terms, record, remove, clear };
}
