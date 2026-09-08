'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewOccurrences } from '@/lib/roles'
import { formatDate } from '@/lib/dates'
import styles from '@/app/dashboard/dashboard.module.css'

interface Occurrence {
  id: string
  starts_at: string
  status: 'scheduled' | 'cancelled' | 'completed'
  cancellation_reason: string | null
  capacity: number | null
  booked: number
  instructor_name: string | null
  session: {
    name: string
    delivery_mode: 'in_person' | 'online'
    capacity: number | null
    visibility: string | null
  } | null
}

// Occurrence-level capacity overrides the session template's; null on both means uncapped, in
// which case there's no denominator to show — just the raw booked count.
function occupancy(occ: Occurrence) {
  const capacity = occ.capacity ?? occ.session?.capacity ?? null
  return { booked: occ.booked, capacity }
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function startOfWeek(d: Date) {
  const r = startOfDay(d)
  const dow = r.getDay() // 0 = Sunday
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  return addDays(r, mondayOffset)
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SchedulePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [viewDate, setViewDate] = useState(() => startOfDay(new Date()))
  const [showCancelled, setShowCancelled] = useState(false)
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [fetchedFrom, setFetchedFrom] = useState<string>('')

  const today = useMemo(() => startOfDay(new Date()), [])
  // Captured once on mount — good enough to split "already happened" from "still to come"; the
  // schedule doesn't need to re-tick while it's open.
  const now = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => startOfWeek(viewDate), [viewDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Calendar grid: the Monday on/before the 1st of viewDate's month, 6 full weeks (42 days) —
  // always covers the month plus enough padding into neighbouring months to fill the grid.
  const monthAnchor = useMemo(() => startOfMonth(viewDate), [viewDate])
  const gridStart = useMemo(() => startOfWeek(monthAnchor), [monthAnchor])
  const gridDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart])

  const authedFetch = useCallback((path: string) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    }), [orgId, token])

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

      if (!canViewOccurrences(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Re-fetch whenever navigation moves outside the currently-fetched window. `from` has no upper
  // bound server-side, so one fetch from the grid's start covers everything visible plus future
  // months — only refetch when the grid start moves earlier than what we last fetched.
  useEffect(() => {
    if (loading || forbidden || !orgId) return
    const from = gridStart.toISOString()
    if (fetchedFrom && new Date(from) >= new Date(fetchedFrom)) return

    const run = async () => {
      const res = await authedFetch(`/occurrences?from=${from}`)
      if (res.ok) {
        setOccurrences(await res.json())
        setFetchedFrom(from)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridStart, loading, forbidden, orgId])

  const cancelledCount = useMemo(
    () => occurrences.filter(o => o.status === 'cancelled').length,
    [occurrences],
  )

  const occurrencesByDay = useMemo(() => {
    const map: Record<string, Occurrence[]> = {}
    for (const occ of occurrences) {
      if (occ.status === 'cancelled' && !showCancelled) continue
      const key = dateKey(new Date(occ.starts_at))
      if (!map[key]) map[key] = []
      map[key].push(occ)
    }
    for (const key in map) map[key].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return map
  }, [occurrences, showCancelled])

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

  return (
    <div className={styles.shell}>
      <Sidebar active="schedule" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : <>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Schedule</h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              Every upcoming class, by week
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {cancelledCount > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#666', cursor: 'pointer' }}>
                <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
                Show cancelled ({cancelledCount})
              </label>
            )}
            <button
              onClick={() => setViewDate(today)}
              style={{
                padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e2e2e2',
                borderRadius: '8px', fontSize: '13px', color: '#444', cursor: 'pointer', fontWeight: 500
              }}
            >
              Today
            </button>
          </div>
        </div>

        <div className={styles.twoCol} style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

          {/* Week view */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid #e2e2e2'
            }}>
              <button
                onClick={() => setViewDate(addDays(viewDate, -7))}
                style={navButtonStyle}
                aria-label="Previous week"
              >
                ‹
              </button>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>
                {formatDate(weekStart)}
                {' – '}
                {formatDate(addDays(weekStart, 6))}
              </div>
              <button
                onClick={() => setViewDate(addDays(viewDate, 7))}
                style={navButtonStyle}
                aria-label="Next week"
              >
                ›
              </button>
            </div>

            <div>
              {weekDays.map((day, i) => {
                const dayOccurrences = occurrencesByDay[dateKey(day)] ?? []
                return (
                  <div key={dateKey(day)} style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr',
                    padding: '16px 20px', borderBottom: i < 6 ? '1px solid #f4f4f4' : 'none'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '13px', fontWeight: 600,
                        color: isSameDay(day, today) ? '#085041' : '#1a1a1a'
                      }}>
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {formatDate(day)}
                      </div>
                    </div>
                    <div>
                      {dayOccurrences.length === 0 ? (
                        <div style={{ fontSize: '13px', color: '#ccc' }}>—</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {dayOccurrences.map(occ => {
                            const { booked, capacity } = occupancy(occ)
                            const isFull = capacity !== null && booked >= capacity
                            const isPast = new Date(occ.starts_at) < now
                            const isCancelled = occ.status === 'cancelled'
                            const isDraft = occ.session?.visibility === 'draft'
                            return (
                            <a
                              key={occ.id}
                              href={`/dashboard/occurrences/${occ.id}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 12px', borderRadius: '8px',
                                backgroundColor: isCancelled ? '#f7f7f7' : isDraft ? '#fbfbfb' : isPast ? '#f4f4f4' : '#e8f5ee',
                                border: isDraft ? '1px dashed #d2d2d2' : undefined,
                                textDecoration: 'none', color: isCancelled || isPast ? '#999' : '#1a1a1a', fontSize: '13px'
                              }}
                            >
                              <span style={{
                                fontWeight: 600, minWidth: '68px',
                                color: isCancelled || isPast ? '#999' : '#085041',
                                textDecoration: isCancelled ? 'line-through' : 'none'
                              }}>
                                {new Date(occ.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                              </span>
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                  {occ.session?.name ?? 'Session'}
                                  <span style={{ color: isCancelled || isPast ? '#bbb' : '#999' }}>
                                    {' · '}{occ.instructor_name ?? 'Unassigned'}
                                  </span>
                                </span>
                                {isCancelled && occ.cancellation_reason && (
                                  <span style={{ color: '#8b1a1a' }}> — {occ.cancellation_reason}</span>
                                )}
                              </span>
                              {isDraft && (
                                <span style={{
                                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                                  backgroundColor: '#f0f0f0', color: '#666'
                                }}>
                                  Draft
                                </span>
                              )}
                              {isCancelled ? (
                                <span style={{
                                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                                  backgroundColor: '#fdecea', color: '#8b1a1a'
                                }}>
                                  Cancelled
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                                  backgroundColor: isFull ? '#fdecea' : '#e8f5ee',
                                  color: isFull ? '#8b1a1a' : '#085041'
                                }}>
                                  {capacity === null ? booked : `${booked}/${capacity}`}
                                </span>
                              )}
                              <span style={{ fontSize: '11px', color: '#999', textTransform: 'capitalize' }}>
                                {occ.session?.delivery_mode.replace('_', ' ')}
                              </span>
                            </a>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Month calendar */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <button
                onClick={() => setViewDate(d => startOfMonth(addDays(startOfMonth(d), -1)))}
                style={navButtonStyle}
                aria-label="Previous month"
              >
                ‹
              </button>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={() => setViewDate(d => {
                  const next = new Date(startOfMonth(d))
                  next.setMonth(next.getMonth() + 1)
                  return next
                })}
                style={navButtonStyle}
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
              {DAY_LABELS.map(label => (
                <div key={label} style={{ textAlign: 'center', fontSize: '11px', color: '#999', fontWeight: 600, padding: '4px 0' }}>
                  {label}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {gridDays.map(day => {
                const inMonth = day.getMonth() === monthAnchor.getMonth()
                const hasClasses = (occurrencesByDay[dateKey(day)] ?? []).length > 0
                const isToday = isSameDay(day, today)
                const isSelected = isSameDay(day, viewDate)
                const isPastDay = day < today
                return (
                  <button
                    key={dateKey(day)}
                    onClick={() => setViewDate(day)}
                    style={{
                      aspectRatio: '1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid #085041' : isToday ? '1px solid #085041' : '1px solid transparent',
                      backgroundColor: hasClasses ? (isPastDay ? '#f4f4f4' : '#e8f5ee') : 'transparent',
                      color: !inMonth ? '#ccc' : hasClasses ? (isPastDay ? '#999' : '#085041') : isPastDay ? '#bbb' : '#444',
                      fontSize: '12px',
                      fontWeight: hasClasses ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', fontSize: '11px', color: '#666' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#e8f5ee', display: 'inline-block' }} />
                Upcoming
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#f4f4f4', display: 'inline-block' }} />
                Past
              </span>
            </div>
          </div>
        </div>
        </>}
      </div>
    </div>
  )
}

const navButtonStyle: React.CSSProperties = {
  width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid #e2e2e2', borderRadius: '6px', backgroundColor: 'white',
  fontSize: '14px', color: '#444', cursor: 'pointer'
}
