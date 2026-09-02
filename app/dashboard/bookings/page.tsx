'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewBookings, canManageBookings, canMarkAttended, canMarkNoShow, canAddStudent } from '@/lib/roles'
import { formatDate, formatDateTimeWithWeekday } from '@/lib/dates'
import styles from '@/app/dashboard/dashboard.module.css'

interface SessionSummary {
  id: string
  name: string
  session_type: string
  delivery_mode: 'in_person' | 'online'
  capacity: number | null
  price: number | null
  currency: string
  booking_access_mode: 'open' | 'free' | 'restricted'
}

interface Occurrence {
  id: string
  session_id: string
  starts_at: string
  ends_at: string
  capacity: number | null
  price: number | null
  status: 'scheduled' | 'cancelled' | 'completed'
  session: SessionSummary | null
}

// email is absent for teacher_general/teacher_basic — GET /members returns a name-only
// projection for them (17.3 denies contact info), full detail for admin/teacher_super.
interface Member {
  id: string
  full_name: string
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

// GET .../bookings returns either full Booking rows (admin, teacher_super, teacher_general) or,
// for front_desk/teacher_basic — denied member-profile visibility per §17.3 even on their own
// roster — a redacted RosterEntry with name-only identification. `user`/`payment_type`/`booked_at`
// are absent on the redacted shape; `member_name` is present only there.
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
  // Raw jsonb text, not a parsed array — same "not an EF-mapped collection" shape as the backend's
  // AuditEntry.Changes. Parse with parseGuests() below rather than indexing directly.
  guests?: string | null
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

function OccurrenceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    scheduled: { bg: '#e8f5ee', color: '#085041', label: 'Scheduled' },
    cancelled: { bg: '#fdecea', color: '#8b1a1a', label: 'Cancelled' },
    completed: { bg: '#f4f4f4', color: '#666', label: 'Completed' },
  }
  const s = styles[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
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
  no_show: { bg: '#fdecea', color: '#8b1a1a', label: 'No-show' },
  waitlisted: { bg: '#f0ecf8', color: '#4B2D8A', label: 'Waitlisted' },
}

