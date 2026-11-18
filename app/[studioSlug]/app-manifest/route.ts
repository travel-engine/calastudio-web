import { resolveTheme } from '@/lib/studioTheme'
import { studioPath } from '@/lib/seo'
import { appIconPath } from '@/lib/appIcon'

// Web app manifest for a studio's site, so "Install app" / "Add to Home Screen" gives the studio's
// own name, icon and colours and opens at its schedule. Served at {slug}.calastudio.app/app-manifest
// (no file extension: proxy.ts passes dotted paths through unrewritten, so it couldn't reach this
// route on a studio subdomain) and linked from app/[studioSlug]/layout.tsx.
// Same freshness as the studio pages, so a new logo reaches the manifest within a minute.
export const revalidate = 60

export async function GET(_req: Request, { params }: { params: Promise<{ studioSlug: string }> }) {
  const { studioSlug } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  if (!res.ok) return new Response('Not found', { status: 404 })
  const org: { name: string; description: string | null; theme?: string | null; logo_url: string | null; brand_color: string | null } = await res.json()

  const bg = resolveTheme(org.theme).tokens['--bg'] ?? '#ffffff'
  const icon = (size: 192 | 512, purpose: 'any' | 'maskable') => ({
    src: appIconPath(studioSlug, size, org, purpose === 'maskable'),
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose,
  })

  const manifest = {
    id: studioPath(studioSlug, '/'),
    name: org.name,
    short_name: org.name.length <= 15 ? org.name : org.name.split(/\s+/).slice(0, 2).join(' '),
    description: org.description ?? `Book classes at ${org.name}`,
    start_url: studioPath(studioSlug, '/schedule'),
    scope: studioPath(studioSlug, '/'),
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [icon(192, 'any'), icon(512, 'any'), icon(512, 'maskable')],
  }

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  })
}
