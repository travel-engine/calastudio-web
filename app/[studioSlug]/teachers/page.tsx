import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import styles from '../photofirst.module.css'
import { initials } from '@/lib/names'
import { studioOpenGraph, studioOrigin } from '@/lib/seo'
import { JsonLd, breadcrumbLd, personLd } from '@/lib/jsonLd'
import StudioFooter from '../StudioFooter'
import { studioThemeForRequest } from '@/lib/resolveStudioTheme'
import { getStudioContent } from '../studioContent'

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
    <>
      {t.photo_url ? (
        <Image src={t.photo_url} alt={t.display_name} width={64} height={64} className={styles.dirAvatar} />
      ) : (
        <div className={styles.dirAvatar} style={{ background: 'var(--surface-drawer)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--text-meta)' }}>
          {initials(t.display_name)}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div className={styles.dirName}>
          {t.display_name}
          {t.is_primary && <span className={`${styles.tag} ${styles.tagSolid}`}>Lead teacher</span>}
        </div>
        {t.tagline && <div className={styles.rowMeta} style={{ marginTop: '2px' }}>{t.tagline}</div>}
        {t.specialties && t.specialties.length > 0 && (
          <div className={styles.tagRow} style={{ marginTop: '10px', marginBottom: 0 }}>
            {t.specialties.slice(0, 4).map(s => <span key={s} className={styles.tag}>{s}</span>)}
          </div>
        )}
        {t.bio && (
          <p className={styles.bioPara} style={{ marginTop: '10px', marginBottom: 0, maxWidth: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {t.bio}
          </p>
        )}
        {t.is_page_published && (
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', marginTop: '10px' }}>View profile →</div>
        )}
      </div>
    </>
  )

  return (
    <article>
      {t.is_page_published
        ? <Link href={`/${studioSlug}/teachers/${t.slug}`} className={styles.dirCard}>{inner}</Link>
        : <div className={styles.dirCard}>{inner}</div>}
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

  const org: { name: string; contactEmail?: string | null; theme?: string | null } = await orgRes.json()
  const themed = (await studioThemeForRequest(org.theme)).layout === 'themed'
  const teachers: TeacherCard[] = await teachersRes.json()
  const content = getStudioContent(studioSlug, org)

  const origin = studioOrigin(studioSlug)
  const published = teachers.filter(t => t.is_page_published)

  return (
    <div className={styles.root}>
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

      <main className={styles.container}>
        <header className={styles.pageHeader}>
          <h1 className={styles.h1}>Teachers</h1>
          <p className={styles.lead}>Meet the team at {org.name}.</p>
        </header>

        {teachers.length === 0 ? (
          <div className={styles.emptyState}>This studio hasn&apos;t added any teacher bios yet.</div>
        ) : (
          <div className={styles.dirGrid}>
            {teachers.map(t => <Card key={t.slug} t={t} studioSlug={studioSlug} />)}
          </div>
        )}
        <div style={{ height: 32 }} />
      </main>

      <StudioFooter name={org.name} email={content.contactEmail} poweredBy={themed} />
    </div>
  )
}
