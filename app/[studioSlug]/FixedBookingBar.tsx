'use client'

import { useBookingFlow, type BookableOccurrence } from '@/lib/store/bookingFlow'
import { dayKey, formatTime, safeZone } from '@/lib/dates'
import styles from './photofirst.module.css'

// This is a Client Component that renders during SSR *and* re-renders on hydration, so every
// formatter here pins its locale — an `undefined` (runtime-default) locale formats differently on
// the Node server vs. the browser and trips a hydration mismatch. Same reasoning as PricingList.
// The studio timeZone is pinned for the same reason (Vercel renders in UTC), and because class
// times belong on the studio's clock.
const LOCALE = 'en-AU'

function dayLabel(iso: string, timeZone?: string | null) {
  const key = dayKey(iso, timeZone)
  if (key === dayKey(Date.now(), timeZone)) return 'Today'
  if (key === dayKey(Date.now() + 24 * 60 * 60 * 1000, timeZone)) return 'Tomorrow'
  return new Date(iso).toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: 'short', timeZone: safeZone(timeZone) })
}

function timeLabel(iso: string, timeZone?: string | null) {
  return formatTime(iso, timeZone)
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

// Sticky bottom bar on the public marketing screens — surfaces the next class and opens the
// booking drawer for it (handoff §"Fixed booking bar"). Rendered only when there's an upcoming
// bookable occurrence.
export default function FixedBookingBar({
  studioSlug, next, brandColor, stripeAccountId, paymentsEnabled, timeZone,
}: {
  studioSlug: string
  next: BookableOccurrence | null
  brandColor?: string
  stripeAccountId: string | null
  paymentsEnabled: boolean
  timeZone?: string | null
}) {
  const openOccurrence = useBookingFlow(s => s.openOccurrence)
  if (!next) return null

  const price = next.price != null ? formatMoney(next.price, next.currency) : null

  return (
    <div className={styles.fixedBar}>
      <div style={{ minWidth: 0 }}>
        <div className={styles.fixedBarLabel}>Next class</div>
        <div className={styles.fixedBarNext}>
          {dayLabel(next.starts_at, timeZone)}, {timeLabel(next.starts_at, timeZone)} · {next.session_name}
        </div>
      </div>
      <button
        type="button"
        className={styles.fixedBarBtn}
        onClick={() => openOccurrence(studioSlug, next, { brandColor, stripeAccountId, paymentsEnabled, timeZone })}
      >
        {price ? `Book · ${price}` : 'Book'}
      </button>
    </div>
  )
}
