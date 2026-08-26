'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewBookings, canManageBookings, canManageOccurrences, canMarkAttended, canMarkNoShow, canAddStudent } from '@/lib/roles'
import styles from '@/app/dashboard/dashboard.module.css'

interface SessionDetail {
  id: string
  name: string
  delivery_mode: 'in_person' | 'online' | 'hybrid'
  location_name: string | null
  capacity_inperson: number | null
  capacity_online: number | null
  booking_access_mode: 'open' | 'free' | 'restricted'
  instructor_id: string | null
}

interface OccurrenceDetail {
  id: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'cancelled' | 'completed'
  capacity_inperson: number | null
  capacity_online: number | null
  instructor_id: string | null
  instructor_name: string | null
  session: SessionDetail | null
}

interface Teacher {
  id: string
  full_name: string
}

interface Member {
  id: string
  full_name: string
  email?: string
}

interface MemberPass {
  id: string
  credits_remaining: number | null
  credits_total: number | null
  status: 'active' | 'low' | 'frozen' | 'expired' | 'exhausted'
  pass_template: { name: string } | null
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
  const capInperson = occurrence.capacity_inperson ?? occurrence.session?.capacity_inperson ?? null
  const capOnline = occurrence.capacity_online ?? occurrence.session?.capacity_online ?? null
  const booked = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'attended')
    .reduce((sum, b) => sum + 1 + (b.guest_count ?? 0), 0)
  if (capInperson === null && capOnline === null) return { booked, capacity: null as number | null }
  return { booked, capacity: (capInperson ?? 0) + (capOnline ?? 0) }
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
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('booked')

  const [manageError, setManageError] = useState('')
  const [manageBusy, setManageBusy] = useState(false)
  const [cancellingOccurrence, setCancellingOccurrence] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ date: '', startTime: '', endTime: '', capacityInperson: '', capacityOnline: '', instructorId: '' })
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
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberPasses, setMemberPasses] = useState<MemberPass[]>([])
  const [passesLoading, setPassesLoading] = useState(false)
  const [addForm, setAddForm] = useState({ userId: '', bookedMode: 'in_person' as 'in_person' | 'online', paymentType: 'pass' as 'pass' | 'admin_waived', memberPassId: '' })
  const [addingBooking, setAddingBooking] = useState(false)
  const [addBookingError, setAddBookingError] = useState('')

  const authedFetch = useCallback((path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` }
    }), [orgId, token])

  const loadOccurrence = useCallback(async (org: string, t: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/occurrences/${occurrenceId}`, {
      headers: { Authorization: `Bearer ${t}` }
    })
    if (res.status === 404) { setNotFound(true); return }
    if (res.ok) setOccurrence(await res.json())
  }, [occurrenceId])

  const refreshRoster = useCallback(async (org: string, t: string) => {
    setBookingsLoading(true)
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/occurrences/${occurrenceId}/bookings`, {
      headers: { Authorization: `Bearer ${t}` }
    })
    if (res.ok) setBookings(await res.json())
    setBookingsLoading(false)
  }, [occurrenceId])

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

  const handleMarkNoShow = async (bookingId: string) => {
    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/bookings/${bookingId}/no-show`, { method: 'POST' })
    if (res.ok) await refreshRoster(orgId, token)
    else setManageError('Could not mark this booking as a no-show.')
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

  const handleCancelOccurrence = async () => {
    if (!occurrence) return
    if (!confirm('Cancel this whole occurrence? Every confirmed booking will be cancelled and any pass credits used will be returned.')) return

    setCancellingOccurrence(true)
    const res = await authedFetch(`/occurrences/${occurrence.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: null })
    })
    if (res.ok) {
      setOccurrence(await res.json())
      await refreshRoster(orgId, token)
    } else {
      setManageError('Could not cancel this occurrence.')
    }
    setCancellingOccurrence(false)
  }

  const openEdit = async () => {
    if (!occurrence) return
    setEditError('')
    setEditForm({
      date: toDateInputValue(occurrence.starts_at),
      startTime: toTimeInputValue(occurrence.starts_at),
      endTime: toTimeInputValue(occurrence.ends_at),
      capacityInperson: (occurrence.capacity_inperson ?? occurrence.session?.capacity_inperson ?? '')?.toString() ?? '',
      capacityOnline: (occurrence.capacity_online ?? occurrence.session?.capacity_online ?? '')?.toString() ?? '',
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
        capacity_inperson: editForm.capacityInperson === '' ? null : parseInt(editForm.capacityInperson),
        capacity_online: editForm.capacityOnline === '' ? null : parseInt(editForm.capacityOnline),
        instructor_id: editForm.instructorId === '' ? null : editForm.instructorId,
        clear_instructor_id: editForm.instructorId === '',
      })
    })
    if (res.ok) {
      setOccurrence(await res.json())
      setShowEdit(false)
    } else {
      const data = await res.json().catch(() => null)
      setEditError(data?.error ?? 'Could not update this occurrence.')
    }
    setEditBusy(false)
  }

  const openAddBooking = async () => {
    setAddBookingError('')
    setAddForm({
      userId: '',
      bookedMode: occurrence?.session?.delivery_mode === 'online' ? 'online' : 'in_person',
      paymentType: 'pass',
      memberPassId: ''
    })
    setMemberPasses([])
    setMemberSearch('')
    setShowAddBooking(true)
    setMembersLoading(true)
    const res = await authedFetch('/members')
    if (res.ok) setMembers(await res.json())
    setMembersLoading(false)
  }

  const selectMember = async (memberId: string) => {
    setAddForm(p => ({ ...p, userId: memberId, memberPassId: '' }))
    if (!canManageBookings(roles)) return

    setPassesLoading(true)
    const res = await authedFetch(`/members/${memberId}/passes`)
    if (res.ok) {
      const all: MemberPass[] = await res.json()
      setMemberPasses(all.filter(p => p.status === 'active' || p.status === 'low'))
    }
    setPassesLoading(false)
  }

  const handleAddBooking = async () => {
    if (!occurrence) return
    if (!addForm.userId) { setAddBookingError('Select a member'); return }

    const useAddStudent = !canManageBookings(roles)

    if (!useAddStudent) {
      const isFree = occurrence.session?.booking_access_mode === 'free'
      const paymentType = isFree ? 'free' : addForm.paymentType
      if (paymentType === 'pass' && !addForm.memberPassId) {
        setAddBookingError('Select which pass to use')
        return
      }
    }

    setAddingBooking(true)
    setAddBookingError('')

    try {
      const isFree = occurrence.session?.booking_access_mode === 'free'
      const paymentType = isFree ? 'free' : addForm.paymentType

      const res = useAddStudent
        ? await authedFetch(`/occurrences/${occurrence.id}/add-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: addForm.userId,
              booked_mode: addForm.bookedMode,
            })
          })
        : await authedFetch('/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: addForm.userId,
              session_occurrence_id: occurrence.id,
              booked_mode: addForm.bookedMode,
              payment_type: paymentType,
              member_pass_id: paymentType === 'pass' ? addForm.memberPassId : null,
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
    return m.full_name.toLowerCase().includes(q) || (m.email?.toLowerCase().includes(q) ?? false)
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
  const { booked, capacity } = occupancy(occurrence, bookings)

  const bookedRows = bookings.filter(b => b.status === 'confirmed' || b.status === 'attended' || b.status === 'no_show')
  const waitlistRows = bookings.filter(b => b.status === 'waitlisted')
  const cancelledRows = bookings.filter(b => b.status === 'cancelled' || b.status === 'late_cancel')
  const rowsForTab = tab === 'booked' ? bookedRows : tab === 'waitlist' ? waitlistRows : cancelledRows

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
                {new Date(occurrence.starts_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
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
                  + Add {canManageBookings(roles) ? 'booking' : 'student'}
                </button>
              )}
              {canManageOccurrences(roles) && (
                <button onClick={openEdit} style={secondaryButtonStyle}>
                  Edit
                </button>
              )}
              {canManageOccurrences(roles) && (
                <button onClick={handleCancelOccurrence} disabled={cancellingOccurrence} style={{
                  padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #fdecea',
                  borderRadius: '8px', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                }}>
                  {cancellingOccurrence ? 'Cancelling...' : 'Cancel occurrence'}
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
                  <label style={labelStyle}>Capacity (in-person)</label>
                  <input type="number" min="0" placeholder="Unlimited" value={editForm.capacityInperson}
                    onChange={e => setEditForm(p => ({ ...p, capacityInperson: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Capacity (online)</label>
                  <input type="number" min="0" placeholder="Unlimited" value={editForm.capacityOnline}
                    onChange={e => setEditForm(p => ({ ...p, capacityOnline: e.target.value }))} style={inputStyle} />
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
                      <option key={t.id} value={t.id}>{t.full_name}</option>
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
              {canManageBookings(roles) ? 'Add a booking' : 'Add a student'}
            </div>

            {isRestricted ? (
              <p style={{ fontSize: '13px', color: '#666' }}>
                This session is restricted to specific passes or memberships, which isn't supported for manual booking yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                        onClick={() => { setAddForm(p => ({ ...p, userId: '', memberPassId: '' })); setMemberPasses([]) }}
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

                {session?.delivery_mode === 'hybrid' && (
                  <div>
                    <label style={labelStyle}>Attending</label>
                    <select
                      value={addForm.bookedMode}
                      onChange={e => setAddForm(p => ({ ...p, bookedMode: e.target.value as 'in_person' | 'online' }))}
                      style={inputStyle}
                    >
                      <option value="in_person">In-person</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                )}

                {!canManageBookings(roles) ? (
                  <p style={{ fontSize: '13px', color: '#666' }}>Added at no charge — payment isn't part of this action.</p>
                ) : isFreeSession ? (
                  <p style={{ fontSize: '13px', color: '#666' }}>This session is free — no payment required.</p>
                ) : (
                  <>
                    <div>
                      <label style={labelStyle}>Payment</label>
                      <select
                        value={addForm.paymentType}
                        onChange={e => setAddForm(p => ({ ...p, paymentType: e.target.value as 'pass' | 'admin_waived', memberPassId: '' }))}
                        style={inputStyle}
                      >
                        <option value="pass">Use a pass</option>
                        <option value="admin_waived">Comp (no charge)</option>
                      </select>
                    </div>

                    {addForm.paymentType === 'pass' && addForm.userId && (
                      <div>
                        <label style={labelStyle}>Which pass</label>
                        {passesLoading ? (
                          <p style={{ fontSize: '13px', color: '#666' }}>Loading passes...</p>
                        ) : memberPasses.length === 0 ? (
                          <p style={{ fontSize: '13px', color: '#666' }}>This member has no usable passes.</p>
                        ) : (
                          <select
                            value={addForm.memberPassId}
                            onChange={e => setAddForm(p => ({ ...p, memberPassId: e.target.value }))}
                            style={inputStyle}
                          >
                            <option value="">Select a pass...</option>
                            {memberPasses.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.pass_template?.name ?? 'Pass'} — {p.credits_remaining === null ? 'unlimited' : `${p.credits_remaining} / ${p.credits_total} credits`}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </>
                )}

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
            )}
          </div>
        )}

        {/* Tabs + roster */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '24px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e2e2', marginBottom: '16px' }}>
            <button style={tabStyle(tab === 'booked')} onClick={() => setTab('booked')}>
              Booked ({capacity === null ? booked : `${booked}/${capacity}`})
            </button>
            <button style={tabStyle(tab === 'waitlist')} onClick={() => setTab('waitlist')}>
              On waitlist ({waitlistRows.length})
            </button>
            <button style={tabStyle(tab === 'cancelled')} onClick={() => setTab('cancelled')}>
              Cancelled ({cancelledRows.length})
            </button>
          </div>

          {bookingsLoading ? (
            <p style={{ fontSize: '13px', color: '#666' }}>Loading...</p>
          ) : rowsForTab.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>
              {tab === 'booked' ? "No one's booked in yet." : tab === 'waitlist' ? 'No one on the waitlist.' : 'No cancellations.'}
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
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.user?.full_name ?? b.member_name ?? 'Unknown member'}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {b.user?.email && `${b.user.email} · `}{b.booked_mode.replace('_', ' ')}
                          {b.payment_type && ` · ${paymentTypeLabels[b.payment_type] ?? b.payment_type}`}
                          {!!b.guest_count && ` · +${b.guest_count} guest${b.guest_count > 1 ? 's' : ''}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* confirmed/attended/no_show are all implied here — which tab the row is in, and
                            the Attended checkbox's own state, already say it; a badge would be noise. */}
                        {!['confirmed', 'attended', 'no_show'].includes(b.status) && <BookingStatusBadge status={b.status} />}
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
                        {b.status === 'confirmed' && (
                          <>
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
