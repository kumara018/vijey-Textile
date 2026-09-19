import type { Metadata, ResolvingMetadata } from 'next';
import type { ReactNode } from 'react';
import { STORE } from '@/lib/config';
import { getApiBase } from '@/lib/api';
import { mediaUrl } from '@/lib/media';

/**
 * Each product page's own title, description, preview image and product data.
 * Identical in both shops.
 *
 * WHY. Every product page carried the shop's title — "Vijey Textile — Grand
 * treat for girls" on all of them — because the page is a client component and
 * could not say anything about the product until JavaScript ran. So:
 *
 *   - a product link shared on WhatsApp previewed as the shop, with the shop's
 *     picture, never the garment or its price
 *   - Google indexed a set of pages with one identical title, which it treats
 *     as duplicates, so the individual pieces barely ranked
 *
 * A server layout fixes that without touching the product page: it fetches the
 * product and sets the metadata, plus schema.org Product data, so Google can
 * show the price and whether it is in stock — the way an Amazon listing does.
 *
 * It can never break the page. A slow or unreachable API returns the shop's
 * usual metadata after three seconds, and the product page renders as before.
 */

type Params = { params: Promise<{ id: string }> };

type ProductLike = {
  id: number; name: string; category?: string; price: number; description?: string;
  fabric?: string | null; images?: string[]; stock?: number; sku?: string | null;
  rating_avg?: number | null; rating_count?: number | null; is_active?: boolean;
};

/** The product, 'missing' for a real 404, or null when the API could not answer. */
async function fetchProduct(id: string): Promise<ProductLike | 'missing' | null> {
  if (!/^\d{1,9}$/.test(id)) return 'missing';
  try {
    const res = await fetch(`${getApiBase()}/api/products/${id}`, {
      // Fetch results are memoised per request, and cached for five minutes:
      // a price change reaches previews within that, and a burst of shares
      // does not become a burst of API calls.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return 'missing';
    if (!res.ok) return null;
    return (await res.json()) as ProductLike;
  } catch {
    return null;
  }
}

function photo(p: ProductLike): string | null {
  const first = (p.images ?? []).find((i) => i && !i.includes('placeholder'));
  return first ? mediaUrl(first) : null;
}

function rupees(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export async function generateMetadata({ params }: Params, parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProduct(id);

  if (p === 'missing') {
    return {
      title: `This piece is no longer here | ${STORE.name}`,
      robots: { index: false, follow: true },
    };
  }
  if (!p) return {};   // API unreachable: keep the shop's own title

  const title = `${p.name}${p.category ? ` — ${p.category}` : ''} | ${STORE.name}`;
  // Price first: it is what a shared link is usually asked about.
  const firstLine = (p.description ?? '').trim().split(/(?<=[.!?])\s+/)[0]?.slice(0, 150);
  const description = [rupees(p.price), p.fabric, firstLine].filter(Boolean).join(' · ');

  const img = photo(p);
  // With no photograph, keep the shop's own preview image rather than none.
  const inherited = (await parent).openGraph?.images ?? [];
  const images = img ? [{ url: img, alt: p.name }] : inherited;
  const url = `/products/${p.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: STORE.name, type: 'website', images },
    twitter: {
      card: img ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(img ? { images: [img] } : {}),
    },
  };
}

export default async function ProductLayout({ children, params }: { children: ReactNode } & Params) {
  const { id } = await params;
  const p = await fetchProduct(id);   // memoised: the same request as the metadata's

  /*
   * schema.org Product — what lets Google show the price, and In stock / Out of
   * stock, beside the result. `application/ld+json` is data, not script: the
   * browser never executes it, so the Content-Security-Policy is unaffected.
   * `<` is escaped so a product name can never close the tag early.
   */
  const ld = p && p !== 'missing' ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(p.description ? { description: p.description.slice(0, 500) } : {}),
    ...(photo(p) ? { image: [photo(p)] } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.category ? { category: p.category } : {}),
    brand: { '@type': 'Brand', name: STORE.name },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: Number(p.price).toFixed(2),
      availability: (p.stock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: STORE.name },
    },
    ...(p.rating_count && p.rating_count > 0 && p.rating_avg ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(p.rating_avg).toFixed(1),
        reviewCount: p.rating_count,
      },
    } : {}),
  } : null;

  return (
    <>
      {ld && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
        />
      )}
      {children}
    </>
  );
}
