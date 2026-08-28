/**
 * How long a sign-in code has left, and when another may be asked for.
 *
 * WHY THIS IS A FILE AND NOT FOUR LINES IN THE COMPONENT. The sign-in screen
 * had no way to ask for a second code at all. A code lasts ten minutes; a
 * customer who did not see the email inside that window — it went to spam, the
 * phone was in another room, the mail server was slow — had no route forward
 * except starting sign-in over, and nothing on screen said so. Most people
 * conclude the shop is broken and leave.
 *
 * The fix needs two countdowns that must never disagree with each other: how
 * long this code lasts, and how long until another is allowed. Deriving both
 * from a single send time is what guarantees that, and putting the derivation
 * here means it can be tested in Node — this project deliberately runs no
 * jsdom, on the grounds that a component test against a fake DOM is how you get
 * a passing test and a broken page. The component keeps only the rendering.
 */

/** Matches `_create_otp` on the server: ten minutes, not negotiable here. */
export const CODE_TTL_SECONDS = 10 * 60;

/**
 * How long before another code may be asked for.
 *
 * The server allows five sends a minute. Thirty seconds keeps a determined
 * customer comfortably inside that, so the button they can see is never the one
 * that answers "too many requests" — a control that is offered and then refuses
 * is worse than one that is honestly still counting down.
 */
export const RESEND_AFTER_SECONDS = 30;

export interface CodeTimer {
  /** Seconds this code is still good for. Zero once it has expired. */
  expiresIn: number;
  /** True once the code can no longer work. False before a code was sent. */
  expired: boolean;
  /** Seconds until another code may be requested. Zero when it may be. */
  resendIn: number;
  /** True when a new code may be requested right now. */
  canResend: boolean;
}

/**
 * Both countdowns, from the one send time.
 *
 * `sentAt` of null means no code has been sent yet: nothing has expired and
 * nothing may be resent, which is different from "expired" and must not be
 * collapsed into it — a null read as expired would show "that code has
 * expired" to somebody who has not been sent one.
 *
 * A clock that jumps backwards (a device correcting its time, a resumed
 * laptop) would otherwise produce a countdown longer than the code's life, so
 * elapsed time is floored at zero.
 */
export function codeTimer(sentAt: number | null, now: number): CodeTimer {
  if (sentAt === null) {
    return { expiresIn: CODE_TTL_SECONDS, expired: false, resendIn: RESEND_AFTER_SECONDS, canResend: false };
  }
  const elapsed = Math.max(0, Math.floor((now - sentAt) / 1000));
  const expiresIn = Math.max(0, CODE_TTL_SECONDS - elapsed);
  const resendIn = Math.max(0, RESEND_AFTER_SECONDS - elapsed);
  return { expiresIn, expired: expiresIn === 0, resendIn, canResend: resendIn === 0 };
}

/**
 * The remaining life, in words.
 *
 * Deliberately vague rather than a ticking mm:ss. A precise clock counting
 * down on a security step reads as pressure, and pressure is what makes people
 * mistype a code they are copying from another device. "About nine minutes" is
 * all anybody needs to decide whether to wait or ask for another.
 */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'no time';
  if (seconds < 60) return 'less than a minute';
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'about a minute' : `about ${minutes} minutes`;
}
