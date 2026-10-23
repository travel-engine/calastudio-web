'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Check, Download, Plus, UserPlus, X } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewBookings, canManageBookings, canManageOccurrences, canMarkAttended, canAddStudent, canAddMember, canViewMembers } from '@/lib/roles'
import { displayName, teacherName } from '@/lib/names'
import AddMemberModal from '@/app/components/AddMemberModal'
import CancelOccurrenceModal from '@/app/components/CancelOccurrenceModal'
import EntityActivity from '@/app/components/EntityActivity'
import { dayKey, formatClock, formatShortDate } from '@/lib/dates'
import { color, font, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Button, Card, Chip, EmptyState, PageHeader, buttonStyle, controlStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
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
  instructor_name: string | null // the effective teacher: this class's own, else the session's; null = nobody
  no_instructor?: boolean // explicitly "No teacher" for this class, regardless of the session's teacher
  session: SessionDetail | null
}

// Teacher choice in the edit form: a teacher's id, nobody, or follow whoever teaches the session.
const NO_TEACHER = ''
const SAME_AS_SESSION = 'session'

interface Teacher {
  id: string
  first_name: string
  last_name: string
  profile?: { display_name?: string | null } | null
}

function sessionTeacherName(teachers: Teacher[], id: string | null | undefined) {
  if (!id) return 'no teacher'
  return teacherName(teachers.find(x => x.id === id)) || 'its teacher'
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
  // 'attended' once checked in on their own (each guest is checked in separately from the member).
  // No-show isn't stored: a guest still 'confirmed' after the class is one.
  status: 'confirmed' | 'attended' | 'cancelled'
  attended_at?: string | null
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
  attended_at?: string | null
  // Against the studio's live waiver version (roster endpoint). Absent when the studio has none.
  waiver_status?: 'current' | 'outdated' | 'not_signed' | null
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

// "Sat 17 Oct, 7:02 am" — history lines (cancellations, refunds, waitlist holds).
function formatWhen(iso: string) {
  return `${formatShortDate(iso)}, ${formatClock(iso)}`
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

// Status words carry the meaning; the tone reinforces it (handoff §4: never colour-only).
const occurrenceStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  scheduled: { label: 'Scheduled', tone: 'primary' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'neutral' },
}

const bookingStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  confirmed: { label: 'Booked', tone: 'info' },
  attended: { label: 'Attended', tone: 'primary' },
  no_show: { label: 'No show', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  late_cancel: { label: 'Late cancel', tone: 'warn' },
  waitlisted: { label: 'Waitlisted', tone: 'info' },
}

const waiverChip: Record<string, { label: string; tone: ChipTone }> = {
  current: { label: 'Up to date', tone: 'primary' },
  outdated: { label: 'Outdated', tone: 'warn' },
  not_signed: { label: 'Not signed', tone: 'danger' },
}

const waitlistStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  waiting: { label: 'Waiting', tone: 'warn' },
  promoted: { label: 'Spot held', tone: 'primary' },
  booked: { label: 'Booked', tone: 'primary' },
  expired: { label: 'Expired', tone: 'neutral' },
  removed: { label: 'Left', tone: 'neutral' },
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

const paymentTypeLabels: Record<string, string> = {
  card: 'Card',
  pass: 'Pass',
  membership: 'Membership',
  admin_waived: 'Comped',
  free: 'Free',
}

const inputStyle: React.CSSProperties = { ...controlStyle, padding: '10px 12px' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: color.ink, padding: 0 }
const paymentChoiceRow = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', minHeight: space.target, cursor: 'pointer', boxSizing: 'border-box',
  border: `1px solid ${active ? color.primary : color.control}`, borderRadius: radius.control,
  background: active ? color.primarySoft : color.surface,
})
const tabStyle = (active: boolean): React.CSSProperties => ({
  minHeight: space.target, padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 15, fontWeight: 600, color: active ? color.primaryInk : color.muted, marginBottom: -1,
  borderBottom: active ? `2px solid ${color.primary}` : '2px solid transparent',
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
  const [timeZone, setTimeZone] = useState<string | null>(null)

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
      setTimeZone(org.timezone ?? null)
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
    else {
      // Show the API's reason (e.g. check-in isn't open yet for a future class).
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? "Couldn't check in this member.")
    }
    setManageBusy(false)
  }

  // Per-guest check-in, mirroring per-guest cancel: guests are addressed by their index on the booking.
  const handleGuestAttendance = async (bookingId: string, guestIndex: number, attend: boolean) => {
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/guests/${guestIndex}/${attend ? 'attend' : 'unattend'}`, { method: 'POST' })
    if (res.ok) await refreshRoster(orgId, token)
    else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? (attend ? "Couldn't check in this guest." : "Couldn't undo this guest's check-in."))
    }
    setManageBusy(false)
  }

  const handleUnmarkAttended = async (bookingId: string) => {
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/unattend`, { method: 'POST' })
    if (res.ok) await refreshRoster(orgId, token)
    else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? "Couldn't undo this check-in.")
    }
    setManageBusy(false)
  }

  const handleCancelBooking = async (b: Booking) => {
    // Guests ride on the member's booking, so they go with it; say so before confirming.
    const activeGuests = parseGuests(b).filter(g => g.status !== 'cancelled').length
    const guestNote = activeGuests === 0 ? '' : ` Their ${activeGuests === 1 ? 'guest' : `${activeGuests} guests`} will be cancelled too.`
    if (!confirm(`Cancel ${memberName(b)}'s booking?${guestNote}`)) return
    const bookingId = b.id
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
      instructorId: occurrence.no_instructor ? NO_TEACHER : occurrence.instructor_id ?? SAME_AS_SESSION,
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
        ...(editForm.instructorId === NO_TEACHER ? { clear_instructor_id: true }
          : editForm.instructorId === SAME_AS_SESSION ? { use_session_instructor: true }
            : { instructor_id: editForm.instructorId }),
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
          <div style={{ color: color.muted }}>Loading…</div>
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
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <Breadcrumb items={[{ label: 'Schedule', href: '/dashboard/schedule' }, { label: 'Class not found' }]} />
            <Card><EmptyState message="This class couldn't be found. It may have been removed." action={<Button href="/dashboard/schedule">Back to schedule</Button>} /></Card>
          </div>
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

  // No-show is derived, never stored (04-booking-flow §4.5a): still 'confirmed' after the class.
  // The API counts from the start; the roster labels it only once the class has ended, so
  // latecomers being checked in mid-class aren't tagged.
  const classEnded = new Date(occurrence.ends_at).getTime() <= Date.now()
  const bookedRows = bookings.filter(b => b.status === 'confirmed' || b.status === 'attended' || b.status === 'no_show')
  const cancelledRows = bookings.filter(b => b.status === 'cancelled' || b.status === 'late_cancel')

  // Guests cancelled one-by-one (admin per-guest cancel) — the owning booking is still Confirmed,
  // so it isn't in cancelledRows. Surface each here, tied back to its booking's member.
  const cancelledGuestEntries = bookings.flatMap(b =>
    (b.cancelled_guests ?? []).map(g => ({
      ...g,
      bookingId: b.id,
      memberName: displayName(b.user) || b.member_name || 'Unknown member',
    })))

  const canAdd = occurrence.status === 'scheduled' && (canManageBookings(roles) || canAddStudent(roles))
  const statusChip = occurrenceStatusChip[occurrence.status] ?? { label: occurrence.status, tone: 'neutral' as const }
  const dateLabel = formatShortDate(occurrence.starts_at, timeZone)
  const memberName = (b: Booking) => displayName(b.user) || b.member_name || 'Unknown member'

  // A printable sign-in sheet: the booked list as CSV (names, payment, guests, status).
  const exportSignInSheet = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = [['Name', 'Pass / payment', 'Guests', 'Status', 'Signed in'].map(esc).join(',')]
    for (const b of bookedRows) {
      const guests = parseGuests(b).filter(g => g.status !== 'cancelled')
        .map((g, i) => [g.first_name, g.last_name].filter(Boolean).join(' ') || `Guest ${i + 1}`).join('; ')
      lines.push([
        memberName(b),
        b.payment_type ? (paymentTypeLabels[b.payment_type] ?? b.payment_type) : '',
        guests,
        bookingStatusChip[b.status]?.label ?? b.status,
        '',
      ].map(esc).join(','))
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(session?.name ?? 'class').replace(/[^\w-]+/g, '-')}-${dayKey(occurrence.starts_at, timeZone)}-sign-in.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: color.muted, background: '#FAFAF8', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = { padding: '12px 16px', borderTop: `1px solid ${color.divider}`, verticalAlign: 'middle', fontSize: 15 }
  const smallAction = { ...buttonStyle('secondary', 'sm') }
  const smallDanger = { ...buttonStyle('destructive', 'sm') }

  const nameCell = (b: Booking, note?: React.ReactNode) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden style={{
        width: 36, height: 36, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: color.primarySoft, color: color.primaryInk, fontWeight: 600, fontSize: 13,
      }}>{initials(memberName(b))}</span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        {canViewMembers(roles) && b.user_id ? (
          <Link href={`/dashboard/members/${b.user_id}`} className={ui.focusable} style={{ fontWeight: 600, color: color.ink, textDecoration: 'none' }}>{memberName(b)}</Link>
        ) : (
          <span style={{ fontWeight: 600 }}>{memberName(b)}</span>
        )}
        <span style={{ fontSize: 13, color: color.muted }}>
          {b.user?.email ? `${b.user.email} · ` : ''}{b.booked_mode === 'online' ? 'Online' : 'In person'}
        </span>
        {note}
      </span>
    </div>
  )

  const paymentCell = (b: Booking) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: color.ink2 }}>
      <span>
        {b.payment_type ? (paymentTypeLabels[b.payment_type] ?? b.payment_type) : '—'}
        {b.payment_type === 'card' && b.amount_paid != null ? ` · ${formatMoney(b.amount_paid, b.currency ?? 'AUD')}` : ''}
      </span>
      {b.payment_type === 'admin_waived' && b.comp_reason && (
        <span style={{ fontSize: 13, color: color.muted }}>{b.comp_reason}{b.comp_added_by_name ? ` · ${b.comp_added_by_name}` : ''}</span>
      )}
    </div>
  )

  return (
    <div className={styles.shell}>
      <Sidebar active="schedule" roles={roles} />

      <div className={styles.main}>
        <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <Breadcrumb items={[{ label: 'Schedule', href: '/dashboard/schedule' }, { label: dateLabel }]} />

          <PageHeader
            title={session?.name ?? 'Session'}
            actions={<>
              {occurrence.status === 'scheduled' && canManageOccurrences(roles) && (
                <Button variant="destructive" onClick={() => setShowCancelOccurrence(true)}>Cancel class</Button>
              )}
              {occurrence.status === 'scheduled' && canManageOccurrences(roles) && (
                <Button onClick={openEdit}>Edit class</Button>
              )}
              {/* Icon-only with a tooltip; desktop only (a CSV download isn't much use on a phone). */}
              {bookedRows.length > 0 && (
                <span className={`${styles.desktopOnly} ${styles.tip}`} data-tip="Export sign-in sheet (CSV)">
                  <Button onClick={exportSignInSheet} icon={<Download size={18} strokeWidth={1.8} aria-hidden />} style={{ width: 44, padding: 0 }}>
                    <span className={styles.srOnly}>Export sign-in sheet</span>
                  </Button>
                </span>
              )}
              {canAdd && (
                <Button variant="primary" onClick={openAddBooking} icon={<Plus size={18} strokeWidth={2} aria-hidden />}>Add member</Button>
              )}
            </>}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <Chip tone={statusChip.tone}>{statusChip.label}</Chip>
              <Chip>{dateLabel} · {formatClock(occurrence.starts_at, timeZone)} – {formatClock(occurrence.ends_at, timeZone)}</Chip>
              {session?.location_name && <Chip>{session.location_name}</Chip>}
              {occurrence.instructor_name ? <Chip>{occurrence.instructor_name}</Chip> : <Chip tone="warn">No teacher assigned</Chip>}
              {session?.delivery_mode && <Chip>{session.delivery_mode === 'online' ? 'Online' : 'In person'}</Chip>}
            </div>
          </PageHeader>

          {/* A teacher still sees a "no teacher" class of their own session (spec §17.8) — make sure
              they don't read that as being down to teach it. */}
          {occurrence.instructor_name == null && !canManageOccurrences(roles) && occurrence.status === 'scheduled' && (
            <div role="status" style={{ padding: '12px 16px', background: color.warnBg, borderRadius: radius.control, color: color.warnInk, fontSize: 15, lineHeight: 1.45 }}>
              <strong>No teacher is assigned to this class.</strong> You can see it because you teach this session, but you&apos;re not down to teach this date unless the studio assigns you.
            </div>
          )}

          {manageError && (
            <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>
              {manageError}
            </div>
          )}

          {/* Edit panel */}
          {showEdit && (
            <Card padded aria-labelledby="edit-class-heading">
              <h2 id="edit-class-heading" style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>Edit this class</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
                <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="edit-date" style={labelStyle}>Date</label>
                    <input id="edit-date" type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="edit-start" style={labelStyle}>Start time</label>
                    <input id="edit-start" type="time" value={editForm.startTime} onChange={e => setEditForm(p => ({ ...p, startTime: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="edit-end" style={labelStyle}>End time</label>
                    <input id="edit-end" type="time" value={editForm.endTime} onChange={e => setEditForm(p => ({ ...p, endTime: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="edit-capacity" style={labelStyle}>Capacity</label>
                    <input id="edit-capacity" type="number" min="0" placeholder="Unlimited" value={editForm.capacity}
                      onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="edit-teacher" style={labelStyle}>Teacher</label>
                    {teachersLoading ? (
                      <p style={{ margin: 0, fontSize: 15, color: color.muted }}>Loading teachers…</p>
                    ) : (
                      <select id="edit-teacher" value={editForm.instructorId} onChange={e => setEditForm(p => ({ ...p, instructorId: e.target.value }))} style={inputStyle}>
                        <option value={SAME_AS_SESSION}>Same as session ({sessionTeacherName(teachers, occurrence?.session?.instructor_id)})</option>
                        <option value={NO_TEACHER}>No teacher</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{teacherName(t)}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                {editError && (
                  <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{editError}</div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <Button onClick={() => setShowEdit(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handleSaveEdit} disabled={editBusy}>{editBusy ? 'Saving…' : 'Save changes'}</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Add booking panel */}
          {showAddBooking && (
            <Card padded aria-labelledby="add-booking-heading">
              <h2 id="add-booking-heading" style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
                {canManageBookings(roles) ? 'Add a member' : 'Add a student'}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
                {isRestricted && (
                  <p style={{ margin: 0, fontSize: 14, color: color.warnInk, background: color.warnBg, borderRadius: radius.control, padding: '10px 12px' }}>
                    This class is restricted for self-booking. Adding someone here bypasses the approved-pass list.
                  </p>
                )}
                <div>
                  <label htmlFor="add-member-search" style={labelStyle}>Member</label>
                  {selectedMember ? (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      padding: '10px 14px', border: `1px solid ${color.primary}`, borderRadius: radius.control, background: color.primarySoft,
                    }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{displayName(selectedMember)}</div>
                        {selectedMember.email && <div style={{ fontSize: 13, color: color.muted }}>{selectedMember.email}</div>}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${displayName(selectedMember)}`}
                        onClick={() => { setAddForm(p => ({ ...p, userId: '', choice: '', compNote: '' })); setMemberPasses([]) }}
                        className={ui.focusable}
                        style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}
                      >
                        <X size={16} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        id="add-member-search"
                        type="search"
                        placeholder={members[0]?.email ? 'Search members by name or email' : 'Search members by name'}
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        style={inputStyle}
                      />
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${color.border}`, borderRadius: radius.control, marginTop: 8 }}>
                        {membersLoading ? (
                          <div style={{ padding: 12, fontSize: 14, color: color.muted }}>Loading members…</div>
                        ) : filteredMembers.length === 0 ? (
                          <div style={{ padding: 12, fontSize: 14, color: color.muted }}>No members found</div>
                        ) : (
                          filteredMembers.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => selectMember(m.id)}
                              className={`${ui.rowLink} ${ui.focusable}`}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', minHeight: space.target,
                                border: 'none', borderBottom: `1px solid ${color.divider}`, background: color.surface, cursor: 'pointer',
                                fontFamily: 'inherit', ['--hover-bg' as string]: '#F7F8F5',
                              }}
                            >
                              <div style={{ fontSize: 15, fontWeight: 600, color: color.ink }}>{displayName(m)}</div>
                              {m.email && <div style={{ fontSize: 13, color: color.muted }}>{m.email}</div>}
                            </button>
                          ))
                        )}
                      </div>
                      {canAddMember(roles) && (
                        <button
                          type="button"
                          onClick={() => setShowAddMember(true)}
                          className={ui.focusable}
                          style={{ marginTop: 8, background: 'none', border: 'none', padding: '6px 0', color: color.primary, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          + Add a new member
                        </button>
                      )}
                    </>
                  )}
                </div>

                {!canManageBookings(roles) ? (
                  <p style={{ margin: 0, fontSize: 15, color: color.muted }}>Added at no charge. Payment isn&apos;t part of this action.</p>
                ) : isFreeSession ? (
                  <p style={{ margin: 0, fontSize: 15, color: color.muted }}>This class is free. No payment required.</p>
                ) : addForm.userId ? (
                  <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                    <legend style={labelStyle}>Payment</legend>
                    {passesLoading ? (
                      <p style={{ margin: 0, fontSize: 15, color: color.muted }}>Loading passes…</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {usablePasses.map(p => (
                          <label key={p.id} style={paymentChoiceRow(addForm.choice === p.id)}>
                            <input type="radio" name="add-payment" checked={addForm.choice === p.id} onChange={() => setAddForm(f => ({ ...f, choice: p.id }))} />
                            <span style={{ fontSize: 15 }}>
                              {p.pass_template?.name ?? 'Pass'}
                              <span style={{ color: color.muted }}>
                                {' · '}{p.credits_remaining === null ? 'unlimited' : `${p.credits_remaining} of ${p.credits_total} credits`}
                                {' · expires '}{formatShortDate(p.expires_at, timeZone)}
                              </span>
                            </span>
                          </label>
                        ))}
                        {usablePasses.length === 0 && (
                          <p style={{ fontSize: 14, color: color.muted, margin: '2px 0' }}>
                            {memberPasses.length > 0 ? 'No pass is valid for this class. Comp it below.' : 'This member has no usable passes. Comp it below.'}
                          </p>
                        )}
                        <label style={paymentChoiceRow(addForm.choice === 'comp')}>
                          <input type="radio" name="add-payment" checked={addForm.choice === 'comp'} onChange={() => setAddForm(f => ({ ...f, choice: 'comp' }))} />
                          <span style={{ fontSize: 15 }}>Comp (no charge)</span>
                        </label>
                        {addForm.choice === 'comp' && (
                          <input
                            type="text"
                            aria-label="Reason for the comp"
                            placeholder="Reason for the comp, e.g. makeup class, staff comp"
                            value={addForm.compNote}
                            onChange={e => setAddForm(f => ({ ...f, compNote: e.target.value }))}
                            style={{ ...inputStyle, marginLeft: 26, width: 'calc(100% - 26px)' }}
                          />
                        )}
                      </div>
                    )}
                  </fieldset>
                ) : null}

                {addBookingError && (
                  <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{addBookingError}</div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <Button onClick={() => setShowAddBooking(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handleAddBooking} disabled={addingBooking}>
                    {addingBooking ? 'Adding…' : (canManageBookings(roles) ? 'Confirm booking' : 'Add student')}
                  </Button>
                </div>
              </div>
            </Card>
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
          <Card style={{ overflow: 'hidden' }} aria-label="Roster">
            <div role="tablist" aria-label="Roster" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px 0', borderBottom: `1px solid ${color.border}` }}>
              {([
                ['booked', `Booked (${capacity === null ? booked : `${booked}/${capacity}`})`],
                ['waitlist', `Waitlist (${waitlist.length})`],
                ['cancelled', `Cancelled (${cancelledRows.length})`],
              ] as [Tab, string][]).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={ui.focusable} style={tabStyle(tab === key)}>
                  {label}
                </button>
              ))}
            </div>

            {bookingsLoading ? (
              <p style={{ margin: 0, padding: 20, fontSize: 15, color: color.muted }}>Loading…</p>
            ) : tab === 'waitlist' ? (
              waitlist.length === 0 ? (
                <EmptyState message="No one is on the waitlist." />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Name</th><th style={th}>Wants</th><th style={th}>Place</th><th style={th}>Status</th></tr></thead>
                    <tbody>
                      {waitlist.map(w => {
                        const s = waitlistStatusChip[w.status] ?? { label: w.status, tone: 'neutral' as const }
                        return (
                          <tr key={w.id}>
                            <td style={td}>
                              <span style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600 }}>{w.member_name || 'Unknown member'}</span>
                                {w.email && <span style={{ fontSize: 13, color: color.muted }}>{w.email}</span>}
                              </span>
                            </td>
                            <td style={{ ...td, color: color.ink2 }}>
                              {w.preferred_mode === 'online' ? 'Online' : 'In person'}
                              {w.intended_guest_count > 0 && ` · +${w.intended_guest_count} guest${w.intended_guest_count > 1 ? 's' : ''}`}
                            </td>
                            <td style={{ ...td, ...tabularNums }}>{w.status === 'waiting' ? `#${w.position}` : '—'}</td>
                            <td style={td}>
                              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                <Chip tone={s.tone}>{s.label}</Chip>
                                {w.status === 'promoted' && (
                                  <span style={{ fontSize: 13, color: color.warnInk }}>
                                    {w.is_fast_track ? 'Fast-track blast' : 'Holding a spot'}
                                    {w.hold_expires_at && ` · until ${formatWhen(w.hold_expires_at)}`}
                                  </span>
                                )}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : tab === 'booked' ? (
              bookedRows.length === 0 ? (
                <EmptyState
                  icon={<UserPlus size={22} strokeWidth={1.8} />}
                  message="No one's booked yet."
                  action={canAdd ? <Button variant="primary" onClick={openAddBooking}>Add member</Button> : undefined}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Name</th><th style={th}>Pass / payment</th><th style={th}>Guests</th>
                        <th style={th}><span className={styles.srOnly}>Actions</span></th>
                        <th style={{ ...th, textAlign: 'right' }}>Check-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookedRows.map(b => {
                        const guests = parseGuests(b)
                        // Waiver: only flagged when it needs sorting; up to date is the norm, so it says nothing.
                        const waiver = b.waiver_status && b.waiver_status !== 'current' ? waiverChip[b.waiver_status] : null
                        return (
                          <tr key={b.id}>
                            <td style={td}>{nameCell(b, waiver && <span style={{ marginTop: 4 }}><Chip tone={waiver.tone}>Waiver {waiver.label.toLowerCase()}</Chip></span>)}</td>
                            <td style={td}>{paymentCell(b)}</td>
                            <td style={td}>
                              {guests.length === 0 ? <span style={{ color: '#8A918D' }}>—</span> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
                                  {guests.map((g, gi) => {
                                    const guestLabel = [g.first_name, g.last_name].filter(Boolean).join(' ') || `Guest ${gi + 1}`
                                    const cancelled = g.status === 'cancelled'
                                    return (
                                      <span key={gi} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={cancelled ? { textDecoration: 'line-through', color: color.muted } : undefined}>{guestLabel}</span>
                                        {cancelled && <span style={{ fontSize: 13, color: color.muted }}>cancelled</span>}
                                        {g.status === 'confirmed' && classEnded && <span style={{ fontSize: 13, color: color.muted }}>no-show</span>}
                                        {/* Check-in per guest: a guest can arrive without the member, and vice versa. */}
                                        {/* Stays after class on a no-show, to correct a forgotten check-in. */}
                                        {g.status === 'confirmed' && canMarkAttended(roles) && (
                                          <button type="button" onClick={() => handleGuestAttendance(b.id, gi, true)} disabled={manageBusy}
                                            aria-label={`Check in guest ${guestLabel}`} className={`${ui.button} ${ui.focusable}`} style={smallAction}>
                                            Check in
                                          </button>
                                        )}
                                        {g.status === 'attended' && canMarkAttended(roles) && (
                                          <button type="button" onClick={() => handleGuestAttendance(b.id, gi, false)} disabled={manageBusy}
                                            aria-label={`Undo check-in for guest ${guestLabel}`} className={ui.focusable}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32, padding: '0 6px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: color.primaryInk, cursor: manageBusy ? 'not-allowed' : 'pointer' }}>
                                            <Check size={14} strokeWidth={2.5} aria-hidden />
                                            <span style={tabularNums}>{g.attended_at ? formatClock(g.attended_at, timeZone) : 'Checked in'}</span>
                                          </button>
                                        )}
                                        {g.status === 'confirmed' && b.status === 'confirmed' && canManageBookings(roles) && (
                                          <button type="button" onClick={() => handleCancelGuest(b.id, gi, guestLabel)} disabled={manageBusy}
                                            aria-label={`Cancel guest ${guestLabel}`} className={ui.focusable}
                                            style={{ background: 'none', border: 0, padding: '4px 0', color: color.dangerInk, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                            Cancel
                                          </button>
                                        )}
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {b.status === 'confirmed' && canManageBookings(roles) && (
                                  <button type="button" onClick={() => handleCancelBooking(b)} disabled={manageBusy}
                                    aria-label={`Cancel booking for ${memberName(b)}`} className={`${ui.button} ${ui.focusable}`} style={smallDanger}>
                                    Cancel
                                  </button>
                                )}
                                {b.payment_type === 'card' && canManageBookings(roles) && (
                                  <button type="button" onClick={() => openRefund(b)} disabled={manageBusy}
                                    aria-label={`Refund ${memberName(b)}`} className={`${ui.button} ${ui.focusable}`} style={smallAction}>
                                    Refund
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              {(b.status === 'no_show' || (b.status === 'confirmed' && classEnded)) && <span style={{ marginRight: 8 }}><Chip>No-show</Chip></span>}
                              {(b.status === 'confirmed' || b.status === 'attended') && canMarkAttended(roles) && (
                                b.status === 'attended' ? (
                                  <button type="button" onClick={() => handleUnmarkAttended(b.id)} disabled={manageBusy}
                                    aria-label={`Undo check-in for ${memberName(b)}`} className={ui.focusable}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px', border: 0,
                                      borderRadius: radius.control, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                                      color: color.primaryInk, cursor: manageBusy ? 'not-allowed' : 'pointer',
                                    }}>
                                    <Check size={16} strokeWidth={2.5} aria-hidden />
                                    <span style={tabularNums}>{b.attended_at ? formatClock(b.attended_at, timeZone) : 'Checked in'}</span>
                                  </button>
                                ) : (
                                  <Button variant="primary" size="sm" onClick={() => handleMarkAttended(b.id)} disabled={manageBusy}>
                                    Check in<span className={styles.srOnly}> {memberName(b)}</span>
                                  </Button>
                                )
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (cancelledRows.length === 0 && cancelledGuestEntries.length === 0) ? (
              <EmptyState message="No cancellations." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                {cancelledRows.length > 0 && (
                  <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Name</th><th style={th}>Pass / payment</th><th style={th}>Status</th><th style={th}>What happened</th><th style={th}><span className={styles.srOnly}>Actions</span></th></tr></thead>
                    <tbody>
                      {cancelledRows.map(b => {
                        const s = bookingStatusChip[b.status] ?? { label: b.status, tone: 'neutral' as const }
                        return (
                          <tr key={b.id}>
                            <td style={td}>{nameCell(b)}</td>
                            <td style={td}>{paymentCell(b)}</td>
                            <td style={td}><Chip tone={s.tone}>{s.label}</Chip></td>
                            <td style={{ ...td, fontSize: 14, color: color.muted }}>
                              {cancellationHistory(b).map((line, li) => <div key={li}>{line}</div>)}
                            </td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {!b.credits_refunded && b.payment_type === 'pass' && b.member_pass_id && canManageBookings(roles) && (
                                  <button type="button" onClick={() => handleRefundCredit(b)} disabled={manageBusy} className={`${ui.button} ${ui.focusable}`} style={smallAction}>
                                    Refund credit
                                  </button>
                                )}
                                {b.payment_type === 'card' && canManageBookings(roles) && (
                                  <button type="button" onClick={() => openRefund(b)} disabled={manageBusy} className={`${ui.button} ${ui.focusable}`} style={smallAction}>
                                    Refund
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {cancelledGuestEntries.length > 0 && (
                  <div style={{ padding: '16px 20px', borderTop: cancelledRows.length > 0 ? `1px solid ${color.border}` : 'none' }}>
                    <div style={{ ...smallCapsStyle, marginBottom: 8 }}>Cancelled guests</div>
                    {cancelledGuestEntries.map((g, i) => (
                      <div key={`${g.bookingId}-${i}`} style={{ padding: '10px 0', borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</div>
                        <div style={{ fontSize: 14, color: color.ink2 }}>Guest of {g.memberName}</div>
                        <div style={{ fontSize: 13, color: color.muted, marginTop: 2 }}>
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
          </Card>

          <EntityActivity orgId={orgId} token={token} entityType="session_occurrence" entityId={occurrence.id} noun="class" refreshKey={activityKey} timeZone={timeZone} />
        </div>
      </div>

      {/* Refund modal */}
      {refundTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(23, 32, 28, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24,
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="refund-heading" style={{
            background: color.surface, borderRadius: radius.card, padding: 28, width: '100%', maxWidth: 460,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: font.body,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 id="refund-heading" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Issue refund</h2>
              <button type="button" aria-label="Close" onClick={() => setRefundTarget(null)} className={ui.focusable}
                style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}>
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.45, color: color.ink2 }}>
              {memberName(refundTarget) === 'Unknown member' ? 'This member' : memberName(refundTarget)} paid{' '}
              {refundTarget.amount_paid != null ? formatMoney(refundTarget.amount_paid, refundTarget.currency ?? 'AUD') : 'by card'} for this booking.
              Partial refunds are allowed; the amount can&apos;t exceed what&apos;s left unrefunded.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
              <div>
                <label htmlFor="refund-amount" style={labelStyle}>Refund amount</label>
                <input id="refund-amount" type="number" min="0" step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} style={{ ...inputStyle, ...tabularNums }} />
              </div>
              <div>
                <label htmlFor="refund-reason" style={labelStyle}>Reason</label>
                <textarea id="refund-reason" value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Goodwill refund for a late cancellation"
                  style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }} />
              </div>

              {refundError && (
                <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{refundError}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Button onClick={() => setRefundTarget(null)} style={{ flex: 1 }}>Cancel</Button>
                <Button variant="primary" onClick={handleIssueRefund} disabled={refundBusy} style={{ flex: 1 }}>
                  {refundBusy ? 'Issuing…' : 'Issue refund'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
