'use client'

import { useBookingFlow, type BookableOccurrence } from '@/lib/store/bookingFlow'
import { useMemberSchedule } from '@/lib/store/memberSchedule'
import styles from './photofirst.module.css'

// The Book / Waitlist control in a Photo First session row. Opens the shared booking drawer for
// this occurrence; if the signed-in member already holds a confirmed booking it shows a static
// "Booked" marker instead (cancellation lives in the member's account area, matching the design —
// the row itself has no cancel affordance).
export default function RowBookButton({
  studioSlug, occurrence, brandColor, stripeAccountId, paymentsEnabled, timeZone,
}: {
  studioSlug: string
  occurrence: BookableOccurrence
  brandColor?: string
  stripeAccountId: string | null
  paymentsEnabled: boolean
  timeZone?: string | null
}) {
  const openOccurrence = useBookingFlow(s => s.openOccurrence)
  const booked = useMemberSchedule(s => s.byOccurrence[occurrence.occurrence_id])

  if (booked && !occurrence.is_cancelled) {
    return (
      <span className={styles.rowSpots} style={{ whiteSpace: 'nowrap' }}>
        ✓ Booked
      </span>
    )
  }

  const full = occurrence.spots_remaining !== null && occurrence.spots_remaining <= 0
  const label = occurrence.is_cancelled ? 'Cancelled' : full ? 'Waitlist' : 'Book'

  return (
    <button
      type="button"
      className={`${styles.rowBtn} ${full && !occurrence.is_cancelled ? styles.rowBtnWaitlist : ''}`}
      disabled={occurrence.is_cancelled}
      onClick={() => openOccurrence(studioSlug, occurrence, { brandColor, stripeAccountId, paymentsEnabled, timeZone })}
    >
      {label}
    </button>
  )
}
