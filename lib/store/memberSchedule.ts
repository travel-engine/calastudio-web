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
  // The viewer is a member of this studio (GET members/me succeeded), so Book can skip the
  // drawer's sign-in / register step.
  registered: boolean
  // occurrence_id -> the member's booking for it (from viewer_booking on the listing)
  byOccurrence: Record<string, MemberBooking>

  setContext: (ctx: { orgId: string; accessToken: string; byOccurrence: Record<string, MemberBooking>; registered?: boolean }) => void
  markLoaded: () => void
  addBooking: (occurrenceId: string, booking: MemberBooking) => void
  removeBooking: (occurrenceId: string) => void
}

export const useMemberSchedule = create<MemberScheduleState>((set) => ({
  loaded: false,
  orgId: null,
  accessToken: null,
  registered: false,
  byOccurrence: {},

  setContext: ({ orgId, accessToken, byOccurrence, registered }) =>
    set({ orgId, accessToken, byOccurrence, registered: !!registered, loaded: true }),
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

/** The signed-in member's auth when they're already a member of this studio, for
 *  openOccurrence({ auth }) so the drawer skips its sign-in step; otherwise undefined. */
export function useKnownMemberAuth(): { accessToken: string; orgId: string } | undefined {
  const registered = useMemberSchedule(s => s.registered)
  const accessToken = useMemberSchedule(s => s.accessToken)
  const orgId = useMemberSchedule(s => s.orgId)
  return registered && accessToken && orgId ? { accessToken, orgId } : undefined
}
