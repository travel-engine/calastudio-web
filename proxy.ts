import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { STUDIO_DOMAIN, STUDIO_SUBDOMAINS, studioOrigin, studioSlugFromHost } from '@/lib/seo'
import { DEMO_HOST } from '@/lib/demoUrl'

// Studio public sites live at {slug}.{STUDIO_DOMAIN}; the app serves them from app/[studioSlug].
// This maps the one onto the other. Host routing only — no auth here (auth is client-side).
//
//   {slug}.calastudio.app/schedule      → rewrite  /{slug}/schedule
//   {slug}.calastudio.app/{slug}/x      → redirect /x            (stale path-based links)
//   {slug}.calastudio.app/dashboard     → redirect calastudio.app/dashboard
//   calastudio.app/{slug}/x             → redirect {slug}.calastudio.app/x
//
// Everything is a no-op unless NEXT_PUBLIC_STUDIO_SUBDOMAINS=true (see lib/seo.ts).

// Top-level app routes (app/*, public/*). On the apex these are never a studio slug. Keep in sync
// when adding a top-level route, or the apex will redirect it to a studio subdomain.
const APEX_ROUTES = new Set([
  'dashboard', 'onboarding', 'login', 'register', 'set-password', 'forgot-password',
  'auth', 'help', 'api', 'admin', 'terms', 'privacy', 'embed', 'demo',
])

// Apex-only pages: on a studio subdomain, send them to the apex.
const APEX_ONLY = new Set(['dashboard', 'onboarding', 'login', 'register', 'forgot-password', 'help', 'admin', 'terms', 'privacy', 'demo'])

// Served as-is on a studio subdomain: the email-link callback and the password page members land
// on from it must run on the studio host so the session cookie is set there. `embed` is the website
// widget's iframe page — host-independent, so a widget.js loaded from any CalaStudio host works.
const SHARED = new Set(['auth', 'set-password', 'api', 'embed'])

export function proxy(request: NextRequest) {
  if (!STUDIO_SUBDOMAINS) return NextResponse.next()

  const { pathname, search } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  // The demo's own address opens straight on its sign-up / persona picker.
  if (DEMO_HOST && host.toLowerCase() === DEMO_HOST && pathname === '/') {
    return NextResponse.redirect(new URL(`/demo${search}`, request.url), 307)
  }
  const first = pathname.split('/')[1] ?? ''
  const slug = studioSlugFromHost(host)

  if (slug) {
    // Static files, plus robots.txt (shared); the studio's own sitemap is a route under [studioSlug].
    if (pathname !== '/sitemap.xml' && first.includes('.')) return NextResponse.next()
    if (SHARED.has(first)) return NextResponse.next()
    if (APEX_ONLY.has(first)) return NextResponse.redirect(`${apexOrigin(request)}${pathname}${search}`, 308)
    if (first === slug) {
      const rest = pathname.slice(slug.length + 1) || '/'
      return NextResponse.redirect(new URL(`${rest}${search}`, request.url), 308)
    }
    const url = request.nextUrl.clone()
    url.pathname = pathname === '/' ? `/${slug}` : `/${slug}${pathname}`
    return NextResponse.rewrite(url)
  }

  if (isApex(host) && first && !first.includes('.') && !APEX_ROUTES.has(first)) {
    const rest = pathname.slice(first.length + 1) || '/'
    return NextResponse.redirect(`${studioOrigin(first)}${rest}${search}`, 308)
  }

  return NextResponse.next()
}

function isApex(host: string): boolean {
  const h = host.toLowerCase()
  const root = STUDIO_DOMAIN.toLowerCase()
  return h === root || h === `www.${root}`
}

function apexOrigin(request: NextRequest): string {
  return `${request.nextUrl.protocol}//${STUDIO_DOMAIN}`
}

export const config = {
  // _vercel: Web Analytics / Speed Insights endpoints (/_vercel/insights, /_vercel/speed-insights),
  // which must never be rewritten to a studio page or redirected to a "_vercel" subdomain.
  matcher: ['/((?!_next/static|_next/image|_vercel|favicon.ico).*)'],
}
