'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewBookings, canManageBookings, canManageOccurrences, canMarkAttended, canAddStudent, canAddMember, canViewMembers } from '@/lib/roles'
import { displayName } from '@/lib/names'
import AddMemberModal from '@/app/components/AddMemberModal'
import CancelOccurrenceModal from '@/app/components/CancelOccurrenceModal'
import EntityActivity from '@/app/components/EntityActivity'
import { formatDate, formatDateTime, formatDateWithWeekday } from '@/lib/dates'
import styles from '@/app/dashboard/dashboard.module.css'

interface SessionDetail {
  id: string
  name: string
  session_type: string
  delivery_mode: 'in_person' | 'online'
  location_name: string | null
  capacity: number | null
  booking_access_mode: 'open' | 'free' | 'restricted'
  instructor_id: string | null
}

interface OccurrenceDetail {
  id: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'cancelled' | 'completed'
  capacity: number | null
  instructor_id: string | null
  instructor_name: string | null
  session: SessionDetail | null
}

interface Teacher {
  id: string
  first_name: string
  last_name: string
}

interface Member {
  id: string
  first_name: string
  last_name: string
  email?: string
}

interface MemberPass {
  id: string
  credits_remaining: number | null
  credits_total: number | null
  expires_at: string
  status: 'active' | 'low' | 'frozen' | 'expired' | 'exhausted'
  pass_template_id: string
  pass_template: {
    name: string
    session_type_restriction: string[] | null
    delivery_mode_restriction: string[] | null
  } | null
}

interface GuestInfo {
  first_name: string | null
  last_name: string | null
  email: string | null
  status: 'confirmed' | 'cancelled'
  credits_used: number
}

interface Booking {
  id: string
  user_id: string
  booked_mode: 'in_person' | 'online'
  status: 'confirmed' | 'attended' | 'cancelled' | 'late_cancel' | 'no_show' | 'waitlisted'
  payment_type?: 'card' | 'pass' | 'membership' | 'admin_waived' | 'free'
  payment_id?: string | null
  amount_paid?: number | null
  currency?: string
  booked_at?: string
  user?: Member | null
  member_name?: string
  guest_count?: number
  guests?: string | null
  cancelled_at?: string | null
  cancelled_by_name?: string | null
  comp_reason?: string | null
  comp_added_by_name?: string | null
  credits_refunded?: number | null
  credits_refunded_at?: string | null
  credits_refunded_by_name?: string | null
  card_refund_amount?: number | null
  total_credits_used?: number
  member_pass_id?: string | null
  // Guests cancelled individually via the admin per-guest cancel — the owning booking stays
  // Confirmed, so these don't show up as their own rows. Roster endpoint only.
  cancelled_guests?: {
    name: string
    cancelled_at: string | null
    cancelled_by_name: string | null
    credits_refunded: number
  }[] | null
}

// Matches WaitlistEndpoints.cs's WaitlistRosterEntry projection — already redacted server-side
// (email is null unless the caller is admin/teacher_super/teacher_general; the member's claim
// token is never included at all), so no further role-gating is needed on this data in the UI.
interface WaitlistRosterEntry {
  id: string
  user_id: string
  member_name: string
  email: string | null
  preferred_mode: 'in_person' | 'online'
  position: number
  spots_needed: number
  intended_guest_count: number
  promotion_mode: 'standard' | 'fast_track' | 'dead_zone' | null
  is_fast_track: boolean
  status: 'waiting' | 'promoted' | 'booked' | 'expired' | 'removed'
  joined_at: string
  promoted_at: string | null
  hold_expires_at: string | null
}

function formatWhen(iso: string) {
  return formatDateTime(iso)
}

// Cancelled/late_cancel only — absent fields (front_desk/teacher_basic's redacted roster view never
// carries them) just render nothing rather than an empty/misleading line. Up to two history lines:
// the cancellation itself (always, if we know it happened), then a second line for the credit
// refund only if one actually occurred — a late-cancelled pass booking with nothing refunded yet
// gets just the first line, matching "Refund credit" still being available for it.
function cancellationHistory(b: Booking): string[] {
  const lines: string[] = []
  if (b.cancelled_at) {
    const by = b.cancelled_by_name ? ` by ${b.cancelled_by_name}` : ''
    lines.push(`Cancelled ${formatWhen(b.cancelled_at)}${by}`)
  }
  if (b.credits_refunded) {
    const when = b.credits_refunded_at ? formatWhen(b.credits_refunded_at) : ''
    const by = b.credits_refunded_by_name ? ` by ${b.credits_refunded_by_name}` : ''
    lines.push(`${b.credits_refunded} credit${b.credits_refunded > 1 ? 's' : ''} refunded${when ? ` ${when}` : ''}${by}`)
  } else if (b.card_refund_amount) {
    lines.push(`${formatMoney(b.card_refund_amount, b.currency ?? 'AUD')} refunded`)
  }
  return lines
}

