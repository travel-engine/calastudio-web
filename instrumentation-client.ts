import * as Sentry from '@sentry/nextjs'

// Error monitoring in the browser (Sentry). Off until NEXT_PUBLIC_SENTRY_DSN is set in Vercel.
// No performance tracing or session replay, and no personal data (IP, cookies, request bodies):
// we only want to hear that something broke, where, and on which browser.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  // Collect nothing personal: no user info, cookies, headers, request bodies or query strings
  // (sign-in links carry tokens in the URL). Just the error, where it happened, and the browser.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0,
  // Noise from browser extensions and flaky mobile networks, not our code.
  ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', /^Load failed$/, /^Failed to fetch$/, /^NetworkError/],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
