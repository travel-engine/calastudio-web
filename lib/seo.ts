import type { Metadata } from 'next'

// Public studio sites are served per subdomain: {slug}.{STUDIO_DOMAIN}. Canonical URLs and
// OG/metadata all key off that, independent of how the app is reached in dev/preview.
export const STUDIO_DOMAIN = process.env.NEXT_PUBLIC_STUDIO_DOMAIN ?? 'calastudio.app'

/** Canonical origin for a studio's public site. */
export function studioOrigin(slug: string): string {
  return `https://${slug}.${STUDIO_DOMAIN}`
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
