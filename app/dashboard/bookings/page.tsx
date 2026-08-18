'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'

interface SessionSummary {
  id: string
  name: string
  session_type: string
  delivery_mode: 'in_person' | 'online' | 'hybrid'
  capacity_inperson: number | null
  capacity_online: number | null
  price_inperson: number | null
  price_online: number | null
  currency: string
  booking_access_mode: 'open' | 'free' | 'restricted'
}

interface Occurrence {
  id: string
  session_id: string
  starts_at: string
  ends_at: string
  capacity_inperson: number | null
  capacity_online: number | null
  price_inperson: number | null
  price_online: number | null
  status: 'scheduled' | 'cancelled' | 'completed'
  session: SessionSummary | null
}

interface Member {
  id: string
  full_name: string
  email: string
}

interface MemberPass {
  id: string
  credits_remaining: number | null
  credits_total: number | null
  status: 'active' | 'low' | 'frozen' | 'expired' | 'exhausted'
  pass_template: { name: string } | null
}

interface Booking {
  id: string
  user_id: string
  booked_mode: 'in_person' | 'online'
  status: 'confirmed' | 'attended' | 'cancelled' | 'late_cancel' | 'no_show' | 'waitlisted'
  payment_type: 'card' | 'pass' | 'membership' | 'admin_waived' | 'free'
  booked_at: string
  user: Member | null
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

export default function BookingsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="bookings" />
        <div style={{ marginLeft: '240px', flex: 1, padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])

  const [managingOccurrence, setManagingOccurrence] = useState<Occurrence | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [manageError, setManageError] = useState('')
  const [manageBusy, setManageBusy] = useState(false)
  const [cancellingOccurrence, setCancellingOccurrence] = useState(false)

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
    setAddForm({
      userId: '',
      bookedMode: managingOccurrence?.session?.delivery_mode === 'online' ? 'online' : 'in_person',
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
    setPassesLoading(true)
    const res = await authedFetch(`/members/${memberId}/passes`)
    if (res.ok) {
      const all: MemberPass[] = await res.json()
      setMemberPasses(all.filter(p => p.status === 'active' || p.status === 'low'))
    }
    setPassesLoading(false)
  }

  const handleAddBooking = async () => {
    if (!managingOccurrence) return
    if (!addForm.userId) { setAddBookingError('Select a member'); return }

    const isFree = managingOccurrence.session?.booking_access_mode === 'free'
    const paymentType = isFree ? 'free' : addForm.paymentType
    if (paymentType === 'pass' && !addForm.memberPassId) {
      setAddBookingError('Select which pass to use')
      return
    }

    setAddingBooking(true)
    setAddBookingError('')

    try {
      const res = await authedFetch('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: addForm.userId,
          session_occurrence_id: managingOccurrence.id,
          booked_mode: addForm.bookedMode,
          payment_type: paymentType,
          member_pass_id: paymentType === 'pass' ? addForm.memberPassId : null,
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
    return m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })
  const selectedMember = members.find(m => m.id === addForm.userId)

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="bookings" />
        <div style={{ marginLeft: '240px', flex: 1, padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const isRestricted = managingOccurrence?.session?.booking_access_mode === 'restricted'
  const isFreeSession = managingOccurrence?.session?.booking_access_mode === 'free'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <Sidebar active="bookings" />

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>
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
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 90px',
              padding: '12px 24px', backgroundColor: '#f4f4f4', borderBottom: '1px solid #e2e2e2',
              fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              <div>Session</div>
              <div>When</div>
              <div>Mode</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {occurrences.map((occ, i) => (
              <div key={occ.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 90px',
                padding: '16px 24px', borderBottom: i < occurrences.length - 1 ? '1px solid #f4f4f4' : 'none',
                alignItems: 'center'
              }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{occ.session?.name ?? 'Unknown session'}</div>
                <div style={{ fontSize: '13px' }}>
                  {new Date(occ.starts_at).toLocaleString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                  })}
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
                  {new Date(managingOccurrence.starts_at).toLocaleString(undefined, {
                    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                  })}
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

            {managingOccurrence.status === 'scheduled' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button onClick={openAddBooking} style={{
                  padding: '8px 16px', backgroundColor: '#085041', color: 'white', border: 'none',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}>
                  + Add booking
                </button>
                <button onClick={handleCancelOccurrence} disabled={cancellingOccurrence} style={{
                  padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #fdecea',
                  borderRadius: '8px', fontSize: '13px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                }}>
                  {cancellingOccurrence ? 'Cancelling...' : 'Cancel occurrence'}
                </button>
              </div>
            )}

            {/* Add booking form */}
            {showAddBooking && (
              <div style={{ border: '1px solid #e2e2e2', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Add a booking</div>

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
                            <div style={{ fontSize: '12px', color: '#666' }}>{selectedMember.email}</div>
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
                            placeholder="Search members by name or email..."
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
                                  <div style={{ fontSize: '12px', color: '#666' }}>{m.email}</div>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {managingOccurrence.session?.delivery_mode === 'hybrid' && (
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

                    {isFreeSession ? (
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
                        {addingBooking ? 'Booking...' : 'Confirm booking'}
                      </button>
                    </div>
                  </div>
                )}
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
                {bookings.map((b, i) => (
                  <div key={b.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: i < bookings.length - 1 ? '1px solid #f4f4f4' : 'none'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.user?.full_name ?? 'Unknown member'}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {b.user?.email} · {b.booked_mode.replace('_', ' ')} · {paymentTypeLabels[b.payment_type] ?? b.payment_type}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookingStatusBadge status={b.status} />
                      {b.status === 'confirmed' && (
                        <>
                          <button onClick={() => handleMarkAttended(b.id)} disabled={manageBusy} style={{
                            padding: '5px 10px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                            fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500
                          }}>
                            Attended
                          </button>
                          <button onClick={() => handleMarkNoShow(b.id)} disabled={manageBusy} style={{
                            padding: '5px 10px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                            fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500
                          }}>
                            No-show
                          </button>
                          <button onClick={() => handleCancelBooking(b.id)} disabled={manageBusy} style={{
                            padding: '5px 10px', backgroundColor: 'transparent', border: '1px solid #fdecea', borderRadius: '6px',
                            fontSize: '11px', color: '#8b1a1a', cursor: 'pointer', fontWeight: 500
                          }}>
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
