import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import styles from '../../booking.module.css'
import { formatDateTimeWithWeekday } from '@/lib/dates'
import { initials } from '@/lib/names'
import { metaDescription, studioOpenGraph } from '@/lib/seo'
import TeacherPhoto from '../TeacherPhoto'
import PhotoGallery from '../PhotoGallery'

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
}

interface TeacherPageData {
  profile: TeacherProfile | null
  upcoming_classes: UpcomingClass[]
}

function timeRange(startIso: string, endIso: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(startIso).toLocaleTimeString('en-AU', opts)} – ${new Date(endIso).toLocaleTimeString('en-AU', opts)}`
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{title}</h2>
      {children}
    </section>
  )
}

export default async function TeacherLandingPage({ params }: Props) {
  const { studioSlug, teacherSlug } = await params
  const base = process.env.NEXT_PUBLIC_API_URL

  const res = await fetch(`${base}/api/public/${studioSlug}/teachers/${teacherSlug}`, { next: { revalidate: 60 } })
  // 404 covers both "no such studio/teacher" and an unpublished page — the endpoint filters on
  // is_page_published, so an unpublished teacher simply isn't found here.
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load teacher')

  const data: TeacherPageData = await res.json()
  const p = data.profile
  if (!p) notFound()

  const chips = [
    ...(p.specialties ?? []),
  ]
  const upcoming = (data.upcoming_classes ?? []).filter(c => !c.is_cancelled)
  // Gallery = the extra photos, minus the one already shown as the hero.
  const galleryPhotos = (p.photos ?? []).filter(u => u && u !== p.photo_url)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner} style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {p.photo_url ? (
            <TeacherPhoto src={p.photo_url} alt={p.display_name} size={96} />
          ) : (
            <div style={{
              width: 96, height: 96, borderRadius: '50%', backgroundColor: '#085041', color: 'white', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: 700,
            }}>
              {initials(p.display_name)}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <Link href={`/${studioSlug}/teachers`} style={{ fontSize: '12px', color: '#085041', fontWeight: 600, textDecoration: 'none' }}>← All teachers</Link>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{p.display_name}</h1>
            {p.tagline && <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>{p.tagline}</p>}
          </div>
        </div>
      </header>

      <main className={styles.content}>
        {p.bio && (
          <Section title="About">
            <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.bio}</div>
          </Section>
        )}

        {galleryPhotos.length > 0 && (
          <Section title="Photos">
            <PhotoGallery photos={galleryPhotos} alt={p.display_name} />
          </Section>
        )}

        {(chips.length > 0 || p.certifications?.length || p.years_experience != null) && (
          <Section title="Background">
            {p.years_experience != null && (
              <div style={{ fontSize: '14px', color: '#333', marginBottom: chips.length || p.certifications?.length ? '12px' : 0 }}>
                {p.years_experience} year{p.years_experience === 1 ? '' : 's'} of teaching experience
              </div>
            )}
            {chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: p.certifications?.length ? '12px' : 0 }}>
                {chips.map(s => (
                  <span key={s} style={{ fontSize: '12px', fontWeight: 500, color: '#444', backgroundColor: '#f0f0f0', borderRadius: '999px', padding: '3px 10px' }}>{s}</span>
                ))}
              </div>
            )}
            {p.certifications && p.certifications.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#555' }}>
                {p.certifications.map(c => <li key={c} style={{ marginBottom: '2px' }}>{c}</li>)}
              </ul>
            )}
          </Section>
        )}

        {(p.instagram_url || p.website_url) && (
          <Section title="Find them online">
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {p.instagram_url && (
                <a href={p.instagram_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: '#085041' }}>Instagram ↗</a>
              )}
              {p.website_url && (
                <a href={p.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: '#085041' }}>Website ↗</a>
              )}
            </div>
          </Section>
        )}

        <Section title="Upcoming classes">
          {upcoming.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#999' }}>No public classes scheduled right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcoming.map(c => (
                <div key={c.occurrence_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', paddingBottom: '10px', borderBottom: '1px solid #f4f4f4' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{c.session_name}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                      {c.delivery_mode === 'online' ? 'Online' : c.location_name || 'In person'}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#444', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatDateTimeWithWeekday(c.starts_at)}
                    <div style={{ fontSize: '12px', color: '#999' }}>{timeRange(c.starts_at, c.ends_at)}</div>
                  </div>
                </div>
              ))}
              <Link href={`/${studioSlug}`} style={{ fontSize: '13px', fontWeight: 600, color: '#085041', marginTop: '4px' }}>
                See the full schedule →
              </Link>
            </div>
          )}
        </Section>
      </main>
    </div>
  )
}
