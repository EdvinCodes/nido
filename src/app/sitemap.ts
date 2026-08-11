import type { MetadataRoute } from 'next';
import { listDocs } from '@/lib/marketing/docs';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['', '/privacy', '/changelog', '/brand', '/docs', '/sign-in', '/sign-up'];
  const docRoutes = listDocs().map((doc) => `/docs/${doc.slug}`);

  return [...staticRoutes, ...docRoutes].map((path) => ({
    url: `${appUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
