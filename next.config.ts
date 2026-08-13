import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSerwist } from '@serwist/turbopack';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
  analyzerMode: 'static',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Playwright and local tooling hit the dev server via 127.0.0.1; Next.js 16 blocks cross-origin
  // dev asset requests unless the host is explicitly allowed.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // Standalone output keeps the self-hosted Docker image small. See docs/01-ARCHITECTURE.md §10.
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' as const } : {}),

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase Storage serves avatars and receipts through signed URLs.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/**' },
    ],
  },

  typedRoutes: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(withSerwist(withNextIntl(nextConfig)));
