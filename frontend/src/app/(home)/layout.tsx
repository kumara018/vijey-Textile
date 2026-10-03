import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * The homepage's own canonical (SEO-10, October 2026 test pass).
 *
 * It used to be set in the ROOT layout, which every page inherits, so
 * /products, /support, /shipping and the rest all told search engines "I am a
 * copy of the homepage" — an invitation to drop them from the index. A route
 * group gives the homepage a layout of its own without changing its URL; every
 * other page now declares its own canonical (product pages) or none.
 */
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function HomeLayout({ children }: { children: ReactNode }) {
  return children;
}
