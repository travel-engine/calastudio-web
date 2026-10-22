import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import styles from '../../photofirst.module.css'
import { formatDateTimeWithWeekday, formatTimeRange } from '@/lib/dates'
import { metaDescription, studioOpenGraph, studioOrigin, studioPath } from '@/lib/seo'
import { JsonLd, personLd, breadcrumbLd, eventLd } from '@/lib/jsonLd'
import Gallery from '../../Gallery'
import StudioFooter from '../../StudioFooter'
import { studioThemeForRequest } from '@/lib/resolveStudioTheme'
import { getStudioContent, type PageContentDto } from '../../studioContent'

export const revalidate = 60

interface Props {
  params: Promise<{ studioSlug: string; teacherSlug: string }>
}

interface UpcomingClass {
  occurrence_id: string
  session_name: string
  session_type: string
  delivery_mode: string
  starts_at: string
  ends_at: string
  location_name: string | null
  location_address: string | null
  instructor_name: string | null
  price: number | null
  currency: string
  spots_remaining: number | null
  photo_url: string | null
  is_cancelled: boolean
}

interface TeacherProfile {
  slug: string
  display_name: string
  tagline: string | null
  bio: string | null
  photo_url: string | null
  photos: string[] | null
  specialties: string[] | null
  certifications: string[] | null
  years_experience: number | null
  instagram_url: string | null
  website_url: string | null
  is_primary?: boolean
}

interface TeacherPageData {
  profile: TeacherProfile | null
  upcoming_classes: UpcomingClass[]
}

interface PublicOrgInfo {
  name: string
  timezone?: string | null
  theme?: string | null
  page_content?: PageContentDto | null
  contactEmail?: string | null
}

function timeRange(startIso: string, endIso: string, timeZone?: string | null) {
  return formatTimeRange(startIso, endIso, timeZone)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studioSlug, teacherSlug } = await params
  const base = process.env.NEXT_PUBLIC_API_URL
  const [tRes, orgRes] = await Promise.all([
    fetch(`${base}/api/public/${studioSlug}/teachers/${teacherSlug}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/public/${studioSlug}`, { next: { revalidate: 60 } }),
  ])
  if (!tRes.ok) return {}
  const data: TeacherPageData = await tRes.json()
  const p = data.profile
  if (!p) return {}
  const studioName: string = orgRes.ok ? (await orgRes.json()).name : 'the studio'

  const description = metaDescription(p.bio ?? p.tagline, `${p.display_name} teaches at ${studioName}.`)
  return {
    title: p.display_name,
    description,
    alternates: { canonical: `/teachers/${teacherSlug}` },
    openGraph: studioOpenGraph({
      siteName: studioName, title: p.display_name, description,
      path: `/teachers/${teacherSlug}`, image: p.photo_url, type: 'profile',
    }),
  }
}

