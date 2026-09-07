import { notFound } from 'next/navigation'
import StudioNav from './StudioNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ studioSlug: string }>
}

// Shared shell for every public studio page. Fetches the same public org endpoint the pages use
// (deduped by Next within a request) purely for nav identity — name, logo, brand colour.
interface NavOrgInfo {
  name: string
  logo_url: string | null
  brand_color: string | null
}

export default async function StudioLayout({ children, params }: Props) {
  const { studioSlug } = await params

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, {
    next: { revalidate: 60 },
  })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load studio')
  const org: NavOrgInfo = await res.json()

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