function BookingStatusBadge({ status }: { status: string }) {
  const s = bookingStatusLabels[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
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

export default function BookingsPage() {
  return (
    <Suspense fallback={
      <div className={styles.shell}>
        <Sidebar active="bookings" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    }>
      <BookingsPageContent />
    </Suspense>
  )
}

function BookingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const focusOccurrenceId = searchParams.get('occurrence')

  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])

  const [managingOccurrence, setManagingOccurrence] = useState<Occurrence | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [manageError, setManageError] = useState('')
  const [manageBusy, setManageBusy] = useState(false)
  const [cancellingOccurrence, setCancellingOccurrence] = useState(false)

  const [refundTarget, setRefundTarget] = useState<Booking | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundError, setRefundError] = useState('')

  const [showAddBooking, setShowAddBooking] = useState(false)
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

  // A restricted session only accepts the specific pass templates on its approved-options list;
  // a pass issued for another session must not be offered here. Open sessions honour each pass
  // template's own session-type / delivery-mode restriction instead. The backend enforces both on
  // booking — this only keeps the "Which pass" picker from listing choices that would be rejected.
  const managingSessionId = managingOccurrence?.session?.id
  const managingAccessMode = managingOccurrence?.session?.booking_access_mode
  useEffect(() => {
    if (!managingSessionId || !orgId || !token) return
    if (managingAccessMode !== 'restricted') { setApprovedPassTemplateIds(null); return }
    let cancelled = false
    ;(async () => {
      const res = await authedFetch(`/sessions/${managingSessionId}/pricing-access`)
      if (cancelled || !res.ok) return
      const rows = await res.json()
      setApprovedPassTemplateIds(
        rows.filter((r: { pricing_type: string }) => r.pricing_type === 'pass_template')
          .map((r: { pass_template_id: string }) => r.pass_template_id)
      )
    })()
    return () => { cancelled = true }
  }, [managingSessionId, managingAccessMode, orgId, token, authedFetch])

  const passUsableForSession = useCallback((p: MemberPass): boolean => {
    if (p.status !== 'active' && p.status !== 'low') return false
    const s = managingOccurrence?.session
    if (!s) return true
    if (s.booking_access_mode === 'restricted') {
      if (approvedPassTemplateIds === null) return true
      return approvedPassTemplateIds.includes(p.pass_template_id)
    }
    const t = p.pass_template
    if (t?.session_type_restriction?.length && !t.session_type_restriction.includes(s.session_type)) return false
    if (t?.delivery_mode_restriction?.length && !t.delivery_mode_restriction.includes(s.delivery_mode)) return false
    return true
  }, [managingOccurrence?.session, approvedPassTemplateIds])

  const usablePasses = useMemo(
    () => memberPasses.filter(passUsableForSession),
    [memberPasses, passUsableForSession]
  )

  const reloadOccurrences = useCallback(async (org: string, t: string) => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/occurrences?from=${from.toISOString()}`,
      { headers: { Authorization: `Bearer ${t}` } }
    )
    if (res.ok) setOccurrences(await res.json())
  }, [])

  const openManageModal = useCallback(async (occurrence: Occurrence, org: string, t: string) => {
    setManagingOccurrence(occurrence)
    setManageError('')
    setShowAddBooking(false)
    setBookingsLoading(true)
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/occurrences/${occurrence.id}/bookings`,
      { headers: { Authorization: `Bearer ${t}` } }
    )
    if (res.ok) setBookings(await res.json())
    setBookingsLoading(false)
  }, [])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const t = session.access_token
      setToken(t)

      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()
      setOrgId(org.id)

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      const myRoles: string[] = roleRes.ok ? (await roleRes.json()).roles : []
      setRoles(myRoles)

      if (!canViewBookings(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      await reloadOccurrences(org.id, t)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Auto-open the roster modal when arriving from a session's "Manage roster" link
  useEffect(() => {
    if (!focusOccurrenceId || loading || occurrences.length === 0 || managingOccurrence) return
    const occ = occurrences.find(o => o.id === focusOccurrenceId)
    if (occ) openManageModal(occ, orgId, token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOccurrenceId, loading, occurrences])

  const refreshRoster = async (occurrenceId: string) => {
    const res = await authedFetch(`/occurrences/${occurrenceId}/bookings`)
    if (res.ok) setBookings(await res.json())
  }

  const handleMarkAttended = async (bookingId: string) => {
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/attend`, { method: 'POST' })
    if (res.ok) await refreshRoster(managingOccurrence!.id)
    else setManageError('Could not mark this booking attended.')
    setManageBusy(false)
  }

  const handleMarkNoShow = async (bookingId: string) => {
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/no-show`, { method: 'POST' })
    if (res.ok) await refreshRoster(managingOccurrence!.id)
    else setManageError('Could not mark this booking as a no-show.')
    setManageBusy(false)
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/cancel`, { method: 'POST' })
    if (res.ok) await refreshRoster(managingOccurrence!.id)
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
    if (res.ok) await refreshRoster(managingOccurrence!.id)
    else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? "Couldn't cancel this guest.")
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
      if (managingOccurrence) await refreshRoster(managingOccurrence.id)
    } else {
      const data = await res.json().catch(() => null)
      setRefundError(data?.error ?? 'Could not issue this refund.')
    }
    setRefundBusy(false)
  }

  const handleCancelOccurrence = async () => {
    if (!managingOccurrence) return
    if (!confirm('Cancel this whole occurrence? Every confirmed booking will be cancelled and any pass credits used will be returned.')) return

    setCancellingOccurrence(true)
    const res = await authedFetch(`/occurrences/${managingOccurrence.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: null })
    })
    if (res.ok) {
      const updated = await res.json()
      setManagingOccurrence(updated)
      setOccurrences(prev => prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o))
      await refreshRoster(managingOccurrence.id)
    } else {
      setManageError('Could not cancel this occurrence.')
    }
    setCancellingOccurrence(false)
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
    if (!canManageBookings(roles)) return // add-student is always free — no need to look up passes

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
    if (!managingOccurrence) return
    if (!addForm.userId) { setAddBookingError('Select a member'); return }

    // admin/teacher_super get the paid path (POST /bookings); teacher_general/teacher_basic only
    // ever get the no-payment "add student" path (POST .../add-student) — the payment section
    // above is hidden for them, so addForm.choice is never meaningful in that case.
    const useAddStudent = !canManageBookings(roles)
    const isFree = managingOccurrence.session?.booking_access_mode === 'free'

    if (!useAddStudent && !isFree && !addForm.choice) {
      setAddBookingError('Choose how this booking is paid for')
      return
    }

    setAddingBooking(true)
    setAddBookingError('')

    try {
      const paymentType = isFree ? 'free' : addForm.choice === 'comp' ? 'admin_waived' : 'pass'
      const memberPassId = paymentType === 'pass' ? addForm.choice : null

      const res = useAddStudent
        ? await authedFetch(`/occurrences/${managingOccurrence.id}/add-student`, {
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
              session_occurrence_id: managingOccurrence.id,
              payment_type: paymentType,
              member_pass_id: memberPassId,
              // TODO: send addForm.compNote once the backend has a comp-note field on the booking.
            })
          })

      if (res.ok) {
        setShowAddBooking(false)
        await refreshRoster(managingOccurrence.id)
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
    return m.full_name.toLowerCase().includes(q) || (m.email?.toLowerCase().includes(q) ?? false)
  })
  const selectedMember = members.find(m => m.id === addForm.userId)

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="bookings" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const isRestricted = managingOccurrence?.session?.booking_access_mode === 'restricted'
  const isFreeSession = managingOccurrence?.session?.booking_access_mode === 'free'

  return (
    <div className={styles.shell}>
      <Sidebar active="bookings" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : <>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Bookings</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
            Upcoming sessions and who's booked into them
          </p>
        </div>

        {occurrences.length === 0 ? (
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '64px', textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎟</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No upcoming occurrences</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
              Add occurrences to your sessions so members have dates and times to book.
            </p>
            <a href="/dashboard/sessions" style={{
              display: 'inline-block', padding: '10px 24px', backgroundColor: '#085041', color: 'white',
              borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none'
            }}>
              Go to sessions
            </a>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div className={styles.tableHeaderRow} style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 90px' }}>
              <div>Session</div>
              <div>When</div>
              <div>Mode</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {occurrences.map((occ, i) => (
              <div key={occ.id} className={styles.tableRow} style={{
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 90px',
                borderBottom: i < occurrences.length - 1 ? '1px solid #f4f4f4' : 'none'
              }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{occ.session?.name ?? 'Unknown session'}</div>
                <div style={{ fontSize: '13px' }}>
                  {formatDateTimeWithWeekday(occ.starts_at)}
                </div>
                <div style={{ fontSize: '13px', textTransform: 'capitalize' }}>{occ.session?.delivery_mode.replace('_', ' ')}</div>
                <div><OccurrenceStatusBadge status={occ.status} /></div>
                <div>
                  <button onClick={() => openManageModal(occ, orgId, token)} style={{
                    padding: '6px 12px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                    fontSize: '12px', color: '#444', cursor: 'pointer', fontWeight: 500
                  }}>
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </>}
      </div>

      {/* Roster modal */}
      {managingOccurrence && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
            maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{managingOccurrence.session?.name}</h2>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                  {formatDateTimeWithWeekday(managingOccurrence.starts_at)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <OccurrenceStatusBadge status={managingOccurrence.status} />
                <button
                  onClick={() => { setManagingOccurrence(null); router.replace('/dashboard/bookings') }}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
                >
                  ×
                </button>
              </div>
            </div>

            {manageError && (
              <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
                {manageError}
              </div>
            )}

            {managingOccurrence.status === 'scheduled' && (canManageBookings(roles) || canAddStudent(roles)) && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button onClick={openAddBooking} style={{
                  padding: '8px 16px', backgroundColor: '#085041', color: 'white', border: 'none',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}>
                  + Add {canManageBookings(roles) ? 'booking' : 'student'}
                </button>
                {canManageBookings(roles) && (
                  <button onClick={handleCancelOccurrence} disabled={cancellingOccurrence} style={{
                    padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #fdecea',
                    borderRadius: '8px', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                  }}>
                    {cancellingOccurrence ? 'Cancelling...' : 'Cancel occurrence'}
                  </button>
                )}
              </div>
            )}

            {/* Add booking form */}
            {showAddBooking && (
              <div style={{ border: '1px solid #e2e2e2', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>
                  {canManageBookings(roles) ? 'Add a booking' : 'Add a student'}
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
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedMember.full_name}</div>
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
                                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.full_name}</div>
                                  {m.email && <div style={{ fontSize: '12px', color: '#666' }}>{m.email}</div>}
                                </button>
                              ))
                            )}
                          </div>
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
                                placeholder="Reason (optional) — e.g. makeup class, staff comp"
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

            {/* Roster */}
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>
              Roster ({bookings.filter(b => b.status === 'confirmed' || b.status === 'attended').length})
            </div>
            {bookingsLoading ? (
              <p style={{ fontSize: '13px', color: '#666' }}>Loading...</p>
            ) : bookings.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666' }}>No one's booked in yet.</p>
            ) : (
              <div>
                {bookings.map((b, i) => {
                  const guests = parseGuests(b)
                  return (
                  <div key={b.id} style={{
                    padding: '10px 0', borderBottom: i < bookings.length - 1 ? '1px solid #f4f4f4' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.user?.full_name ?? b.member_name ?? 'Unknown member'}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {b.user?.email && `${b.user.email} · `}{b.booked_mode.replace('_', ' ')}
                          {b.payment_type && ` · ${paymentTypeLabels[b.payment_type] ?? b.payment_type}`}
                          {!!b.guest_count && ` · +${b.guest_count} guest${b.guest_count > 1 ? 's' : ''}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookingStatusBadge status={b.status} />
                        {b.status === 'confirmed' && (
                          <>
                            {canMarkAttended(roles) && (
                              <button onClick={() => handleMarkAttended(b.id)} disabled={manageBusy} style={{
                                padding: '5px 10px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                                fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500
                              }}>
                                Attended
                              </button>
                            )}
                            {canMarkNoShow(roles) && (
                              <button onClick={() => handleMarkNoShow(b.id)} disabled={manageBusy} style={{
                                padding: '5px 10px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                                fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500
                              }}>
                                No-show
                              </button>
                            )}
                            {canManageBookings(roles) && (
                              <button onClick={() => handleCancelBooking(b.id)} disabled={manageBusy} style={{
                                padding: '5px 10px', backgroundColor: 'transparent', border: '1px solid #fdecea', borderRadius: '6px',
                                fontSize: '11px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                              }}>
                                Cancel
                              </button>
                            )}
                          </>
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
              </div>
            )}
          </div>
        </div>
      )}

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
              {refundTarget.user?.full_name ?? refundTarget.member_name ?? 'This member'} paid{' '}
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
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
                    fontSize: '14px', outline: 'none', backgroundColor: 'white'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Reason</label>
                <textarea
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Goodwill refund for a late cancellation"
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
                    fontSize: '14px', outline: 'none', backgroundColor: 'white', minHeight: '80px', resize: 'vertical'
                  }}
                />
              </div>

              {refundError && (
                <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
                  {refundError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setRefundTarget(null)}
                  style={{
                    flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                    borderRadius: '8px', fontSize: '14px', cursor: 'pointer', color: '#444'
                  }}
                >
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
