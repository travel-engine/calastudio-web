import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import styles from '../booking.module.css'
import PricingList, { type PassTemplate } from '../PricingList'
import { studioOpenGraph, studioOrigin } from '@/lib/seo'
import { JsonLd, breadcrumbLd, passProductLd } from '@/lib/jsonLd'

export const revalidate = 60

interface Props {
  params: Promise<{ studioSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studioSlug } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  const org = res.ok ? await res.json() : null
  const name: string = org?.name ?? 'the studio'
  const description = `Class passes and pricing for ${name}.`
  return {
    title: 'Pricing',
    description,
    alternates: { canonical: '/pricing' },
    openGraph: studioOpenGraph({
      siteName: name, title: `Pricing · ${name}`, description, path: '/pricing',
      image: org?.banner_url || org?.logo_url,
    }),
  }
}

interface PublicOrgInfo {
  id: string
  name: string
  brand_color: string | null
  currency: string
  stripe_account_id: string | null
  payments_enabled: boolean
}

export default async function PricingPage({ params }: Props) {
  const { studioSlug } = await params
  const base = process.env.NEXT_PUBLIC_API_URL

  const [orgRes, tplRes] = await Promise.all([
    fetch(`${base}/api/public/${studioSlug}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/public/${studioSlug}/pass-templates`, { next: { revalidate: 60 } }),
  ])
  if (orgRes.status === 404) notFound()
  if (!orgRes.ok || !tplRes.ok) throw new Error('Failed to load pricing')

  const org: PublicOrgInfo = await orgRes.json()
  const templates: PassTemplate[] = await tplRes.json()

  const origin = studioOrigin(studioSlug)
  const pageUrl = `${origin}/pricing`

  return (
    <div className={styles.page}>
      <JsonLd data={breadcrumbLd([
        { name: org.name, url: `${origin}/` },
        { name: 'Pricing', url: pageUrl },
      ])} />
      {templates.length > 0 && (
        <JsonLd data={templates.map(t => passProductLd(t, { studioName: org.name, pageUrl }))} />
      )}

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Pricing</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
            Class passes at {org.name}. Buy one now, or use it next time you book.
          </p>
        </div>
      </header>

      <main className={styles.content}>
        <PricingList
          studioSlug={studioSlug}
          templates={templates}
          orgId={org.id}
          currency={org.currency}
          brandColor={org.brand_color || '#085041'}
          stripeAccountId={org.stripe_account_id}
          paymentsEnabled={org.payments_enabled}
        />
      </main>
    </div>
  )
}
