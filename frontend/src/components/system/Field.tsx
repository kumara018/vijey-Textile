'use client';

import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';

/**
 * A labelled text field, and the step frame the auth flow moves between.
 *
 * The accessibility here is the substance, not decoration:
 *
 *  - A real <label> bound by id. Placeholders are not labels — they vanish the
 *    moment someone types, which is exactly when a person checking what they
 *    are filling in needs them.
 *  - `aria-invalid` and `aria-describedby` wire the error to the field, so a
 *    screen reader reads the problem when focus lands rather than leaving it
 *    as unassociated red text elsewhere on screen.
 *  - The error is `role="alert"`, because it appears in response to an action
 *    and nothing navigated.
 *  - Focus is always visible, offset so the ring is not clipped by the border.
 */
export const Field = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'> & { label: string; error?: string; hint?: ReactNode }
>(function Field({ label, error, hint, className = '', ...rest }, ref) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="block text-rule uppercase text-paper-faint">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
        className={`mt-2.5 w-full border-b bg-transparent pb-2.5 text-lg text-paper placeholder:text-paper-faint/50 transition-colors duration-500 motion-reduce:transition-none focus:outline-none focus-visible:border-brass-bright ${
          error ? 'border-brass-bright' : 'border-ink-edge focus:border-paper-faint'
        } ${className}`}
      />
      {hint && !error && (
        <p id={hintId} className="mt-2 text-xs text-paper-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs text-brass-bright">
          {error}
        </p>
      )}
    </div>
  );
});

/**
 * One step of the flow.
 *
 * The transition between identifier and password is the only motion on these
 * screens: a 480ms fade with a small rise, well inside the 400–600ms band and
 * with no spring or bounce — a form that overshoots reads as unserious.
 *
 * It is decoration over an already-rendered step. Nothing waits on it, so a
 * fast typist who hits Enter twice is never blocked, and `motion-reduce`
 * removes it entirely.
 */
export function Step({
  children,
  /** Changing this re-runs the entrance — pass the step name. */
  stepKey,
}: {
  children: ReactNode;
  stepKey: string;
}) {
  return (
    <div key={stepKey} className="auth-step">
      {children}
    </div>
  );
}
