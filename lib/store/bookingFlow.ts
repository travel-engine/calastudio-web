import { create } from 'zustand'
import { useMemberSchedule } from './memberSchedule'

export interface BookableOccurrence {
  occurrence_id: string
  session_id: string
  session_name: string
  session_type: string
  delivery_mode: 'in_person' | 'online'
  photo_url: string | null
  description: string | null
  starts_at: string
  ends_at: string
  instructor_name: string | null
  instructor_photo_url: string | null
  location_name: string | null
  location_address: string | null
  price: number | null
  currency: string
  spots_remaining: number | null
  is_cancelled: boolean
  cancellation_reason?: string | null
}

export interface PassTemplateOption {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  pass_type: 'credit' | 'unlimited'
  credit_count: number | null
  expiry_type: 'fixed_date' | 'rolling_days' | 'rolling_months'
  expiry_rolling_value: number | null
  expiry_fixed_date: string | null
}

export interface BookingOptions {
  occurrence_id: string
  session_id: string
  session_name: string
  booking_access_mode: 'open' | 'free' | 'restricted'
  is_bookable: boolean
  is_free: boolean
  drop_in_allowed: boolean
  base_price: number | null
  currency: string
  is_authenticated: boolean
  is_active_member: boolean
  usable_pass_id: string | null
  usable_pass_name: string | null
  usable_pass_credits_remaining: number | null
  purchasable_pass_templates: PassTemplateOption[] | null
  member_credits_cost: number
  guest_credits_cost: number
  guest_bookings_enabled: boolean
  guest_max_per_booking: number
}

export interface ConfirmedBooking {
  id: string
  status: string
}

export interface JoinedWaitlistEntry {
  id: string
  position: number
}

// Multi-step booking flow state, shared by the drawer and its step components — a member signs in,
// then pays (drop-in card, pass purchase, or an already-usable pass) or just confirms for
// free/pass-covered sessions. Central store per calastudio-web CLAUDE.md's "booking flow state goes
// in zustand, not prop-drilled or duplicated per step" convention.
//
// A session has exactly one delivery mode (no hybrid — spec §2.3), so bookedMode is just a
// denormalised copy of the occurrence's delivery_mode, not a member choice — there is no
// mode-picker step.
//
// 'waitlist' / 'waitlist-joined' cover 04-booking-flow.md §4.4: reached either proactively (the
// occurrence was already full when the drawer opened — see joiningWaitlist below) or reactively,
// when a normal booking attempt loses a last-minute capacity race (BookingDrawer catches "This
// session is full." from the confirm/drop-in calls and redirects here instead of a dead-end error).
export type BookingStep = 'auth' | 'agreements' | 'options' | 'waitlist' | 'waitlist-joined' | 'confirming' | 'success' | 'error'

// spots_remaining is null for unlimited capacity (never full) and otherwise the live count as of
// the page's last render — good enough to decide which flow to open with; the actual join/booking
// calls re-check for real server-side.
function isOccurrenceFull(occurrence: BookableOccurrence) {
  return occurrence.spots_remaining !== null && occurrence.spots_remaining <= 0
}

interface BookingFlowState {
  studioSlug: string | null
  occurrence: BookableOccurrence | null
  brandColor: string
  step: BookingStep
  bookedMode: 'in_person' | 'online' | null

  // Payment config for the studio — from GET /api/public/{orgSlug} (the drawer has no admin token,
  // so it can't read these off the admin org endpoint). Set when the drawer opens.
  stripeAccountId: string | null
  paymentsEnabled: boolean
  // Studio IANA timezone, so the drawer shows class times on the studio's clock.
  timeZone: string | null

  // Resolved once the member is signed in — read by the payment step to call member-scoped endpoints.
  accessToken: string
  orgId: string

  bookingOptions: BookingOptions | null
  confirmedBooking: ConfirmedBooking | null
  errorMessage: string

  // Whether the occurrence was already full when opened — decides whether the drawer routes into
  // the join-waitlist step instead of the normal options/payment steps.
  joiningWaitlist: boolean
  joinedWaitlistEntry: JoinedWaitlistEntry | null

  openOccurrence: (
    studioSlug: string,
    occurrence: BookableOccurrence,
    opts?: { brandColor?: string; stripeAccountId?: string | null; paymentsEnabled?: boolean; timeZone?: string | null },
  ) => void
  close: () => void
  setStep: (step: BookingStep) => void
  setAuth: (auth: { accessToken: string; orgId: string }) => void
  setBookingOptions: (options: BookingOptions) => void
  setConfirmedBooking: (booking: ConfirmedBooking) => void
  setError: (message: string) => void
  goToWaitlist: () => void
  setJoinedWaitlist: (entry: JoinedWaitlistEntry) => void
}

const DEFAULT_BRAND_COLOR = '#085041'

const initialFlowState = {
  studioSlug: null as string | null,
  occurrence: null as BookableOccurrence | null,
  brandColor: DEFAULT_BRAND_COLOR,
  step: 'auth' as BookingStep,
  bookedMode: null as 'in_person' | 'online' | null,
  accessToken: '',
  orgId: '',
  stripeAccountId: null as string | null,
  paymentsEnabled: false,
  timeZone: null as string | null,
  bookingOptions: null as BookingOptions | null,
  confirmedBooking: null as ConfirmedBooking | null,
  errorMessage: '',
  joiningWaitlist: false,
  joinedWaitlistEntry: null as JoinedWaitlistEntry | null,
}

export const useBookingFlow = create<BookingFlowState>((set) => ({
  ...initialFlowState,

  openOccurrence: (studioSlug, occurrence, opts) => set({
    ...initialFlowState,
    studioSlug,
    occurrence,
    brandColor: opts?.brandColor || DEFAULT_BRAND_COLOR,
    stripeAccountId: opts?.stripeAccountId ?? null,
    paymentsEnabled: opts?.paymentsEnabled ?? false,
    timeZone: opts?.timeZone ?? null,
    step: 'auth',
    bookedMode: occurrence.delivery_mode,
    joiningWaitlist: isOccurrenceFull(occurrence),
  }),

  close: () => set({ ...initialFlowState }),

  setStep: (step) => set({ step }),
  setAuth: ({ accessToken, orgId }) => set({ accessToken, orgId }),
  setBookingOptions: (bookingOptions) => set({ bookingOptions }),
  setConfirmedBooking: (confirmedBooking) => set((s) => {
    // Keep the schedule page's card in sync so it flips to "Booked" behind the drawer.
    if (s.occurrence) {
      useMemberSchedule.getState().addBooking(s.occurrence.occurrence_id, {
        bookingId: confirmedBooking.id,
        status: confirmedBooking.status,
        canCancel: true, // just booked — within the cancellation window
      })
    }
    return { confirmedBooking, step: 'success' }
  }),
  setError: (errorMessage) => set({ errorMessage, step: 'error' }),
  // Reactive fallback — a normal booking attempt just lost the capacity race, so treat it the same
  // as if the occurrence had been full from the start rather than dead-ending on a raw error.
  goToWaitlist: () => set({ joiningWaitlist: true, step: 'waitlist' }),
  setJoinedWaitlist: (joinedWaitlistEntry) => set({ joinedWaitlistEntry, step: 'waitlist-joined' }),
}))
