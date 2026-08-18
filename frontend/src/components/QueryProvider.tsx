'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query';

/**
 * Holds the QueryClient for the browser session.
 *
 * Created inside useState rather than at module scope on purpose: a
 * module-level client is shared across every request the Node server handles,
 * which on an SSR'd page means one customer's cached orders can be served to
 * the next. useState gives each client session its own cache.
 *
 * The cache deliberately outlives route changes — that is the point. It is
 * what stops a navigation refetching a product list the customer saw seconds
 * ago, which matters much more here than on an ordinary site because a stall
 * is far more visible while a 3D scene is animating through it.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
