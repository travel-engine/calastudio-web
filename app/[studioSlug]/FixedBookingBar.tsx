'use client'

import { useBookingFlow, type BookableOccurrence } from '@/lib/store/bookingFlow'
import { formatDateWithWeekday } from '@/lib/dates'
import styles from './photofirst.module.css'

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return formatDateWithWeekday(d)
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

// Sticky bottom bar on the public marketing screens — surfaces the next class and opens the
// booking drawer for it (handoff §"Fixed booking bar"). Rendered only when there's an upcoming
// bookable occurrence.
export default function FixedBookingBar({
  studioSlug, next, brandColor, stripeAccountId, paymentsEnabled,
}: {
  studioSlug: string
  next: BookableOccurrence | null
  brandColor?: string
  stripeAccountId: string | null
  paymentsEnabled: boolean
}) {
  const openOccurrence = useBookingFlow(s => s.openOccurrence)
  if (!next) return null

  const price = next.price != null ? formatMoney(next.price, next.currency) : null

  return (
    <div className={styles.fixedBar}>
      <div style={{ minWidth: 0 }}>
        <div className={styles.fixedBarLabel}>Next class</div>
        <div className={styles.fixedBarNext}>
          {dayLabel(next.starts_at)}, {timeLabel(next.starts_at)} · {next.session_name}
        </div>
      </div>
      <button
        type="button"
        className={styles.fixedBarBtn}
        onClick={() => openOccurrence(studioSlug, next, { brandColor, stripeAccountId, paymentsEnabled })}
      >
        {price ? `Book · ${price}` : 'Book'}
      </button>
    </div>
  )
}
