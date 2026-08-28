import { create } from 'zustand'

export interface BookableOccurrence {
  occurrence_id: string
  session_id: string
  session_name: string
  session_type: string
  delivery_mode: 'in_person' | 'online' | 'hybrid'
  starts_at: string
  ends_at: string
  instructor_name: string | null
  instructor_photo_url: string | null
  location_name: string | null
  price_inperson: number | null
  price_online: number | null
  currency: string
  spots_remaining_inperson: number | null
  spots_remaining_online: number | null
  is_cancelled: boolean
}

export interface PassTemplateOption {
  id: string
  name: string
  price: number
  currency: string
}

export interface BookingOptions {
  occurrence_id: string
  session_id: string
  session_name: string
  booking_access_mode: 'open' | 'free' | 'restricted'
  is_bookable: boolean
  is_free: boolean
  drop_in_allowed: boolean
  base_price_inperson: number | null
  base_price_online: number | null
  currency: string
  is_authenticated: boolean
  is_active_member: boolean
  usable_pass_id: string | null
  usable_pass_name: string | null
  purchasable_pass_templates: PassTemplateOption[] | null
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

// Multi-step booking flow state, shared by the drawer and its step components — a member picks a
// mode, signs in, then pays (drop-in card, pass purchase, or an already-usable pass) or just
// confirms for free/pass-covered sessions. Central store per calastudio-web CLAUDE.md's "booking
// flow state goes in zustand, not prop-drilled or duplicated per step" convention.
//
// 'waitlist' / 'waitlist-joined' cover 04-booking-flow.md §4.4: reached either proactively (the
// chosen mode was already full when the drawer opened — see joiningWaitlist below) or reactively,
// when a normal booking attempt loses a last-minute capacity race (BookingDrawer catches "This
// session is full." from the confirm/drop-in calls and redirects here instead of a dead-end error).
export type BookingStep = 'mode' | 'auth' | 'agreements' | 'options' | 'waitlist' | 'waitlist-joined' | 'confirming' | 'success' | 'error'

// A occurrence's spots_remaining_* is null for unlimited capacity (never full) and otherwise the
// live count as of the page's last render — good enough to decide which flow to open with; the
// actual join/booking calls re-check for real server-side.
function isModeFull(occurrence: BookableOccurrence, mode: 'in_person' | 'online') {
  const spots = mode === 'online' ? occurrence.spots_remaining_online : occurrence.spots_remaining_inperson
  return spots !== null && spots <= 0
}

interface BookingFlowState {
  studioSlug: string | null
  occurrence: BookableOccurrence | null
  brandColor: string
  step: BookingStep
  bookedMode: 'in_person' | 'online' | null

  // Resolved once the member is signed in — read by the payment step to call member-scoped
  // endpoints and to initialize Stripe.js against the studio's connected account.
  accessToken: string
  orgId: string
  stripeAccountId: string | null

  bookingOptions: BookingOptions | null
  confirmedBooking: ConfirmedBooking | null
  errorMessage: string

  // Whether the currently-chosen mode was already full when selected — decides whether the drawer
  // routes into the join-waitlist step instead of the normal options/payment steps.
  joiningWaitlist: boolean
  joinedWaitlistEntry: JoinedWaitlistEntry | null

  openOccurrence: (studioSlug: string, occurrence: BookableOccurrence, brandColor?: string) => void
  close: () => void
  setStep: (step: BookingStep) => void
  setBookedMode: (mode: 'in_person' | 'online') => void
  setAuth: (auth: { accessToken: string; orgId: string; stripeAccountId: string | null }) => void
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
  step: 'mode' as BookingStep,
  bookedMode: null as 'in_person' | 'online' | null,
  accessToken: '',
  orgId: '',
  stripeAccountId: null as string | null,
  bookingOptions: null as BookingOptions | null,
  confirmedBooking: null as ConfirmedBooking | null,
  errorMessage: '',
  joiningWaitlist: false,
  joinedWaitlistEntry: null as JoinedWaitlistEntry | null,
}

export const useBookingFlow = create<BookingFlowState>((set) => ({
  ...initialFlowState,

  openOccurrence: (studioSlug, occurrence, brandColor) => {
    const singleMode = occurrence.delivery_mode === 'hybrid' ? null : occurrence.delivery_mode
    set({
      ...initialFlowState,
      studioSlug,
      occurrence,
      brandColor: brandColor || DEFAULT_BRAND_COLOR,
      step: singleMode === null ? 'mode' : 'auth',
      bookedMode: singleMode,
      joiningWaitlist: singleMode !== null && isModeFull(occurrence, singleMode),
    })
  },

  close: () => set({ ...initialFlowState }),

  setStep: (step) => set({ step }),
  setBookedMode: (bookedMode) => set((state) => ({
    bookedMode,
    joiningWaitlist: state.occurrence !== null && isModeFull(state.occurrence, bookedMode),
  })),
  setAuth: ({ accessToken, orgId, stripeAccountId }) => set({ accessToken, orgId, stripeAccountId }),
  setBookingOptions: (bookingOptions) => set({ bookingOptions }),
  setConfirmedBooking: (confirmedBooking) => set({ confirmedBooking, step: 'success' }),
  setError: (errorMessage) => set({ errorMessage, step: 'error' }),
  // Reactive fallback — a normal booking attempt just lost the capacity race, so treat it the same
  // as if the mode had been full from the start rather than dead-ending on a raw error.
  goToWaitlist: () => set({ joiningWaitlist: true, step: 'waitlist' }),
  setJoinedWaitlist: (joinedWaitlistEntry) => set({ joinedWaitlistEntry, step: 'waitlist-joined' }),
}))
