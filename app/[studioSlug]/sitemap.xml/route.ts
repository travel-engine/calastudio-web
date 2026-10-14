import { NextResponse } from 'next/server'
import { studioOrigin } from '@/lib/seo'

export const revalidate = 3600

interface DirTeacher {
  slug: string
  is_page_published: boolean
}

// Per-studio sitemap: {slug}.calastudio.app/sitemap.xml (proxy.ts rewrites it here), or
// /{studioSlug}/sitemap.xml when path-based.
export async function GET(_req: Request, { params }: { params: Promise<{ studioSlug: string }> }) {
  const { studioSlug } = await params
  const base = process.env.NEXT_PUBLIC_API_URL
  const origin = studioOrigin(studioSlug)

  const orgRes = await fetch(`${base}/api/public/${studioSlug}`, { next: { revalidate: 3600 } })
  if (!orgRes.ok) return new NextResponse('Not found', { status: 404 })

  const teachersRes = await fetch(`${base}/api/public/${studioSlug}/teachers`, { next: { revalidate: 3600 } })
  const teachers: DirTeacher[] = teachersRes.ok ? await teachersRes.json() : []

  const now = new Date().toISOString()
  const entries: { loc: string; changefreq: string; priority: string }[] = [
    { loc: `${origin}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/schedule`, changefreq: 'daily', priority: '0.9' },
    { loc: `${origin}/teachers`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${origin}/pricing`, changefreq: 'weekly', priority: '0.6' },
    ...teachers
      .filter(t => t.is_page_published)
      .map(t => ({ loc: `${origin}/teachers/${t.slug}`, changefreq: 'weekly', priority: '0.6' })),
  ]

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        e =>
          `  <url><loc>${e.loc}</loc><lastmod>${now}</lastmod>` +
          `<changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
      )
      .join('\n') +
    `\n</urlset>\n`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 's-maxage=3600, stale-while-revalidate' },
  })
}
