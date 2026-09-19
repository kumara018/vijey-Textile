'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { rememberReturnPath } from '@/lib/returnPath';

/**
 * Notes every shop page the customer visits, so the sign-in page's Back — and
 * a finished sign-in — can return them to it. See lib/returnPath.
 *
 * Reads the query string too: coming back to "Lehenga, sorted by price" is the
 * point, not coming back to the unfiltered shelf. useSearchParams needs a
 * Suspense boundary above it, so this component brings its own.
 */
function Recorder() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const q = params.toString();
    rememberReturnPath(pathname + (q ? `?${q}` : ''));
  }, [pathname, params]);
  return null;
}

export default function ReturnPathRecorder() {
  return (
    <Suspense fallback={null}>
      <Recorder />
    </Suspense>
  );
}
