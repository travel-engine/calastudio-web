import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import styles from '../photofirst.module.css'
import type { BookableOccurrence } from '@/lib/store/bookingFlow'
import FilterChips from '../FilterChips'
import SessionRow from '../SessionRow'
import BookingDrawer from '../BookingDrawer'
import MemberScheduleLoader from '../MemberScheduleLoader'
import FixedBookingBar from '../FixedBookingBar'
import StudioFooter from '../StudioFooter'
import { getStudioContent, type PageContentDto } from '../studioContent'
import { studioThemeForRequest } from '@/lib/resolveStudioTheme'
import { dayKey, formatDayLabel } from '@/lib/dates'
import { metaDescription, studioOpenGraph, studioOrigin } from '@/lib/seo'
import { JsonLd, eventLd, breadcrumbLd } from '@/lib/jsonLd'

export const revalidate = 60

interface Props {
  params: Promise<{ studioSlug: string }>
  searchParams: Promise<{ mode?: string; type?: string; location?: string }>
}

interface PublicOrgInfo {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  brand_color: string | null
  currency: string
  // IANA zone (e.g. Australia/Brisbane). Class times are shown on the studio's clock.
  timezone?: string | null
  stripe_account_id: string | null
  payments_enabled: boolean
  theme?: string | null
  page_content?: PageContentDto | null
  contactEmail?: string | null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studioSlug } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  if (!res.ok) return {}
  const org: PublicOrgInfo = await res.json()
  const description = metaDescription(org.description, `See the upcoming class schedule at ${org.name} and book online.`)
  return {
    title: 'Schedule',
    description,
    alternates: { canonical: '/schedule' },
    openGraph: studioOpenGraph({
      siteName: org.name, title: `Schedule · ${org.name}`, description, path: '/schedule',
      image: org.banner_url || org.logo_url,
    }),
  }
}

export default async function StudioSchedulePage({ params, searchParams }: Props) {
  const { studioSlug } = await params
  const sp = await searchParams
  const base = process.env.NEXT_PUBLIC_API_URL

  const mode = sp.mode && sp.mode !== 'all' ? sp.mode : undefined
  const sessionType = sp.type && sp.type !== 'all' ? sp.type : undefined

  const query = new URLSearchParams()
  if (mode) query.set('mode', mode)
  if (sessionType) query.set('sessionType', sessionType)
  const qs = query.toString()

  const [orgRes, occurrencesRes] = await Promise.all([
    fetch(`${base}/api/public/${studioSlug}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/public/${studioSlug}/occurrences${qs ? `?${qs}` : ''}`, { next: { revalidate: 60 } }),
  ])
  if (orgRes.status === 404) notFound()
  if (!orgRes.ok || !occurrencesRes.ok) throw new Error('Failed to load studio')
  const org: PublicOrgInfo = await orgRes.json()
  const occurrences: BookableOccurrence[] = await occurrencesRes.json()
  const content = getStudioContent(studioSlug, org.page_content)
  const brandColor = org.brand_color || undefined
  const themed = (await studioThemeForRequest(org.theme)).layout === 'themed'

  // Locations available under the current mode/type filters — computed before the location filter
  // is applied so picking one doesn't collapse the set down to itself.
  const locations = Array.from(new Set(
    occurrences.map(o => o.location_name).filter((l): l is string => !!l),
  )).sort()

  const selectedLocation = sp.location && sp.location !== 'all' ? sp.location : undefined
  const visible = selectedLocation
    ? occurrences.filter(o => o.location_name === selectedLocation)
    : occurrences

  const groups = new Map<string, BookableOccurrence[]>()
  for (const occ of visible) {
    const key = dayKey(occ.starts_at, org.timezone)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(occ)
  }

  const live = visible.filter(o => !o.is_cancelled)
  const now = Date.now()
  const next = live.find(o => new Date(o.starts_at).getTime() > now) ?? live[0] ?? null

  const origin = studioOrigin(studioSlug)
  const ldCtx = { studioName: org.name, studioUrl: `${origin}/`, pageUrl: `${origin}/schedule` }

  const bookProps = {
    studioSlug,
    brandColor,
    stripeAccountId: org.stripe_account_id,
    paymentsEnabled: org.payments_enabled,
    timeZone: org.timezone ?? null,
  }

  return (
    <div className={styles.root}>
      <JsonLd data={breadcrumbLd([
        { name: org.name, url: `${origin}/` },
        { name: 'Schedule', url: `${origin}/schedule` },
      ])} />
      {live.length > 0 && <JsonLd data={live.map(o => eventLd(o, ldCtx))} />}

      <main className={styles.container}>
        <header className={styles.pageHeader}>
          <h1 className={styles.h1}>Schedule</h1>
          <p className={styles.lead}>Booking opens seven days ahead. Full sessions take a waitlist.</p>
        </header>

        <FilterChips
          mode={sp.mode ?? 'all'}
          sessionType={sp.type ?? 'all'}
          location={sp.location ?? 'all'}
          locations={locations}
        />

        {visible.length === 0 ? (
          <div className={styles.emptyState}>No upcoming sessions match these filters.</div>
        ) : (
          Array.from(groups.entries()).map(([day, dayOccurrences]) => (
            <section key={day} className={styles.dayGroup}>
              <h2 className={styles.dayLabel}>{formatDayLabel(dayOccurrences[0].starts_at, org.timezone)}</h2>
              <div className={styles.rowList}>
                {dayOccurrences.map(occ => (
                  <SessionRow key={occ.occurrence_id} occ={occ} showLocation {...bookProps} />
                ))}
              </div>
            </section>
          ))
        )}
        <div style={{ height: 32 }} />
      </main>

      <StudioFooter name={org.name} email={content.contactEmail} poweredBy={themed} socials={{ instagram: content.instagramUrl, facebook: content.facebookUrl, tiktok: content.tiktokUrl, youtube: content.youtubeUrl }} />
      {!themed && <FixedBookingBar next={next} {...bookProps} />}

      <BookingDrawer />
      <MemberScheduleLoader studioSlug={studioSlug} orgId={org.id} queryString={qs} />
    </div>
  )
}
