import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Manrope } from 'next/font/google'
import StudioNav from './StudioNav'
import ThemeSwitcher from './ThemeSwitcher'
import { studioOrigin, metaDescription } from '@/lib/seo'
import { resolveTheme, themeVars } from './theme'

// Photo First uses Manrope (handoff §Global). Self-hosted via next/font; the variable is set on
// the studio-tree wrapper below and consumed through --font-body in theme.ts. Scoped here rather
// than in the root layout so the dashboard keeps its system font.
const manrope = Manrope({ subsets: ['latin'], weight: ['300', '400', '500', '700'], variable: '--font-manrope' })

interface Props {
  children: React.ReactNode
  params: Promise<{ studioSlug: string }>
}

interface PublicOrgInfo {
  name: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  brand_color: string | null
  theme?: string | null
}

async function getOrg(studioSlug: string): Promise<PublicOrgInfo | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

// Studio-level metadata defaults. Child pages set their own `title` (slotted into the template) and
// can override description / canonical / openGraph.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studioSlug } = await params
  const org = await getOrg(studioSlug)
  if (!org) return {}

  const origin = studioOrigin(studioSlug)
  const description = metaDescription(org.description, `Browse the class schedule at ${org.name} and book online.`)
  const ogImage = org.banner_url || org.logo_url || undefined

  return {
    metadataBase: new URL(origin),
    title: { default: org.name, template: `%s · ${org.name}` },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: org.name,
      title: org.name,
      description,
      url: '/',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: org.banner_url ? 'summary_large_image' : 'summary',
      title: org.name,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    icons: org.logo_url ? { icon: org.logo_url } : undefined,
  }
}

export default async function StudioLayout({ children, params }: Props) {
  const { studioSlug } = await params

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, {
    next: { revalidate: 60 },
  })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load studio')
  const org: PublicOrgInfo = await res.json()

  // In development only, a `cs-theme` cookie (set by <ThemeSwitcher>) overrides the studio's theme
  // so alternates can be previewed. Reading cookies makes a route dynamic, so this is gated to dev
  // to keep the public pages on ISR in production.
  let themeKey: string | null | undefined = org.theme
  if (process.env.NODE_ENV === 'development') {
    const { cookies } = await import('next/headers')
    themeKey = (await cookies()).get('cs-theme')?.value ?? org.theme
  }
  const theme = resolveTheme(themeKey)

  // The wrapper only carries the theme tokens + font variable — it deliberately doesn't paint a
  // background or set text colour, so pages not yet converted to Photo First render unchanged.
  // Converted pages apply the `.root` class (see photofirst.module.css) to opt into the look.
  return (
    <div className={manrope.variable} style={{ ...themeVars(theme), position: 'relative' }} data-studio-theme={theme.key}>
      {process.env.NODE_ENV === 'development' && <ThemeSwitcher current={theme.key} />}
      <StudioNav
        studioSlug={studioSlug}
        name={org.name}
        logoUrl={org.logo_url}
        brandColor={org.brand_color || '#085041'}
      />
      {children}
    </div>
  )
}
