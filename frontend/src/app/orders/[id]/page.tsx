'use client';

import { Suspense, use } from 'react';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';
import OrderDetail from './OrderDetail';

/**
 * /orders/[id]
 *
 * Suspense wraps the detail because it reads `?new=1` via useSearchParams —
 * without a boundary that opts the whole route out of static rendering.
 */
export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RouteErrorBoundary routeName="this order" fallbackHref="/orders" fallbackLabel="All your orders">
      <Suspense fallback={null}>
        <OrderDetail id={Number(id)} />
      </Suspense>
    </RouteErrorBoundary>
  );
}
