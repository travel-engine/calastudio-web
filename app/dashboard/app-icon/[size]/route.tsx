import { ImageResponse } from 'next/og'
import { color } from '@/lib/ui/tokens'

// Home-screen icon for the installed staff dashboard: a "C" on CalaStudio green. Sizes 180 (Apple
// touch icon), 192 and 512; ?maskable=1 keeps the letter inside Android's safe zone.

const SIZES = new Set([180, 192, 512])

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size)
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 })
  const maskable = new URL(req.url).searchParams.get('maskable') === '1'
  const art = Math.round(size * (maskable ? 0.6 : 0.78))

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color.primary, color: '#ffffff', fontSize: Math.round(art * 0.7), fontWeight: 700,
      }}>
        C
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } },
  )
}
