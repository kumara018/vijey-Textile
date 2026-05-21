import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/account', '/orders', '/cart', '/checkout'],
    },
    sitemap: ['https://vijeytextile.com/sitemap.xml', 'https://www.vijeytextile.com/sitemap.xml'],
  };
}
