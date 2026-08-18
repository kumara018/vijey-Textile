import { notFound } from 'next/navigation';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';
import ProductDetail from './ProductDetail';

/**
 * /products/[id]
 *
 * The route is a thin server shell; everything interactive lives in
 * ProductDetail. A non-numeric id 404s here rather than reaching the client
 * and failing as a bad request — `/products/undefined` is a real link bug that
 * should look like a missing page, not a broken one.
 */
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) notFound();

  return (
    <RouteErrorBoundary routeName="this piece" fallbackHref="/products" fallbackLabel="See every piece">
      <ProductDetail id={numeric} />
    </RouteErrorBoundary>
  );
}
