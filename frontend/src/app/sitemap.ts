import type { MetadataRoute } from 'next';
import { getApiBase } from '@/lib/api';

/**
 * Every page Google should know about — now including every product.
 *
 * Until October 2026 this listed seven fixed pages and no products at all, so
 * the one place a search engine is told what the shop sells never mentioned a
 * single thing it sells. Products were found only by crawling the catalogue,
 * which is client-rendered, so most were never found.
 *
 * Rebuilt at most hourly. If the API cannot answer, the fixed pages are still
 * returned: a sitemap that fails is worse than one that is briefly incomplete.
 */
export const revalidate = 3600;

type Listed = { id: number; created_at?: string | null };

async function products(): Promise<Listed[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/products/?limit=500`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as Listed[]).filter((p) => Number.isInteger(p?.id)) : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://vijeytextile.com';
  const now  = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: base,                    lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/products`,      lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/support`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/shipping`,      lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/authentic`,     lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/auth/login`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${base}/auth/register`, lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ];

  const items: MetadataRoute.Sitemap = (await products()).map((p) => {
    const added = p.created_at ? new Date(p.created_at) : null;
    return {
      url: `${base}/products/${p.id}`,
      lastModified: added && !Number.isNaN(added.getTime()) ? added : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    };
  });

  return [...pages, ...items];
}
