import type { MetadataRoute } from 'next'

// Served at /robots.txt for every host (apex and each studio subdomain). Vercel Preview builds
// (dev.calastudio.app and branch previews) block all crawling so test data never gets indexed.
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === 'preview') return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/onboarding',
        '/auth/',
        '/login',
        '/register',
        '/set-password',
        '/forgot-password',
        '/account',      // {slug}.calastudio.app/account
        '/*/account',    // path-based /{slug}/account
        '/api/',
      ],
    },
    // app/sitemap.ts (per-studio) lands in Tier 2.
  }
}
