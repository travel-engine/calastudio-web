import { create } from 'zustand'

// Per-viewer booking state for the public studio schedule page. The page is a Server Component with
// no auth; MemberScheduleLoader hydrates this client-side (one authed GET of the occurrence listing)
// when a Supabase session exists, so each card can show "Booked · Cancel" instead of "Book".

interface MemberBooking {
  bookingId: string
  status: string
  canCancel: boolean
}

interface MemberScheduleState {
  loaded: boolean
  orgId: string | null
  accessToken: string | null
  // occurrence_id -> the member's booking for it (from viewer_booking on the listing)
  byOccurrence: Record<string, MemberBooking>

  setContext: (ctx: { orgId: string; accessToken: string; byOccurrence: Record<string, MemberBooking> }) => void
  markLoaded: () => void
  addBooking: (occurrenceId: string, booking: MemberBooking) => void
  removeBooking: (occurrenceId: string) => void
}

export const useMemberSchedule = create<MemberScheduleState>((set) => ({
  loaded: false,
  orgId: null,
  accessToken: null,
  byOccurrence: {},

  setContext: ({ orgId, accessToken, byOccurrence }) =>
    set({ orgId, accessToken, byOccurrence, loaded: true }),
  markLoaded: () => set({ loaded: true }),
  addBooking: (occurrenceId, booking) =>
    set((s) => ({ byOccurrence: { ...s.byOccurrence, [occurrenceId]: booking } })),
  removeBooking: (occurrenceId) =>
    set((s) => {
      const next = { ...s.byOccurrence }
      delete next[occurrenceId]
      return { byOccurrence: next }
    }),
}))