function parseGuests(booking: Booking): GuestInfo[] {
  if (!booking.guests) return []
  try { return JSON.parse(booking.guests) } catch { return [] }
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function toDateInputValue(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toTimeInputValue(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Occurrence-level capacity overrides the session template's; null on both means uncapped.
// Booked is computed from the already-fetched roster (confirmed/attended only, guests included)
// rather than a separate backend field — same occupancy semantics as the Schedule/Dashboard pages.
function occupancy(occurrence: OccurrenceDetail, bookings: Booking[]) {
  const capacity = occurrence.capacity ?? occurrence.session?.capacity ?? null
  const booked = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'attended')
    .reduce((sum, b) => sum + 1 + (b.guest_count ?? 0), 0)
  return { booked, capacity: capacity as number | null }
}

function OccurrenceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    scheduled: { bg: '#e8f5ee', color: '#085041', label: 'Scheduled' },
    cancelled: { bg: '#fdecea', color: '#8b1a1a', label: 'Cancelled' },
    completed: { bg: '#f4f4f4', color: '#666', label: 'Completed' },
  }
  const s = map[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

const bookingStatusLabels: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: '#e8f5ee', color: '#085041', label: 'Confirmed' },
  attended: { bg: '#e8eef8', color: '#1B4F8A', label: 'Attended' },
  cancelled: { bg: '#f4f4f4', color: '#666', label: 'Cancelled' },
  late_cancel: { bg: '#fff3cd', color: '#7a4f00', label: 'Late cancel' },
  waitlisted: { bg: '#f0ecf8', color: '#4B2D8A', label: 'Waitlisted' },
}

function BookingStatusBadge({ status }: { status: string }) {
  const s = bookingStatusLabels[status]
  if (!s) return null // no_show and any unknown status carry no badge
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

const waitlistStatusLabels: Record<string, { bg: string; color: string; label: string }> = {
  waiting: { bg: '#fff3cd', color: '#7a4f00', label: 'Waiting' },
  promoted: { bg: '#e8f5ee', color: '#085041', label: 'Spot held' },
  booked: { bg: '#e8f5ee', color: '#085041', label: 'Booked' },
  expired: { bg: '#f4f4f4', color: '#666', label: 'Expired' },
  removed: { bg: '#f4f4f4', color: '#666', label: 'Left' },
}

function WaitlistStatusBadge({ status }: { status: string }) {
  const s = waitlistStatusLabels[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

const paymentTypeLabels: Record<string, string> = {
  card: 'Card',
  pass: 'Pass',
  membership: 'Membership',
  admin_waived: 'Comped',
  free: 'Free',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '14px', outline: 'none', backgroundColor: 'white'
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }
const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
  borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#444', fontWeight: 500
}
const paymentChoiceRow = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer',
  border: `1px solid ${active ? '#085041' : '#e2e2e2'}`, borderRadius: '8px',
  backgroundColor: active ? '#f2f9f5' : 'white',
})
const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 4px', marginRight: '24px', background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '14px', fontWeight: 600, color: active ? '#085041' : '#666',
  borderBottom: active ? '2px solid #085041' : '2px solid transparent'
})

type Tab = 'booked' | 'waitlist' | 'cancelled'

