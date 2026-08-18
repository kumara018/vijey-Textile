'use client';

import { useEffect } from 'react';
import { installGlobalErrorReporting } from '@/lib/errorReporter';

/**
 * Installs the window-level error listeners for the life of the tab.
 *
 * Mounted once in the root layout. Renders nothing and never suspends, so it
 * cannot itself affect what the customer sees — which matters, because the one
 * component that must not break the page is the one whose job is to notice
 * things breaking.
 */
export default function ErrorReporting() {
  useEffect(() => installGlobalErrorReporting(), []);
  return null;
}
