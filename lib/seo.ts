import type { Metadata } from 'next'

// Public studio sites are served per subdomain: {slug}.{STUDIO_DOMAIN}. Canonical URLs and
// OG/metadata all key off that, independent of how the app is reached in dev/preview.
export const STUDIO_DOMAIN = process.env.NEXT_PUBLIC_STUDIO_DOMAIN ?? 'calastudio.app'

// The marketing / app apex, for canonical + OG on non-studio pages.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://calastudio.app').replace(/\/$/, '')

/** Canonical origin for a studio's public site. */
export function studioOrigin(slug: string): string {
  // http for a local subdomain test (a domain with a port, e.g. lvh.me:3000), https everywhere real.
  const scheme = STUDIO_DOMAIN.includes(':') ? 'http' : 'https'
  return `${scheme}://${slug}.${STUDIO_DOMAIN}`
}

// Whether studio sites are actually being served per subdomain (proxy.ts rewrites
// {slug}.{STUDIO_DOMAIN}/x → /{slug}/x). Build-time, so ISR pages can render links without
// looking at the request host. Off in local dev / LAN phone testing / Vercel previews, where the
// site is reached path-based at /{slug}/x on whatever host.
export const STUDIO_SUBDOMAINS = process.env.NEXT_PUBLIC_STUDIO_SUBDOMAINS === 'true'

/** Link from one page of a studio's public site to another (`path` starts with `/`). */
export function studioPath(slug: string, path = '/'): string {
  if (STUDIO_SUBDOMAINS) return path
  return path === '/' ? `/${slug}` : `/${slug}${path}`
}

/** Link to a studio's public site from outside it (dashboard, apex auth pages). */
export function studioUrl(slug: string, path = '/'): string {
  return STUDIO_SUBDOMAINS ? `${studioOrigin(slug)}${path}` : studioPath(slug, path)
}

/** The studio slug when the browser is on a studio subdomain, else null. Client-only. */
export function studioSlugFromHost(host: string): string | null {
  const suffix = `.${STUDIO_DOMAIN.toLowerCase()}`
  const h = host.toLowerCase()
  if (!STUDIO_SUBDOMAINS || !h.endsWith(suffix)) return null
  const sub = h.slice(0, -suffix.length)
  return sub && !sub.includes('.') && sub !== 'www' ? sub : null
}

/** Clean free text down to a meta-description-sized string. */
export function metaDescription(text: string | null | undefined, fallback: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return fallback
  return t.length > 160 ? `${t.slice(0, 157).trimEnd()}…` : t
}

// A child route that sets `openGraph` replaces the layout's whole openGraph object (Next merges
// only top-level metadata keys), so each page builds the full thing through this.
export function studioOpenGraph(opts: {
  siteName: string
  title: string
  description: string
  path: string
  image?: string | null
  type?: 'website' | 'profile'
}): NonNullable<Metadata['openGraph']> {
  return {
    type: opts.type ?? 'website',
    siteName: opts.siteName,
    title: opts.title,
    description: opts.description,
    url: opts.path,
    images: opts.image ? [{ url: opts.image }] : undefined,
  }
}
