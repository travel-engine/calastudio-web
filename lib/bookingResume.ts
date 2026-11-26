import type { BookableOccurrence } from '@/lib/store/bookingFlow'

// The booking drawer lives on the schedule pages. A page without it (e.g. the account Home tab)
// stashes the class here and navigates to the schedule; the drawer reopens on it when it mounts.
// Google / Apple sign-in uses the same key to come back to the class being booked.
export const BOOKING_RESUME_KEY = 'cs-resume-booking'

export interface BookingResumeOpts {
  brandColor?: string
  stripeAccountId?: string | null
  paymentsEnabled?: boolean
  timeZone?: string | null
}

export function stashBookingResume(studioSlug: string, occurrence: BookableOccurrence, opts: BookingResumeOpts): boolean {
  try {
    sessionStorage.setItem(BOOKING_RESUME_KEY, JSON.stringify({ at: Date.now(), studioSlug, occurrence, opts }))
    return true
  } catch {
    return false
  }
}
