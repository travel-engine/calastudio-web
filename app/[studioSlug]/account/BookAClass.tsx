'use client'

// Home's "Book a class": the next 5 classes from the studio's public schedule, with a location
// picker (remembered on this device) and a Book button that opens the usual booking drawer right
// here. The listing is the same one the schedule page uses; sent with the member's token it says
// which classes they've already booked (viewer_booking), so those show "Booked" instead.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { formatClock, formatDayLabel, formatShortDate } from '@/lib/dates'
import { studioPath } from '@/lib/seo'
import { useBookingFlow, type BookableOccurrence } from '@/lib/store/bookingFlow'
import BookingDrawer from '../BookingDrawer'

const SHOW = 5
const ALL = 'all'
const ONLINE = 'online'

type Listed = BookableOccurrence & { viewer_booking?: { id: string; status: string } | null }

export default function BookAClass({
  apiUrl, studioSlug, accessToken, brand, timeZone, onBooked,
}: {
  apiUrl: string | undefined
  studioSlug: string
  accessToken: string
  brand: string
  timeZone: string | null
  /** A booking or waitlist place was just made from here: refresh the rest of Home. */
  onBooked: () => void
}) {
  const storageKey = `cs-home-location:${studioSlug}`
  const [list, setList] = useState<Listed[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [payments, setPayments] = useState<{ stripeAccountId: string | null; paymentsEnabled: boolean }>({ stripeAccountId: null, paymentsEnabled: false })
  const [location, setLocation] = useState<string>(ALL)
  // Classes booked (or waitlisted) from this card since the listing loaded.
  const [justBooked, setJustBooked] = useState<Record<string, 'booked' | 'waitlisted'>>({})
  const openOccurrence = useBookingFlow(s => s.openOccurrence)

  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); if (saved) setLocation(saved) } catch { /* storage off */ }
  }, [storageKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [orgRes, listRes] = await Promise.all([
          fetch(`${apiUrl}/api/public/${studioSlug}`),
          fetch(`${apiUrl}/api/public/${studioSlug}/occurrences`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        ])
        if (!listRes.ok) throw new Error(String(listRes.status))
        const rows: Listed[] = await listRes.json()
        const org: { stripe_account_id?: string | null; payments_enabled?: boolean } = orgRes.ok ? await orgRes.json() : {}
        if (cancelled) return
        setList(rows)
        setPayments({ stripeAccountId: org.stripe_account_id ?? null, paymentsEnabled: !!org.payments_enabled })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => { cancelled = true }
  }, [apiUrl, studioSlug, accessToken])

  // When the drawer confirms a booking (or a waitlist place) for a class opened from here, show it
  // as booked at once and let Home refresh its summary (credits, next classes).
  const flowOccurrence = useBookingFlow(s => s.occurrence)
  const confirmed = useBookingFlow(s => s.confirmedBooking)
  const joinedWaitlist = useBookingFlow(s => s.joinedWaitlistEntry)
  const reported = useRef<string>('')
  useEffect(() => {
    const id = flowOccurrence?.occurrence_id
    if (!id) return
    const kind = confirmed ? 'booked' : joinedWaitlist ? 'waitlisted' : null
    if (!kind || reported.current === `${id}:${kind}`) return
    reported.current = `${id}:${kind}`
    setJustBooked(b => ({ ...b, [id]: kind }))
    onBooked()
  }, [flowOccurrence, confirmed, joinedWaitlist, onBooked])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return (list ?? []).filter(o => !o.is_cancelled && o.is_bookable !== false && new Date(o.starts_at).getTime() > now)
  }, [list])

  const locations = useMemo(() => {
    const names = Array.from(new Set(upcoming.filter(o => o.delivery_mode !== 'online' && o.location_name).map(o => o.location_name as string))).sort()
    const hasOnline = upcoming.some(o => o.delivery_mode === 'online')
    return { names, hasOnline }
  }, [upcoming])
  const choices = locations.names.length + (locations.hasOnline ? 1 : 0)
  // A remembered location the studio no longer runs falls back to all of them.
  const effective = location === ALL || (location === ONLINE && locations.hasOnline) || locations.names.includes(location) ? location : ALL

  const shown = upcoming
    .filter(o => effective === ALL ? true : effective === ONLINE ? o.delivery_mode === 'online' : o.location_name === effective)
    .slice(0, SHOW)

  const pick = (value: string) => {
    setLocation(value)
    try { localStorage.setItem(storageKey, value) } catch { /* storage off */ }
  }

  const book = (o: Listed) => openOccurrence(studioSlug, o, { brandColor: brand, ...payments, timeZone })

  const btn: React.CSSProperties = {
    border: 'none', borderRadius: '8px', padding: '9px 14px', minHeight: '40px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '14px', fontWeight: 600, background: brand, color: '#fff', whiteSpace: 'nowrap',
  }
  const outline: React.CSSProperties = { ...btn, background: 'transparent', color: brand, border: `1px solid ${brand}` }
  const chip: React.CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: brand, border: `1px solid ${brand}`, borderRadius: '999px', padding: '4px 10px', whiteSpace: 'nowrap',
  }

  return (
    <>
    <section aria-labelledby="book-a-class-heading" style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px 18px 12px', flexWrap: 'wrap' }}>
        <h2 id="book-a-class-heading" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>Book a class</h2>
        {choices > 1 && (
          <select aria-label="Location" value={effective} onChange={e => pick(e.target.value)} style={{
            minHeight: '36px', maxWidth: '60%', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)',
            background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: '14px',
          }}>
            <option value={ALL}>All locations</option>
            {locations.names.map(n => <option key={n} value={n}>{n}</option>)}
            {locations.hasOnline && <option value={ONLINE}>Online</option>}
          </select>
        )}
      </div>

      {failed ? (
        <p style={{ margin: 0, padding: '0 18px 16px', color: 'var(--text-meta)', fontSize: '15px' }}>Couldn&apos;t load the schedule.</p>
      ) : list == null ? (
        <p style={{ margin: 0, padding: '0 18px 16px', color: 'var(--text-meta)', fontSize: '15px' }}>Loading classes…</p>
      ) : shown.length === 0 ? (
        <p style={{ margin: 0, padding: '0 18px 16px', color: 'var(--text-meta)', fontSize: '15px' }}>No classes coming up{effective !== ALL ? ' here' : ''}.</p>
      ) : shown.map(o => {
        const mine = justBooked[o.occurrence_id] ?? (o.viewer_booking?.status === 'confirmed' ? 'booked' : o.viewer_booking?.status === 'waitlisted' ? 'waitlisted' : null)
        const full = o.spots_remaining != null && o.spots_remaining <= 0
        const day = formatDayLabel(o.starts_at, timeZone)
        const when = `${day === 'Today' || day === 'Tomorrow' ? day : formatShortDate(o.starts_at, timeZone)}, ${formatClock(o.starts_at, timeZone)}`
        return (
          <div key={o.occurrence_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: 'var(--text-label)' }}>{when}</div>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{o.session_name}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-meta)' }}>
                {[o.delivery_mode === 'online' ? 'Online' : o.location_name,
                  full ? 'Full' : o.spots_remaining != null ? `${o.spots_remaining} spot${o.spots_remaining === 1 ? '' : 's'} left` : null].filter(Boolean).join(' · ')}
              </div>
            </div>
            {mine === 'booked' ? <span style={chip}>Booked</span>
              : mine === 'waitlisted' ? <span style={chip}>On waitlist</span>
              : <button type="button" style={full ? outline : btn} onClick={() => book(o)}>{full ? 'Join waitlist' : 'Book'}</button>}
          </div>
        )
      })}

      <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--line)' }}>
        <Link href={studioPath(studioSlug, '/schedule')} style={{ fontSize: '14px', fontWeight: 600, color: brand, textDecoration: 'none' }}>
          Full schedule
        </Link>
      </div>
    </section>
    {/* The same drawer the schedule uses, so booking from Home has the same steps and checks. */}
    <BookingDrawer />
    </>
  )
}
