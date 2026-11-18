import { notFound } from 'next/navigation'
import styles from '../../[studioSlug]/photofirst.module.css'
import type { BookableOccurrence } from '@/lib/store/bookingFlow'
import FilterChips from '../../[studioSlug]/FilterChips'
import SessionRow from '../../[studioSlug]/SessionRow'
import BookingDrawer from '../../[studioSlug]/BookingDrawer'
import MemberScheduleLoader from '../../[studioSlug]/MemberScheduleLoader'
import { dayKey, formatDayLabel } from '@/lib/dates'
import { studioUrl } from '@/lib/seo'
import EmbedFrame from './EmbedFrame'

// Website widget schedule: the studio's schedule + booking drawer, nothing else. Mirrors
// app/[studioSlug]/schedule/page.tsx minus the page header, footer, booking bar and SEO markup.
//
// Query params (set by public/widget.js from the script tag's data attributes):
//   color=#rrggbb   brand colour override (data-color)
//   popup=1         opened as a full-screen popup — shows a close bar
//   mode/type/location  the usual schedule filters
// data-view / data-locale are accepted by widget.js but not acted on yet: the schedule only has a
// list view, and dates follow the studio's timezone.

export const revalidate = 60

interface Props {
  params: Promise<{ studioSlug: string }>
  searchParams: Promise<{ mode?: string; type?: string; location?: string; color?: string; popup?: string }>
}

interface PublicOrgInfo {
  id: string
  name: string
  brand_color: string | null
  timezone?: string | null
  stripe_account_id: string | null
  payments_enabled: boolean
}

const HEX = /^#[0-9a-fA-F]{6}$/

export default async function EmbedSchedulePage({ params, searchParams }: Props) {
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

  const locations = Array.from(new Set(
    occurrences.map(o => o.location_name).filter((l): l is string => !!l),
  )).sort()
  const selectedLocation = sp.location && sp.location !== 'all' ? sp.location : undefined
  const visible = selectedLocation ? occurrences.filter(o => o.location_name === selectedLocation) : occurrences

  const groups = new Map<string, BookableOccurrence[]>()
  for (const occ of visible) {
    const key = dayKey(occ.starts_at, org.timezone)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(occ)
  }

  const bookProps = {
    studioSlug,
    brandColor: (sp.color && HEX.test(sp.color) ? sp.color : org.brand_color) || undefined,
    stripeAccountId: org.stripe_account_id,
    paymentsEnabled: org.payments_enabled,
    timeZone: org.timezone ?? null,
  }

  return (
    <EmbedFrame popup={sp.popup === '1'} studioName={org.name}>
      {/* .root paints the theme background; the min-height / booking-bar padding it carries for
          the full site would stop the iframe from shrinking to its content. */}
      <div className={styles.root} style={{ minHeight: 0, paddingBottom: 0 }}>
        <main className={styles.container} style={{ paddingTop: 16 }}>
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

          <p style={{ margin: 0, padding: '20px 0 16px', textAlign: 'center', fontSize: 12, opacity: 0.6 }}>
            <a href={studioUrl(studioSlug)} target="_blank" rel="noopener" style={{ color: 'inherit' }}>
              Powered by CalaStudio
            </a>
          </p>
        </main>

        <BookingDrawer />
        <MemberScheduleLoader studioSlug={studioSlug} orgId={org.id} queryString={qs} />
      </div>
    </EmbedFrame>
  )
}
