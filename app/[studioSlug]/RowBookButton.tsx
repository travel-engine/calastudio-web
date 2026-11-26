'use client'

import { useEffect, useState } from 'react'
import { useBookingFlow, type BookableOccurrence } from '@/lib/store/bookingFlow'
import { useMemberSchedule, useKnownMemberAuth } from '@/lib/store/memberSchedule'
import styles from './photofirst.module.css'

// The Book / Waitlist control in a Photo First session row. Opens the shared booking drawer for
// this occurrence; if the signed-in member already holds a confirmed booking it shows a static
// "Booked" marker instead (cancellation lives in the member's account area, matching the design —
// the row itself has no cancel affordance).
// Until MemberScheduleLoader knows whether the viewer is signed in and what they've booked, it shows
// a quiet placeholder instead of "Book", so a booked class doesn't flash "Book" then "Booked".
// Anonymous visitors resolve almost at once; after 8 s it falls back to the normal button anyway.
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
  const loaded = useMemberSchedule(s => s.loaded)
  const auth = useKnownMemberAuth()
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    if (loaded) return
    const t = setTimeout(() => setGaveUp(true), 8000)
    return () => clearTimeout(t)
  }, [loaded])

  if (booked && !occurrence.is_cancelled) {
    return (
      <span className={styles.rowSpots} style={{ whiteSpace: 'nowrap' }}>
        ✓ Booked
      </span>
    )
  }

  if (!loaded && !gaveUp && !occurrence.is_cancelled) {
    return (
      <button type="button" className={styles.rowBtn} disabled aria-busy="true" aria-label="Checking your bookings"
        style={{ opacity: 0.45, cursor: 'default' }}>
        …
      </button>
    )
  }

  const full = occurrence.spots_remaining !== null && occurrence.spots_remaining <= 0
  const closed = occurrence.is_bookable === false && !occurrence.is_cancelled
  const label = occurrence.is_cancelled ? 'Cancelled' : closed ? 'Closed' : full ? 'Waitlist' : 'Book'

  return (
    <button
      type="button"
      className={`${styles.rowBtn} ${full && !occurrence.is_cancelled ? styles.rowBtnWaitlist : ''}`}
      disabled={occurrence.is_cancelled || closed}
      title={closed ? 'Online booking has closed for this class' : undefined}
      onClick={() => openOccurrence(studioSlug, occurrence, { brandColor, stripeAccountId, paymentsEnabled, timeZone, auth })}
    >
      {label}
    </button>
  )
}
