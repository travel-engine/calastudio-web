import { studioPath } from './seo'

// Studio app-icon URLs carry a version made from everything the icon is drawn from (logo, brand
// colour, name → initial). A new logo means a new URL, so browsers, phones and Vercel's CDN fetch
// the new icon straight away — and an unchanged icon can be cached for a year.
type IconSource = { name: string; logo_url: string | null; brand_color: string | null }

export function iconVersion(org: IconSource): string {
  const s = `${org.logo_url ?? ''}|${org.brand_color ?? ''}|${org.name}`
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function appIconPath(slug: string, size: 180 | 192 | 512, org: IconSource, maskable = false): string {
  const q = new URLSearchParams({ v: iconVersion(org) })
  if (maskable) q.set('maskable', '1')
  return `${studioPath(slug, `/app-icon/${size}`)}?${q}`
}

export function appManifestPath(slug: string, org: IconSource): string {
  return `${studioPath(slug, '/app-manifest')}?v=${iconVersion(org)}`
}
