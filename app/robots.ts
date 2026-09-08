import type { MetadataRoute } from 'next'

// Served at /robots.txt for every host (apex and each studio subdomain).
export default function robots(): MetadataRoute.Robots {
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
