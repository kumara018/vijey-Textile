'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import Link from 'next/link';

/**
 * Per-route error boundary.
 *
 * A single uncaught render error takes down the entire React tree, and on a
 * persistent-canvas architecture that means the whole application — navigation,
 * cart, everything — replaced by a blank page. Scoping a boundary to each route
 * means a broken order-detail page costs the visitor that page, not their
 * session.
 *
 * The state deliberately says what actually happened and offers the two things
 * a stuck visitor genuinely wants: try again, or go somewhere that works. No
 * apology paragraph, no error code as decoration, and never a raw stack in
 * front of a customer.
 *
 * This is a class component because error boundaries have no hook equivalent —
 * `componentDidCatch` and `getDerivedStateFromError` are the only React APIs
 * that intercept a render error.
 */

interface Props {
  children: ReactNode;
  /** Where the error happened, for the message and for telemetry. */
  routeName: string;
  /** Optional escape hatch shown alongside "try again". */
  fallbackHref?: string;
  fallbackLabel?: string;
}

interface State {
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sentry picks this up through its global handler; the explicit context
    // makes the difference between "TypeError somewhere" and a route name.
    const sentry = (window as unknown as {
      Sentry?: { captureException: (e: Error, c?: unknown) => void };
    }).Sentry;

    sentry?.captureException(error, {
      tags: { route: this.props.routeName },
      contexts: { react: { componentStack: info.componentStack } },
    });

    console.error(`[route:${this.props.routeName}]`, error);
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallbackHref = '/', fallbackLabel = 'Go to the shop' } = this.props;

    return (
      <section
        role="alert"
        aria-live="assertive"
        className="mx-auto flex min-h-[60svh] w-full max-w-[112rem] flex-col justify-center px-6 py-24 sm:px-10"
      >
        <p className="mb-6 text-rule uppercase text-brass-bright">Something went wrong</p>

        <h1 className="max-w-[16ch] font-display text-chapter font-light text-paper">
          This page didn&rsquo;t load
        </h1>

        <p className="mt-6 max-w-[46ch] text-lede text-paper-muted">
          The rest of the shop is working normally — it&rsquo;s just this page. Your bag
          and your account are untouched.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button
            type="button"
            onClick={this.retry}
            className="inline-flex items-center bg-paper px-8 py-4 text-caption uppercase text-ink transition-colors duration-500 hover:bg-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            Try again
          </button>
          <Link
            href={fallbackHref}
            className="text-caption uppercase text-paper-faint transition-colors duration-500 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            {fallbackLabel}
          </Link>
        </div>
      </section>
    );
  }
}
