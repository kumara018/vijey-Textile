import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://vijeytextile.com';
  const now  = new Date();

  return [
    { url: base,                    lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/products`,      lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/support`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/shipping`,      lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/authentic`,     lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/auth/login`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${base}/auth/register`, lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ];
}
