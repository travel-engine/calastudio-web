import { ImageResponse } from 'next/og'

// Home-screen / install icon for a studio: its logo centred on a white tile, or its initial on its
// brand colour when there's no logo (or it's in a format the renderer can't draw, e.g. WebP/SVG).
// ?maskable=1 shrinks the artwork into Android's safe zone so a round or squircle mask won't clip it.
// Sizes: 180 (Apple touch icon), 192, 512.
//
// Links carry ?v= (lib/appIcon.ts), which changes whenever the logo, brand colour or name does — so
// a versioned icon is cached for a year and a new logo gets a new URL. The studio is read fresh on
// each cache miss, never from a stale data cache.
export const dynamic = 'force-dynamic'

const SIZES = new Set([180, 192, 512])

export async function GET(req: Request, { params }: { params: Promise<{ studioSlug: string; size: string }> }) {
  const { studioSlug, size: sizeParam } = await params
  const size = Number(sizeParam)
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 })
  const search = new URL(req.url).searchParams
  const maskable = search.get('maskable') === '1'
  const versioned = search.has('v')

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { cache: 'no-store' })
  if (!res.ok) return new Response('Not found', { status: 404 })
  const org: { name: string; logo_url: string | null; brand_color: string | null } = await res.json()

  const logo = org.logo_url ? await drawableImage(org.logo_url) : null
  const brand = org.brand_color && /^#[0-9a-fA-F]{6}$/.test(org.brand_color) ? org.brand_color : '#085041'
  // Maskable icons keep artwork within the central 80%; plain icons can use more of the tile.
  const art = Math.round(size * (maskable ? 0.6 : 0.78))

  return new ImageResponse(
    logo ? (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={art} height={art} style={{ objectFit: 'contain' }} alt="" />
      </div>
    ) : (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: brand, color: '#ffffff', fontSize: Math.round(art * 0.7), fontWeight: 700,
      }}>
        {(org.name.trim()[0] ?? 'C').toUpperCase()}
      </div>
    ),
    {
      width: size, height: size,
      headers: { 'Cache-Control': versioned ? 'public, max-age=31536000, s-maxage=31536000, immutable' : 'public, max-age=300, s-maxage=300' },
    },
  )
}

// The renderer draws PNG and JPEG only; anything else falls back to the initial.
async function drawableImage(url: string): Promise<string | null> {
  try {
    // Logo URLs are unique per upload, so the image itself can be cached.
    const r = await fetch(url, { next: { revalidate: 86400 } })
    if (!r.ok) return null
    const type = (r.headers.get('content-type') ?? '').split(';')[0].trim()
    if (type !== 'image/png' && type !== 'image/jpeg') return null
    const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
    return `data:${type};base64,${b64}`
  } catch {
    return null
  }
}
