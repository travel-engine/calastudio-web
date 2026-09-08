import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import styles from '../booking.module.css'
import { initials } from '@/lib/names'
import { studioOpenGraph, studioOrigin } from '@/lib/seo'
import { JsonLd, breadcrumbLd, personLd } from '@/lib/jsonLd'

export const revalidate = 60

interface Props {
  params: Promise<{ studioSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studioSlug } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  const org = res.ok ? await res.json() : null
  const name: string = org?.name ?? 'the studio'
  const description = `Meet the teachers at ${name}.`
  return {
    title: 'Teachers',
    description,
    alternates: { canonical: '/teachers' },
    openGraph: studioOpenGraph({
      siteName: name, title: `Teachers · ${name}`, description, path: '/teachers',
      image: org?.banner_url || org?.logo_url,
    }),
  }
}

interface TeacherCard {
  slug: string
  display_name: string
  tagline: string | null
  bio: string | null
  photo_url: string | null
  specialties: string[] | null
  is_page_published: boolean
  is_primary: boolean
}

function Card({ t, studioSlug }: { t: TeacherCard; studioSlug: string }) {
  const inner = (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', minWidth: 0 }}>
      {t.photo_url ? (
        <Image src={t.photo_url} alt={t.display_name} width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 64, height: 64, borderRadius: '50%', backgroundColor: '#085041', color: 'white', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700,
        }}>
          {initials(t.display_name)}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {t.display_name}
          {t.is_primary && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#085041', backgroundColor: '#e8f5ee', borderRadius: '999px', padding: '2px 8px' }}>
              Lead teacher
            </span>
          )}
        </div>
        {t.tagline && <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{t.tagline}</div>}
        {t.specialties && t.specialties.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {t.specialties.slice(0, 4).map(s => (
              <span key={s} style={{ fontSize: '11px', fontWeight: 500, color: '#444', backgroundColor: '#f0f0f0', borderRadius: '999px', padding: '2px 8px' }}>{s}</span>
            ))}
          </div>
        )}
        {t.bio && (
          <p style={{
            fontSize: '13px', color: '#666', marginTop: '10px', marginBottom: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {t.bio}
          </p>
        )}
        {t.is_page_published && (
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#085041', marginTop: '10px' }}>View profile →</div>
        )}
      </div>
    </div>
  )

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    textDecoration: 'none', color: 'inherit', display: 'block',
  }

  return (
    <article>
      {t.is_page_published
        ? <Link href={`/${studioSlug}/teachers/${t.slug}`} style={cardStyle}>{inner}</Link>
        : <div style={cardStyle}>{inner}</div>}
    </article>
  )
}

export default async function TeachersDirectoryPage({ params }: Props) {
  const { studioSlug } = await params
  const base = process.env.NEXT_PUBLIC_API_URL

  const [orgRes, teachersRes] = await Promise.all([
    fetch(`${base}/api/public/${studioSlug}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/public/${studioSlug}/teachers`, { next: { revalidate: 60 } }),
  ])
  if (orgRes.status === 404) notFound()
  if (!orgRes.ok || !teachersRes.ok) throw new Error('Failed to load teachers')

  const org: { name: string } = await orgRes.json()
  const teachers: TeacherCard[] = await teachersRes.json()

  const origin = studioOrigin(studioSlug)
  const published = teachers.filter(t => t.is_page_published)

  return (
    <div className={styles.page}>
      <JsonLd data={breadcrumbLd([
        { name: org.name, url: `${origin}/` },
        { name: 'Teachers', url: `${origin}/teachers` },
      ])} />
      {published.length > 0 && (
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: published.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: personLd(
              { ...t, instagram_url: null, website_url: null },
              { studioName: org.name, studioUrl: `${origin}/`, pageUrl: `${origin}/teachers/${t.slug}` },
            ),
          })),
        }} />
      )}

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Teachers</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>Meet the team at {org.name}.</p>
        </div>
      </header>

      <main className={styles.content}>
        {teachers.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            This studio hasn&apos;t added any teacher bios yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {teachers.map(t => <Card key={t.slug} t={t} studioSlug={studioSlug} />)}
          </div>
        )}
      </main>
    </div>
  )
}
