import * as Sentry from '@sentry/nextjs'

// Error monitoring for code running at the edge (proxy.ts host routing).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.VERCEL_ENV ?? 'development',
  // Collect nothing personal: no user info, cookies, headers, request bodies or query strings
  // (sign-in links carry tokens in the URL). Just the error, where it happened, and the browser.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0,
})