export default function OccurrenceDetailPage() {
  const params = useParams()
  const occurrenceId = params.id as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [occurrence, setOccurrence] = useState<OccurrenceDetail | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistRosterEntry[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('booked')

  const [manageError, setManageError] = useState('')
  const [manageBusy, setManageBusy] = useState(false)
  const [showCancelOccurrence, setShowCancelOccurrence] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [activityKey, setActivityKey] = useState(0)
  const [editForm, setEditForm] = useState({ date: '', startTime: '', endTime: '', capacity: '', instructorId: '' })
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)

  const [refundTarget, setRefundTarget] = useState<Booking | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundError, setRefundError] = useState('')

  const [showAddBooking, setShowAddBooking] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberPasses, setMemberPasses] = useState<MemberPass[]>([])
  const [passesLoading, setPassesLoading] = useState(false)
  // Approved pass-template ids for a restricted session (null = not restricted, or not loaded yet).
  const [approvedPassTemplateIds, setApprovedPassTemplateIds] = useState<string[] | null>(null)
  // `choice` is '' (nothing picked), a member-pass id (pay with that pass), or 'comp' (admin-waived).
  const [addForm, setAddForm] = useState({ userId: '', choice: '', compNote: '' })
  const [addingBooking, setAddingBooking] = useState(false)
  const [addBookingError, setAddBookingError] = useState('')

  const authedFetch = useCallback((path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` }
    }), [orgId, token])

  // A restricted session only accepts the specific pass templates on its approved-options list
  // (session_pricing_access) — a pass issued for another session must not be offered here. Open
  // sessions instead honour each pass template's own session-type / delivery-mode restriction.
  // The backend enforces both on booking; this just keeps the "Which pass" picker from listing
  // choices that would be rejected.
  const sessionId = occurrence?.session?.id
  const sessionAccessMode = occurrence?.session?.booking_access_mode
  useEffect(() => {
    if (!sessionId || !orgId || !token) return
    if (sessionAccessMode !== 'restricted') { setApprovedPassTemplateIds(null); return }
    let cancelled = false
    ;(async () => {
      const res = await authedFetch(`/sessions/${sessionId}/pricing-access`)
      if (cancelled || !res.ok) return
      const rows = await res.json()
      setApprovedPassTemplateIds(
        rows.filter((r: { pricing_type: string }) => r.pricing_type === 'pass_template')
          .map((r: { pass_template_id: string }) => r.pass_template_id)
      )
    })()
    return () => { cancelled = true }
  }, [sessionId, sessionAccessMode, orgId, token, authedFetch])

  const passUsableForSession = useCallback((p: MemberPass): boolean => {
    if (p.status !== 'active' && p.status !== 'low') return false
    const s = occurrence?.session
    if (!s) return true
    if (s.booking_access_mode === 'restricted') {
      // Don't hide anything until the approved list has loaded.
      if (approvedPassTemplateIds === null) return true
      return approvedPassTemplateIds.includes(p.pass_template_id)
    }
    const t = p.pass_template
    if (t?.session_type_restriction?.length && !t.session_type_restriction.includes(s.session_type)) return false
    if (t?.delivery_mode_restriction?.length && !t.delivery_mode_restriction.includes(s.delivery_mode)) return false
    return true
  }, [occurrence?.session, approvedPassTemplateIds])

  const usablePasses = useMemo(
    () => memberPasses.filter(passUsableForSession),
    [memberPasses, passUsableForSession]
  )

  const loadOccurrence = useCallback(async (org: string, t: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/occurrences/${occurrenceId}`, {
      headers: { Authorization: `Bearer ${t}` }
    })
    if (res.status === 404) { setNotFound(true); return }
    if (res.ok) setOccurrence(await res.json())
  }, [occurrenceId])

  const refreshRoster = useCallback(async (org: string, t: string) => {
    setBookingsLoading(true)
    const [bookingsRes, waitlistRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/occurrences/${occurrenceId}/bookings`, {
        headers: { Authorization: `Bearer ${t}` }
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/occurrences/${occurrenceId}/waitlist`, {
        headers: { Authorization: `Bearer ${t}` }
      }),
    ])
    if (bookingsRes.ok) setBookings(await bookingsRes.json())
    if (waitlistRes.ok) setWaitlist(await waitlistRes.json())
    setBookingsLoading(false)
  }, [occurrenceId])

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const t = ctx.token
      setToken(t)
      const org = ctx.org
      setOrgId(org.id)
      const myRoles: string[] = ctx.roles
      setRoles(myRoles)

      if (!canViewBookings(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      await Promise.all([loadOccurrence(org.id, t), refreshRoster(org.id, t)])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const handleMarkAttended = async (bookingId: string) => {
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/attend`, { method: 'POST' })
    if (res.ok) await refreshRoster(orgId, token)
    else setManageError('Could not mark this booking attended.')
    setManageBusy(false)
  }

  const handleUnmarkAttended = async (bookingId: string) => {
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/unattend`, { method: 'POST' })
    if (res.ok) await refreshRoster(orgId, token)
    else setManageError('Could not undo attended for this booking.')
    setManageBusy(false)
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/cancel`, { method: 'POST' })
    if (res.ok) await refreshRoster(orgId, token)
    else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? 'Could not cancel this booking.')
    }
    setManageBusy(false)
  }

  const handleCancelGuest = async (bookingId: string, guestIndex: number, guestLabel: string) => {
    if (!confirm(`Cancel ${guestLabel}'s spot? The member's own booking stays confirmed.`)) return
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/guests/${guestIndex}/cancel`, { method: 'POST' })
    if (res.ok) await refreshRoster(orgId, token)
    else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? "Couldn't cancel this guest.")
    }
    setManageBusy(false)
  }

  const handleRefundCredit = async (b: Booking) => {
    if (!b.member_pass_id) return
    const credits = b.total_credits_used ?? 1
    const name = displayName(b.user) || b.member_name || 'this member'
    if (!confirm(`Refund ${credits} credit${credits > 1 ? 's' : ''} to ${name}'s pass? This booking's cancellation forfeited ${credits > 1 ? 'them' : 'it'} — this manually returns ${credits > 1 ? 'them' : 'it'} anyway.`)) return
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/member-passes/${b.member_pass_id}/adjust-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delta: credits,
        reason: 'Manual refund for a cancelled booking',
        booking_id: b.id,
      })
    })
    if (res.ok) await refreshRoster(orgId, token)
    else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? "Couldn't refund this credit.")
    }
    setManageBusy(false)
  }

  const openRefund = (b: Booking) => {
    setRefundTarget(b)
    setRefundAmount(b.amount_paid != null ? b.amount_paid.toString() : '')
    setRefundReason('')
    setRefundError('')
  }

  const handleIssueRefund = async () => {
    if (!refundTarget) return
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) { setRefundError('Enter a refund amount greater than zero.'); return }
    if (!refundReason.trim()) { setRefundError('A reason is required.'); return }

    setRefundBusy(true)
    setRefundError('')
    const res = await authedFetch(`/bookings/${refundTarget.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason: refundReason })
    })
    if (res.ok) {
      setRefundTarget(null)
      await refreshRoster(orgId, token)
    } else {
      const data = await res.json().catch(() => null)
      setRefundError(data?.error ?? 'Could not issue this refund.')
    }
    setRefundBusy(false)
  }

  const handleOccurrenceCancelled = async (updated: unknown) => {
    setOccurrence(updated as OccurrenceDetail)
    setShowCancelOccurrence(false)
    setActivityKey(k => k + 1)
    await refreshRoster(orgId, token)
  }

  const openEdit = async () => {
    if (!occurrence) return
    setEditError('')
    setEditForm({
      date: toDateInputValue(occurrence.starts_at),
      startTime: toTimeInputValue(occurrence.starts_at),
      endTime: toTimeInputValue(occurrence.ends_at),
      capacity: (occurrence.capacity ?? occurrence.session?.capacity ?? '')?.toString() ?? '',
      instructorId: occurrence.instructor_id ?? occurrence.session?.instructor_id ?? '',
    })
    setShowEdit(true)
    setTeachersLoading(true)
    const res = await authedFetch('/teachers')
    if (res.ok) setTeachers(await res.json())
    setTeachersLoading(false)
  }

  const handleSaveEdit = async () => {
    if (!occurrence) return
    if (!editForm.date || !editForm.startTime || !editForm.endTime) {
      setEditError('Date, start time, and end time are all required')
      return
    }
    const startsAt = new Date(`${editForm.date}T${editForm.startTime}`)
    const endsAt = new Date(`${editForm.date}T${editForm.endTime}`)
    if (endsAt <= startsAt) {
      setEditError('End time must be after the start time')
      return
    }

    setEditBusy(true)
    setEditError('')
    const res = await authedFetch(`/occurrences/${occurrence.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: editForm.capacity === '' ? null : parseInt(editForm.capacity),
        instructor_id: editForm.instructorId === '' ? null : editForm.instructorId,
        clear_instructor_id: editForm.instructorId === '',
      })
    })
    if (res.ok) {
      setOccurrence(await res.json())
      setShowEdit(false)
      setActivityKey(k => k + 1)
    } else {
      const data = await res.json().catch(() => null)
      setEditError(data?.error ?? 'Could not update this occurrence.')
    }
    setEditBusy(false)
  }

  const openAddBooking = async () => {
    setAddBookingError('')
    setAddForm({ userId: '', choice: '', compNote: '' })
    setMemberPasses([])
    setMemberSearch('')
    setShowAddBooking(true)
    setMembersLoading(true)
    const res = await authedFetch('/members')
    if (res.ok) setMembers(await res.json())
    setMembersLoading(false)
  }

  const selectMember = async (memberId: string) => {
    setAddForm(p => ({ ...p, userId: memberId, choice: '', compNote: '' }))
    if (!canManageBookings(roles)) return

    setPassesLoading(true)
    const res = await authedFetch(`/members/${memberId}/passes`)
    if (res.ok) {
      const all: MemberPass[] = await res.json()
      // Session eligibility is applied in `usablePasses`; store everything still live here.
      setMemberPasses(all.filter(p => p.status === 'active' || p.status === 'low'))
    }
    setPassesLoading(false)
  }

  const handleAddBooking = async () => {
    if (!occurrence) return
    if (!addForm.userId) { setAddBookingError('Select a member'); return }

    const useAddStudent = !canManageBookings(roles)
    const isFree = occurrence.session?.booking_access_mode === 'free'

    if (!useAddStudent && !isFree) {
      if (!addForm.choice) {
        setAddBookingError('Choose how this booking is paid for')
        return
      }
      if (addForm.choice === 'comp' && !addForm.compNote.trim()) {
        setAddBookingError('Add a reason for the comp')
        return
      }
    }

    setAddingBooking(true)
    setAddBookingError('')

    try {
      const paymentType = isFree ? 'free' : addForm.choice === 'comp' ? 'admin_waived' : 'pass'
      const memberPassId = paymentType === 'pass' ? addForm.choice : null

      const res = useAddStudent
        ? await authedFetch(`/occurrences/${occurrence.id}/add-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: addForm.userId,
            })
          })
        : await authedFetch('/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: addForm.userId,
              session_occurrence_id: occurrence.id,
              payment_type: paymentType,
              member_pass_id: memberPassId,
              reason: paymentType === 'admin_waived' ? addForm.compNote.trim() : null,
            })
          })

      if (res.ok) {
        setShowAddBooking(false)
        await refreshRoster(orgId, token)
      } else {
        const data = await res.json().catch(() => null)
        setAddBookingError(data?.error ?? 'Could not create this booking.')
      }
    } catch {
      setAddBookingError('Could not create this booking.')
    } finally {
      setAddingBooking(false)
    }
  }

  const filteredMembers = members.filter(m => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return true
    return displayName(m).toLowerCase().includes(q) || (m.email?.toLowerCase().includes(q) ?? false)
  })
  const selectedMember = members.find(m => m.id === addForm.userId)

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="schedule" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className={styles.shell}>
        <Sidebar active="schedule" roles={roles} />
        <div className={styles.main}><Forbidden /></div>
      </div>
    )
  }

  if (notFound || !occurrence) {
    return (
      <div className={styles.shell}>
        <Sidebar active="schedule" roles={roles} />
        <div className={styles.main}>
          <p style={{ color: '#666', fontSize: '14px' }}>This occurrence couldn't be found.</p>
        </div>
      </div>
    )
  }

  const session = occurrence.session
  const isRestricted = session?.booking_access_mode === 'restricted'
  const isFreeSession = session?.booking_access_mode === 'free'
  // Restricted only limits *self-service* booking to the approved pass templates — an admin/teacher
  // adding someone manually bypasses that list (BookingService.ValidateBookableAsync, §4.8).
  const { booked, capacity } = occupancy(occurrence, bookings)

  const bookedRows = bookings.filter(b => b.status === 'confirmed' || b.status === 'attended' || b.status === 'no_show')
  const cancelledRows = bookings.filter(b => b.status === 'cancelled' || b.status === 'late_cancel')
  const rowsForTab = tab === 'booked' ? bookedRows : cancelledRows

  // Guests cancelled one-by-one (admin per-guest cancel) — the owning booking is still Confirmed,
  // so it isn't in cancelledRows. Surface each here, tied back to its booking's member.
  const cancelledGuestEntries = bookings.flatMap(b =>
    (b.cancelled_guests ?? []).map(g => ({
      ...g,
      bookingId: b.id,
      memberName: displayName(b.user) || b.member_name || 'Unknown member',
    })))

  return (
    <div className={styles.shell}>
      <Sidebar active="schedule" roles={roles} />

      <div className={styles.main} style={{ maxWidth: '760px' }}>
        {/* Header */}
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
            cursor: 'pointer', color: '#666', fontSize: '13px', marginBottom: '16px', padding: 0
          }}
        >
          ← Back
        </button>

        <div style={{
          backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700 }}>{session?.name ?? 'Session'}</h1>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
                {formatDateWithWeekday(occurrence.starts_at)}
                {' • '}
                {new Date(occurrence.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {new Date(occurrence.ends_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                {session?.location_name && ` · ${session.location_name}`}
                {session?.delivery_mode && ` · ${session.delivery_mode.replace('_', ' ')}`}
              </div>
            </div>
            <OccurrenceStatusBadge status={occurrence.status} />
          </div>

          {/* Teacher */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f4f4f4' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Teacher
            </div>
            <div style={{ fontSize: '14px', color: '#1a1a1a' }}>
              {occurrence.instructor_name ?? 'Unassigned'}
            </div>
          </div>

          {manageError && (
            <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginTop: '16px' }}>
              {manageError}
            </div>
          )}

          {occurrence.status === 'scheduled' && (canManageBookings(roles) || canAddStudent(roles) || canManageOccurrences(roles)) && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
              {(canManageBookings(roles) || canAddStudent(roles)) && (
                <button onClick={openAddBooking} style={{
                  padding: '8px 16px', backgroundColor: '#085041', color: 'white', border: 'none',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}>
                  + Add {canManageBookings(roles) ? 'member' : 'student'}
                </button>
              )}
              {canManageOccurrences(roles) && (
                <button onClick={openEdit} style={secondaryButtonStyle}>
                  Edit
                </button>
              )}
              {canManageOccurrences(roles) && (
                <button onClick={() => setShowCancelOccurrence(true)} style={{
                  padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #fdecea',
                  borderRadius: '8px', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                }}>
                  Cancel occurrence
                </button>
              )}
            </div>
          )}
        </div>

        {/* Edit panel */}
        {showEdit && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Edit occurrence</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Start time</label>
                  <input type="time" value={editForm.startTime} onChange={e => setEditForm(p => ({ ...p, startTime: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End time</label>
                  <input type="time" value={editForm.endTime} onChange={e => setEditForm(p => ({ ...p, endTime: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Capacity</label>
                  <input type="number" min="0" placeholder="Unlimited" value={editForm.capacity}
                    onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Teacher</label>
                {teachersLoading ? (
                  <p style={{ fontSize: '13px', color: '#666' }}>Loading teachers...</p>
                ) : (
                  <select
                    value={editForm.instructorId}
                    onChange={e => setEditForm(p => ({ ...p, instructorId: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Unassigned</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{displayName(t)}</option>
                    ))}
                  </select>
                )}
              </div>

              {editError && (
                <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                  {editError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowEdit(false)} style={secondaryButtonStyle}>Cancel</button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editBusy}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: editBusy ? '#9fd6b8' : '#085041', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                    cursor: editBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {editBusy ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add booking panel */}
        {showAddBooking && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>
              {canManageBookings(roles) ? 'Add a member' : 'Add a student'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {isRestricted && (
                  <p style={{ fontSize: '12px', color: '#7a4f00', backgroundColor: '#fff3cd', borderRadius: '8px', padding: '8px 10px', margin: 0 }}>
                    This session is restricted for self-booking — adding a member here bypasses the approved-pass list.
                  </p>
                )}
                <div>
                  <label style={labelStyle}>Member</label>
                  {selectedMember ? (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', border: '1px solid #085041', borderRadius: '8px', backgroundColor: '#e8f5ee'
                    }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{displayName(selectedMember)}</div>
                        {selectedMember.email && <div style={{ fontSize: '12px', color: '#666' }}>{selectedMember.email}</div>}
                      </div>
                      <button
                        onClick={() => { setAddForm(p => ({ ...p, userId: '', choice: '', compNote: '' })); setMemberPasses([]) }}
                        style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666' }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder={members[0]?.email ? "Search members by name or email..." : "Search members by name..."}
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        style={inputStyle}
                      />
                      <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e2e2', borderRadius: '8px', marginTop: '8px' }}>
                        {membersLoading ? (
                          <div style={{ padding: '12px', fontSize: '13px', color: '#666' }}>Loading members...</div>
                        ) : filteredMembers.length === 0 ? (
                          <div style={{ padding: '12px', fontSize: '13px', color: '#666' }}>No members found</div>
                        ) : (
                          filteredMembers.map(m => (
                            <button
                              key={m.id}
                              onClick={() => selectMember(m.id)}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                                border: 'none', borderBottom: '1px solid #f4f4f4', backgroundColor: 'white', cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{displayName(m)}</div>
                              {m.email && <div style={{ fontSize: '12px', color: '#666' }}>{m.email}</div>}
                            </button>
                          ))
                        )}
                      </div>
                      {canAddMember(roles) && (
                        <button
                          onClick={() => setShowAddMember(true)}
                          style={{
                            marginTop: '8px', background: 'none', border: 'none', padding: 0,
                            color: '#085041', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          + Add a new member
                        </button>
                      )}
                    </>
                  )}
                </div>

                {!canManageBookings(roles) ? (
                  <p style={{ fontSize: '13px', color: '#666' }}>Added at no charge — payment isn't part of this action.</p>
                ) : isFreeSession ? (
                  <p style={{ fontSize: '13px', color: '#666' }}>This session is free — no payment required.</p>
                ) : addForm.userId ? (
                  <div>
                    <label style={labelStyle}>Payment</label>
                    {passesLoading ? (
                      <p style={{ fontSize: '13px', color: '#666' }}>Loading passes...</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {usablePasses.map(p => (
                          <label key={p.id} style={paymentChoiceRow(addForm.choice === p.id)}>
                            <input
                              type="radio"
                              name="add-payment"
                              checked={addForm.choice === p.id}
                              onChange={() => setAddForm(f => ({ ...f, choice: p.id }))}
                            />
                            <span style={{ fontSize: '13px' }}>
                              {p.pass_template?.name ?? 'Pass'}
                              <span style={{ color: '#666' }}>
                                {' · '}{p.credits_remaining === null ? 'unlimited' : `${p.credits_remaining}/${p.credits_total} credits`}
                                {' · expires '}{formatDate(p.expires_at)}
                              </span>
                            </span>
                          </label>
                        ))}
                        {usablePasses.length === 0 && (
                          <p style={{ fontSize: '12px', color: '#999', margin: '2px 0' }}>
                            {memberPasses.length > 0
                              ? 'No pass valid for this session — comp it below.'
                              : 'This member has no usable passes — comp it below.'}
                          </p>
                        )}

                        <label style={paymentChoiceRow(addForm.choice === 'comp')}>
                          <input
                            type="radio"
                            name="add-payment"
                            checked={addForm.choice === 'comp'}
                            onChange={() => setAddForm(f => ({ ...f, choice: 'comp' }))}
                          />
                          <span style={{ fontSize: '13px' }}>Comp (no charge)</span>
                        </label>
                        {addForm.choice === 'comp' && (
                          <input
                            type="text"
                            placeholder="Reason for the comp — e.g. makeup class, staff comp"
                            value={addForm.compNote}
                            onChange={e => setAddForm(f => ({ ...f, compNote: e.target.value }))}
                            style={{ ...inputStyle, marginLeft: '26px', width: 'calc(100% - 26px)' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {addBookingError && (
                  <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                    {addBookingError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowAddBooking(false)} style={secondaryButtonStyle}>Cancel</button>
                  <button
                    onClick={handleAddBooking}
                    disabled={addingBooking}
                    style={{
                      flex: 1, padding: '10px', backgroundColor: addingBooking ? '#9fd6b8' : '#085041', color: 'white',
                      border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                      cursor: addingBooking ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {addingBooking ? 'Adding...' : (canManageBookings(roles) ? 'Confirm booking' : 'Add student')}
                  </button>
                </div>
            </div>
          </div>
        )}

        {showAddMember && (
          <AddMemberModal
            orgId={orgId}
            token={token}
            onClose={() => setShowAddMember(false)}
            onCreated={m => {
              setShowAddMember(false)
              setMembers(prev => [...prev, { id: m.id, first_name: m.first_name, last_name: m.last_name }])
              setMemberSearch('')
              selectMember(m.id)
            }}
          />
        )}

        {showCancelOccurrence && (
          <CancelOccurrenceModal
            occurrenceId={occurrence.id}
            orgId={orgId}
            token={token}
            onClose={() => setShowCancelOccurrence(false)}
            onCancelled={handleOccurrenceCancelled}
          />
        )}

        {/* Tabs + roster */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '24px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e2e2', marginBottom: '16px' }}>
            <button style={tabStyle(tab === 'booked')} onClick={() => setTab('booked')}>
              Booked ({capacity === null ? booked : `${booked}/${capacity}`})
            </button>
            <button style={tabStyle(tab === 'waitlist')} onClick={() => setTab('waitlist')}>
              On waitlist ({waitlist.length})
            </button>
            <button style={tabStyle(tab === 'cancelled')} onClick={() => setTab('cancelled')}>
              Cancelled ({cancelledRows.length})
            </button>
          </div>

          {bookingsLoading ? (
            <p style={{ fontSize: '13px', color: '#666' }}>Loading...</p>
          ) : tab === 'waitlist' ? (
            waitlist.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666' }}>No one on the waitlist.</p>
            ) : (
              <div>
                {waitlist.map((w, i) => (
                  <div key={w.id} style={{
                    padding: '10px 0', borderBottom: i < waitlist.length - 1 ? '1px solid #f4f4f4' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{w.member_name || 'Unknown member'}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {w.email && `${w.email} · `}{w.preferred_mode.replace('_', ' ')}
                          {w.intended_guest_count > 0 && ` · +${w.intended_guest_count} guest${w.intended_guest_count > 1 ? 's' : ''}`}
                          {w.status === 'waiting' && ` · #${w.position} in line`}
                        </div>
                        {w.status === 'promoted' && (
                          <div style={{ fontSize: '12px', color: '#7a4f00', marginTop: '2px' }}>
                            {w.is_fast_track ? 'Fast-track blast' : 'Holding a spot'}
                            {w.hold_expires_at && ` · expires ${formatWhen(w.hold_expires_at)}`}
                          </div>
                        )}
                      </div>
                      <WaitlistStatusBadge status={w.status} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (rowsForTab.length === 0 && (tab !== 'cancelled' || cancelledGuestEntries.length === 0)) ? (
            <p style={{ fontSize: '13px', color: '#666' }}>
              {tab === 'booked' ? "No one's booked in yet." : 'No cancellations.'}
            </p>
          ) : (
            <div>
              {rowsForTab.map((b, i) => {
                const guests = parseGuests(b)
                return (
                  <div key={b.id} style={{
                    padding: '10px 0', borderBottom: i < rowsForTab.length - 1 ? '1px solid #f4f4f4' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>
                          {canViewMembers(roles) && b.user_id ? (
                            <a href={`/dashboard/members/${b.user_id}`} style={{ color: '#085041', textDecoration: 'none' }}>
                              {displayName(b.user) || b.member_name || 'Unknown member'}
                            </a>
                          ) : (
                            displayName(b.user) || b.member_name || 'Unknown member'
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {b.user?.email && `${b.user.email} · `}{b.booked_mode.replace('_', ' ')}
                          {b.payment_type && ` · ${paymentTypeLabels[b.payment_type] ?? b.payment_type}`}
                          {!!b.guest_count && ` · +${b.guest_count} guest${b.guest_count > 1 ? 's' : ''}`}
                        </div>
                        {b.payment_type === 'admin_waived' && b.comp_reason && (
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                            Comp: {b.comp_reason}{b.comp_added_by_name ? ` — ${b.comp_added_by_name}` : ''}
                          </div>
                        )}
                        {(b.status === 'cancelled' || b.status === 'late_cancel') && cancellationHistory(b).map((line, li) => (
                          <div key={li} style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                            {line}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* confirmed/attended/no_show are all implied here — which tab the row is in, and
                            the Attended checkbox's own state, already say it; a badge would be noise. */}
                        {!['confirmed', 'attended', 'no_show'].includes(b.status) && <BookingStatusBadge status={b.status} />}
                        {(b.status === 'cancelled' || b.status === 'late_cancel') && !b.credits_refunded
                          && b.payment_type === 'pass' && b.member_pass_id && canManageBookings(roles) && (
                          <button onClick={() => handleRefundCredit(b)} disabled={manageBusy} style={{
                            padding: '5px 10px', backgroundColor: 'transparent', border: '1px solid #e2e2e2', borderRadius: '6px',
                            fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500
                          }}>
                            Refund credit
                          </button>
                        )}
                        {(b.status === 'confirmed' || b.status === 'attended') && canMarkAttended(roles) && (
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px',
                            color: '#444', fontWeight: 500, cursor: manageBusy ? 'not-allowed' : 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={b.status === 'attended'}
                              disabled={manageBusy}
                              onChange={() => b.status === 'attended' ? handleUnmarkAttended(b.id) : handleMarkAttended(b.id)}
                            />
                            Attended
                          </label>
                        )}
                        {b.status === 'confirmed' && canManageBookings(roles) && (
                          <button onClick={() => handleCancelBooking(b.id)} disabled={manageBusy} style={{
                            padding: '5px 10px', backgroundColor: 'transparent', border: '1px solid #fdecea', borderRadius: '6px',
                            fontSize: '11px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                          }}>
                            Cancel
                          </button>
                        )}
                        {b.payment_type === 'card' && canManageBookings(roles) && (
                          <button onClick={() => openRefund(b)} disabled={manageBusy} style={{
                            padding: '5px 10px', backgroundColor: 'transparent', border: '1px solid #e2e2e2', borderRadius: '6px',
                            fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500
                          }}>
                            Refund
                          </button>
                        )}
                      </div>
                    </div>

                    {guests.length > 0 && (
                      <div style={{ marginTop: '8px', paddingLeft: '14px', borderLeft: '2px solid #f4f4f4' }}>
                        {guests.map((g, gi) => {
                          const guestLabel = [g.first_name, g.last_name].filter(Boolean).join(' ') || `Guest ${gi + 1}`
                          return (
                            <div key={gi} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px'
                            }}>
                              <div style={{ color: g.status === 'cancelled' ? '#999' : '#666' }}>
                                {guestLabel}{g.status === 'cancelled' && ' · Cancelled'}
                              </div>
                              {g.status === 'confirmed' && b.status === 'confirmed' && canManageBookings(roles) && (
                                <button onClick={() => handleCancelGuest(b.id, gi, guestLabel)} disabled={manageBusy} style={{
                                  padding: '3px 8px', backgroundColor: 'transparent', border: '1px solid #fdecea', borderRadius: '5px',
                                  fontSize: '10px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                                }}>
                                  Cancel
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {tab === 'cancelled' && cancelledGuestEntries.length > 0 && (
                <div style={{ marginTop: rowsForTab.length > 0 ? '18px' : '0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Cancelled guests
                  </div>
                  {cancelledGuestEntries.map((g, i) => (
                    <div key={`${g.bookingId}-${i}`} style={{
                      padding: '10px 0', borderBottom: i < cancelledGuestEntries.length - 1 ? '1px solid #f4f4f4' : 'none'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Guest of {g.memberName}</div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                        Cancelled{g.cancelled_at ? ` ${formatWhen(g.cancelled_at)}` : ''}
                        {g.cancelled_by_name ? ` by ${g.cancelled_by_name}` : ''}
                        {g.credits_refunded > 0 ? ` · ${g.credits_refunded} credit${g.credits_refunded > 1 ? 's' : ''} refunded` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <EntityActivity orgId={orgId} token={token} entityType="session_occurrence" entityId={occurrence.id} noun="occurrence" refreshKey={activityKey} />
      </div>

      {/* Refund modal */}
      {refundTarget && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
            maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Issue refund</h2>
              <button
                onClick={() => setRefundTarget(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              {displayName(refundTarget.user) || refundTarget.member_name || 'This member'} paid{' '}
              {refundTarget.amount_paid != null
                ? formatMoney(refundTarget.amount_paid, refundTarget.currency ?? 'AUD')
                : 'by card'} for this booking. Partial refunds are allowed; the amount can't exceed what's left unrefunded.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Refund amount</label>
                <input
                  type="number" min="0" step="0.01"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Reason</label>
                <textarea
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Goodwill refund for a late cancellation"
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              {refundError && (
                <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                  {refundError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={() => setRefundTarget(null)} style={{ ...secondaryButtonStyle, flex: 1 }}>
                  Cancel
                </button>
                <button
                  onClick={handleIssueRefund}
                  disabled={refundBusy}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: refundBusy ? '#9fd6b8' : '#085041', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                    cursor: refundBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {refundBusy ? 'Issuing...' : 'Issue refund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