export default async function TeacherLandingPage({ params }: Props) {
  const { studioSlug, teacherSlug } = await params
  const base = process.env.NEXT_PUBLIC_API_URL

  const [res, orgRes] = await Promise.all([
    fetch(`${base}/api/public/${studioSlug}/teachers/${teacherSlug}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/public/${studioSlug}`, { next: { revalidate: 60 } }),
  ])
  // 404 covers both "no such studio/teacher" and an unpublished page — the endpoint filters on
  // is_page_published, so an unpublished teacher simply isn't found here.
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load teacher')

  const data: TeacherPageData = await res.json()
  const p = data.profile
  if (!p) notFound()
  const org: PublicOrgInfo & { theme?: string | null } = orgRes.ok ? await orgRes.json() : { name: studioSlug }
  const themed = (await studioThemeForRequest(org.theme)).layout === 'themed'
  const studioName = org.name
  const content = getStudioContent(studioSlug, org.page_content)

  const tags = p.specialties ?? []
  const upcoming = (data.upcoming_classes ?? []).filter(c => !c.is_cancelled)
  const galleryPhotos = (p.photos ?? []).filter(u => u && u !== p.photo_url)
  const bioParas = (p.bio ?? '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
  const firstName = p.display_name.split(' ')[0]

  const origin = studioOrigin(studioSlug)
  const pageUrl = `${origin}/teachers/${teacherSlug}`
  const ldCtx = { studioName, studioUrl: `${origin}/`, pageUrl }

  return (
    <div className={styles.root}>
      <JsonLd data={personLd(p, ldCtx)} />
      <JsonLd data={breadcrumbLd([
        { name: studioName, url: `${origin}/` },
        { name: 'Teachers', url: `${origin}/teachers` },
        { name: p.display_name, url: pageUrl },
      ])} />
      {upcoming.length > 0 && <JsonLd data={upcoming.map(c => eventLd(c, ldCtx))} />}

      <main className={styles.container}>
        <section className={styles.teacherGrid}>
          <div>
            <div style={{ marginBottom: '18px' }}>
              <Link href={studioPath(studioSlug, '/teachers')} className={styles.navLink}>← All teachers</Link>
            </div>
            {(tags.length > 0 || p.is_primary) && (
              <div className={styles.tagRow}>
                {p.is_primary && <span className={`${styles.tag} ${styles.tagSolid}`}>Lead teacher</span>}
                {tags.map((s, i) => (
                  <span key={s} className={`${styles.tag} ${!p.is_primary && i === 0 ? styles.tagSolid : ''}`}>{s}</span>
                ))}
              </div>
            )}
            <h1 className={styles.teacherH1}>{p.display_name}</h1>
            {bioParas.map((para, i) => (
              <p key={i} className={i === 0 ? styles.bioLead : styles.bioPara}>{para}</p>
            ))}
            {!bioParas.length && p.tagline && <p className={styles.bioLead}>{p.tagline}</p>}

            <Link href={studioPath(studioSlug, '/schedule')} className={styles.btnSolid} style={{ marginTop: '12px' }}>
              See {firstName}&apos;s classes
            </Link>

            {(p.years_experience != null || (p.certifications?.length ?? 0) > 0) && (
              <div style={{ marginTop: 'clamp(28px, 5vw, 44px)' }}>
                <p className={styles.galleryLabel}>Background</p>
                {p.years_experience != null && (
                  <p className={styles.bioPara} style={{ marginBottom: p.certifications?.length ? '10px' : 0 }}>
                    {p.years_experience} year{p.years_experience === 1 ? '' : 's'} of teaching experience
                  </p>
                )}
                {p.certifications && p.certifications.length > 0 && (
                  <ul className={styles.metaList}>
                    {p.certifications.map(c => <li key={c}>{c}</li>)}
                  </ul>
                )}
              </div>
            )}

            {(p.instagram_url || p.website_url) && (
              <div style={{ marginTop: 'clamp(24px, 4vw, 36px)' }}>
                <p className={styles.galleryLabel}>Find {firstName} online</p>
                <div className={styles.onlineLinks}>
                  {p.instagram_url && <a href={p.instagram_url} target="_blank" rel="noopener noreferrer" className={styles.onlineLink}>Instagram ↗</a>}
                  {p.website_url && <a href={p.website_url} target="_blank" rel="noopener noreferrer" className={styles.onlineLink}>Website ↗</a>}
                </div>
              </div>
            )}
          </div>

          {p.photo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={p.photo_url} alt={p.display_name} className={styles.teacherPortrait} />
          )}
        </section>

        {galleryPhotos.length > 0 && (
          <section className={styles.section} style={{ paddingTop: 0 }}>
            <Gallery images={galleryPhotos.map(url => ({ url, alt: p.display_name }))} label="Photos" />
          </section>
        )}

        {upcoming.length > 0 && (
          <section className={styles.section} style={{ paddingTop: 0 }}>
            <p className={styles.galleryLabel}>Upcoming classes</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcoming.map(c => (
                <div key={c.occurrence_id} className={styles.upcomingRow}>
                  <div>
                    <div className={styles.rowName}>{c.session_name}</div>
                    <div className={styles.rowMeta}>
                      {c.delivery_mode === 'online' ? 'Online' : c.location_name || 'In person'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div className={styles.rowMeta}>{formatDateTimeWithWeekday(c.starts_at, org.timezone)}</div>
                    <div className={styles.rowLoc}>{timeRange(c.starts_at, c.ends_at, org.timezone)}</div>
                  </div>
                </div>
              ))}
              <Link href={studioPath(studioSlug, '/schedule')} className={styles.navLink} style={{ marginTop: '4px' }}>
                See the full schedule →
              </Link>
            </div>
          </section>
        )}
      </main>

      <StudioFooter name={studioName} email={content.contactEmail} poweredBy={themed} socials={{ instagram: content.instagramUrl, facebook: content.facebookUrl, tiktok: content.tiktokUrl, youtube: content.youtubeUrl }} />
    </div>
  )
}
