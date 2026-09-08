import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import StudioNav from './StudioNav'
import { studioOrigin, metaDescription } from '@/lib/seo'

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

  return (
    <>
      <StudioNav
        studioSlug={studioSlug}
        name={org.name}
        logoUrl={org.logo_url}
        brandColor={org.brand_color || '#085041'}
      />
      {children}
    </>
  )
}
