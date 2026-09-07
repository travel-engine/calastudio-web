import { notFound } from 'next/navigation'
import FilterBar from './FilterBar'
import BookButton from './BookButton'
import BookingDrawer from './BookingDrawer'
import MemberScheduleLoader from './MemberScheduleLoader'
import styles from './booking.module.css'
import type { BookableOccurrence } from '@/lib/store/bookingFlow'
import { formatDateWithWeekday } from '@/lib/dates'

export const revalidate = 60

interface Props {
  params: Promise<{ studioSlug: string }>
  searchParams: Promise<{ mode?: string; type?: string; location?: string }>
}

function formatDayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return formatDateWithWeekday(d)
}

function formatTimeRange(startsAt: string, endsAt: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(startsAt).toLocaleTimeString(undefined, opts)} – ${new Date(endsAt).toLocaleTimeString(undefined, opts)}`
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

function deliveryModeLabel(mode: string) {
  return mode === 'online' ? 'Online' : 'In-person'
}

function spotsLabel(occ: BookableOccurrence) {
  if (occ.is_cancelled) return { text: 'Cancelled', tone: 'full' as const }
  if (occ.spots_remaining === null) return { text: '', tone: 'normal' as const }
  const total = occ.spots_remaining
  if (total <= 0) return { text: 'Full', tone: 'full' as const }
  if (total <= 3) return { text: `Only ${total} left`, tone: 'low' as const }
  return { text: `${total} spots left`, tone: 'normal' as const }
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
  stripe_account_id: string | null
  payments_enabled: boolean
}

export default async function StudioBookingPage({ params, searchParams }: Props) {
  const { studioSlug } = await params
  const sp = await searchParams
  const mode = sp.mode && sp.mode !== 'all' ? sp.mode : undefined
  const sessionType = sp.type && sp.type !== 'all' ? sp.type : undefined

  const query = new URLSearchParams()
  if (mode) query.set('mode', mode)
  if (sessionType) query.set('sessionType', sessionType)
  const qs = query.toString()

  const [orgRes, occurrencesRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } }),
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}/occurrences${qs ? `?${qs}` : ''}`, { next: { revalidate: 60 } }),
  ])
  if (orgRes.status === 404) notFound()
  if (!orgRes.ok || !occurrencesRes.ok) throw new Error('Failed to load studio')
  const org: PublicOrgInfo = await orgRes.json()
  const occurrences: BookableOccurrence[] = await occurrencesRes.json()
  const brandColor = org.brand_color || undefined

  // Locations available under the current mode/type filters — computed before the location
  // filter itself is applied, so picking one doesn't collapse the dropdown down to just itself.
  const locations = Array.from(new Set(
    occurrences.map(o => o.location_name).filter((l): l is string => !!l)
  )).sort()

  const selectedLocation = sp.location && sp.location !== 'all' ? sp.location : undefined
  const visibleOccurrences = selectedLocation
    ? occurrences.filter(o => o.location_name === selectedLocation)
    : occurrences

  const groups = new Map<string, BookableOccurrence[]>()
  for (const occ of visibleOccurrences) {
    const key = new Date(occ.starts_at).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(occ)
  }

  return (
    <div className={styles.page}>
      {org.banner_url && (
        <div style={{ width: '100%', aspectRatio: '3 / 1', maxHeight: '320px', overflow: 'hidden' }}>
          <img src={org.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{org.name}</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
            {org.description || 'Browse and book upcoming sessions.'}
          </p>
        </div>
      </header>

      <div className={styles.content}>
        <FilterBar
          mode={sp.mode ?? 'all'}
          sessionType={sp.type ?? 'all'}
          location={sp.location ?? 'all'}
          locations={locations.length > 1 ? locations : undefined}
        />

        {visibleOccurrences.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
            No upcoming sessions match these filters.
          </div>
        ) : (
          Array.from(groups.entries()).map(([day, dayOccurrences]) => (
            <div key={day} className={styles.dayGroup}>
              <div className={styles.dayLabel}>{formatDayLabel(dayOccurrences[0].starts_at)}</div>
              <div className={styles.cardList}>
                {dayOccurrences.map(occ => {
                  const spots = spotsLabel(occ)
                  // A full occurrence still opens the drawer — it routes into "join the waitlist"
                  // instead of the normal booking steps (04-booking-flow.md §4.4). Only a cancelled
                  // occurrence is genuinely unbookable.
                  const bookable = !occ.is_cancelled
                  const prices = occ.price != null ? [occ.price] : []

                  return (
                    <div key={occ.occurrence_id} className={styles.card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        {occ.photo_url ? (
                          <img src={occ.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                        ) : occ.instructor_photo_url ? (
                          <img src={occ.instructor_photo_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#f4f4f4', flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{occ.session_name}</div>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            {formatTimeRange(occ.starts_at, occ.ends_at)} · {deliveryModeLabel(occ.delivery_mode)}
                            {occ.instructor_name ? ` · ${occ.instructor_name}` : ''}
                          </div>
                          {occ.location_name && (
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{occ.location_name}</div>
                          )}
                          {occ.is_cancelled && occ.cancellation_reason && (
                            <div style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '2px' }}>
                              Cancelled — {occ.cancellation_reason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          {spots.text && (
                            <div style={{
                              fontSize: '12px', fontWeight: 500,
                              color: spots.tone === 'full' ? '#8b1a1a' : spots.tone === 'low' ? '#7a4f00' : '#666'
                            }}>
                              {spots.text}
                            </div>
                          )}
                          {prices.length > 0 && (
                            <div style={{ fontSize: '13px', color: '#444', marginTop: '2px' }}>
                              from {formatMoney(Math.min(...prices), occ.currency)}
                            </div>
                          )}
                        </div>
                        <BookButton
                          studioSlug={studioSlug}
                          occurrence={occ}
                          disabled={!bookable}
                          label={occ.is_cancelled ? 'Cancelled' : spots.tone === 'full' ? 'Join waitlist' : 'Book'}
                          brandColor={brandColor}
                          stripeAccountId={org.stripe_account_id}
                          paymentsEnabled={org.payments_enabled}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <BookingDrawer />
      <MemberScheduleLoader studioSlug={studioSlug} orgId={org.id} queryString={qs} />
    </div>
  )
}
