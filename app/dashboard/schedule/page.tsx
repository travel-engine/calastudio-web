'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewOccurrences, canManageSessions } from '@/lib/roles'
import { dayKey, formatClock } from '@/lib/dates'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Button, CapacityBar, Card, Chip, PageHeader, buttonStyle } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
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
    location_name?: string | null
  } | null
}

// Occurrence-level capacity overrides the session template's; null on both means uncapped, in
// which case there's no denominator to show — just the raw booked count.
function occupancy(occ: Occurrence) {
  const capacity = occ.capacity ?? occ.session?.capacity ?? null
  return { booked: occ.booked, capacity }
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Calendar days are plain local Date objects (y/m/d only); which day a class falls on comes from
// its time in the studio's timezone (dayKey), so both sides compare as "YYYY-MM-DD".
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfWeek(d: Date) { const r = startOfDay(d); const dow = r.getDay(); return addDays(r, dow === 0 ? -6 : 1 - dow) }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function keyOf(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function fromKey(k: string) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const dowIndex = (d: Date) => (d.getDay() + 6) % 7 // Monday = 0

// "12 – 18 October" · "28 September – 4 October" · year added when it isn't the current one
function weekTitle(start: Date, end: Date, thisYear: number) {
  const yr = (d: Date) => (d.getFullYear() === thisYear ? '' : ` ${d.getFullYear()}`)
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${end.getDate()} ${MONTHS_LONG[end.getMonth()]}${yr(end)}`
  return `${start.getDate()} ${MONTHS_LONG[start.getMonth()]}${start.getFullYear() !== end.getFullYear() ? yr(start) : ''} – ${end.getDate()} ${MONTHS_LONG[end.getMonth()]}${yr(end)}`
}

function flagFor(occ: Occurrence, isPast: boolean): { text: string; tone: 'neutral' | 'warn' | 'danger' } | null {
  if (occ.status === 'cancelled') return { text: 'Cancelled', tone: 'neutral' }
  if (occ.session?.visibility === 'draft') return { text: 'Draft', tone: 'neutral' }
  if (isPast) return null
  if (occ.instructor_name == null) return { text: 'No teacher', tone: 'warn' }
  const { booked, capacity } = occupancy(occ)
  if (capacity != null && capacity > 0) {
    if (booked >= capacity) return { text: 'Full', tone: 'danger' }
    if (booked / capacity >= 0.8) return { text: 'Almost full', tone: 'warn' }
  }
  return null
}

export default function SchedulePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const [viewDate, setViewDate] = useState(() => startOfDay(new Date()))
  const [showCancelled, setShowCancelled] = useState(false)
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [fetchedFrom, setFetchedFrom] = useState<string>('')

  // "Today" on the studio's clock, as a calendar day. Captured on render; the page doesn't re-tick.
  const todayKey = dayKey(Date.now(), timeZone)
  const today = useMemo(() => fromKey(todayKey), [todayKey])
  const now = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => startOfWeek(viewDate), [viewDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekKeys = useMemo(() => new Set(weekDays.map(keyOf)), [weekDays])

  // Calendar grid: the Monday on/before the 1st of viewDate's month, 6 full weeks (42 days).
  const monthAnchor = useMemo(() => startOfMonth(viewDate), [viewDate])
  const gridStart = useMemo(() => startOfWeek(monthAnchor), [monthAnchor])
  const gridDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart])

  const authedFetch = useCallback((path: string) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    }), [orgId, token])

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      setToken(ctx.token)
      setOrgId(ctx.org.id)
      setTimeZone(ctx.org.timezone ?? null)
      setRoles(ctx.roles)

      if (!canViewOccurrences(ctx.roles)) {
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
  // months — only refetch when the grid start moves earlier than what we last fetched. A day of
  // slack absorbs the browser-vs-studio timezone difference at the window's edge.
  useEffect(() => {
    if (loading || forbidden || !orgId) return
    const from = addDays(gridStart, -1).toISOString()
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

  const cancelledCount = useMemo(() => occurrences.filter(o => o.status === 'cancelled').length, [occurrences])

  const occurrencesByDay = useMemo(() => {
    const map: Record<string, Occurrence[]> = {}
    for (const occ of occurrences) {
      if (occ.status === 'cancelled' && !showCancelled) continue
      const key = dayKey(occ.starts_at, timeZone)
      if (!map[key]) map[key] = []
      map[key].push(occ)
    }
    for (const key in map) map[key].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return map
  }, [occurrences, showCancelled, timeZone])

  // Days that have any class (cancelled ones too) — the calendar's dots.
  const daysWithClasses = useMemo(
    () => new Set(occurrences.filter(o => o.status !== 'cancelled').map(o => dayKey(o.starts_at, timeZone))),
    [occurrences, timeZone],
  )

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

  const iconButton = { ...buttonStyle('secondary'), width: 44, padding: 0 }

  return (
    <div className={styles.shell}>
      <Sidebar active="schedule" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader
              eyebrow="Schedule · bookings & rosters"
              title={weekTitle(weekStart, addDays(weekStart, 6), today.getFullYear())}
              actions={canManageSessions(roles) && (
                <Button href="/dashboard/sessions/new" variant="primary" icon={<Plus size={18} strokeWidth={2} aria-hidden />}>New session</Button>
              )}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" aria-label="Previous week" onClick={() => setViewDate(addDays(viewDate, -7))} className={`${ui.button} ${ui.focusable}`} style={iconButton}>
                  <ChevronLeft size={18} strokeWidth={2} aria-hidden />
                </button>
                <Button onClick={() => setViewDate(today)} disabled={weekKeys.has(todayKey)}>This week</Button>
                <button type="button" aria-label="Next week" onClick={() => setViewDate(addDays(viewDate, 7))} className={`${ui.button} ${ui.focusable}`} style={iconButton}>
                  <ChevronRight size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
              {cancelledCount > 0 && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: space.target, fontSize: 15, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: color.primary }}
                  />
                  Show cancelled ({cancelledCount})
                </label>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.cardGap, alignItems: 'flex-start' }}>
              {/* Week: one row per day */}
              <Card style={{ flex: '999 1 560px', minWidth: 0, overflow: 'hidden' }} aria-label="Week">
                {weekDays.map((day, i) => {
                  const key = keyOf(day)
                  const isToday = key === todayKey
                  const isPastDay = key < todayKey
                  const dayOccurrences = occurrencesByDay[key] ?? []
                  return (
                    <div key={key} style={{
                      display: 'flex', gap: 16, padding: '14px 20px',
                      borderTop: i ? `1px solid ${color.divider}` : 'none',
                      background: isToday ? '#F4F9F6' : 'transparent',
                    }}>
                      <div style={{ width: 84, flex: 'none', display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: isToday ? color.primary : isPastDay ? color.muted : color.ink }}>
                          {isToday ? 'Today' : DOW_SHORT[dowIndex(day)]}
                        </span>
                        <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>{day.getDate()} {MONTHS_SHORT[day.getMonth()]}</span>
                      </div>
                      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dayOccurrences.length === 0 ? (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48,
                            padding: '0 14px', border: `1px dashed ${color.control}`, borderRadius: 10, fontSize: 14, color: color.muted,
                          }}>
                            <span>No classes</span>
                            {canManageSessions(roles) && !isPastDay && (
                              <Link href="/dashboard/sessions/new" className={ui.focusable} style={{ fontWeight: 600, color: color.primary, textDecoration: 'none' }}>Add one</Link>
                            )}
                          </div>
                        ) : dayOccurrences.map(occ => {
                          const { booked, capacity } = occupancy(occ)
                          const isPast = new Date(occ.starts_at) < now
                          const isCancelled = occ.status === 'cancelled'
                          const flag = flagFor(occ, isPast)
                          const place = [occ.session?.location_name, occ.instructor_name ?? 'No teacher'].filter(Boolean).join(' · ')
                          return (
                            <Link
                              key={occ.id}
                              href={`/dashboard/occurrences/${occ.id}`}
                              className={`${ui.tile} ${ui.focusable}`}
                              style={{
                                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '12px 14px',
                                borderRadius: 10, border: `1px solid ${color.divider}`, textDecoration: 'none', color: color.ink,
                                background: isCancelled ? '#F7F8F5' : isPastDay ? '#FAFAF8' : color.surface,
                                opacity: isCancelled ? 0.75 : 1,
                                ['--hover-border' as string]: '#B9C9C1',
                              }}
                            >
                              <span style={{ width: 72, flex: 'none', fontSize: 15, fontWeight: 600, ...tabularNums }}>{formatClock(occ.starts_at, timeZone)}</span>
                              <span style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{
                                  fontSize: 16, fontWeight: 600,
                                  ...(isCancelled ? { textDecoration: 'line-through', color: color.muted } : {}),
                                }}>
                                  {occ.session?.name ?? 'Session'}
                                </span>
                                <span style={{ fontSize: 14, color: color.muted }}>
                                  {place}
                                  {isCancelled && occ.cancellation_reason ? ` · ${occ.cancellation_reason}` : ''}
                                </span>
                              </span>
                              {flag && <Chip tone={flag.tone}>{flag.text}</Chip>}
                              {!isCancelled && <CapacityBar booked={booked} capacity={capacity} width={90} layout="inline" muted={isPast} />}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </Card>

              {/* Month calendar: dots on days with classes, ring on today; a day jumps to its week */}
              <Card as="div" aria-label="Month" style={{ flex: '1 1 280px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button type="button" aria-label="Previous month" onClick={() => setViewDate(d => startOfMonth(addDays(startOfMonth(d), -1)))}
                    className={`${ui.button} ${ui.focusable}`} style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}>
                    <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                  </button>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{MONTHS_LONG[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</span>
                  <button type="button" aria-label="Next month" onClick={() => setViewDate(d => { const n = new Date(startOfMonth(d)); n.setMonth(n.getMonth() + 1); return n })}
                    className={`${ui.button} ${ui.focusable}`} style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}>
                    <ChevronRight size={16} strokeWidth={2} aria-hidden />
                  </button>
                </div>
                <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, textAlign: 'center', fontSize: 12, fontWeight: 600, color: color.muted }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={i}>{l}</span>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                  {gridDays.map(day => {
                    const key = keyOf(day)
                    const inMonth = day.getMonth() === monthAnchor.getMonth()
                    const has = daysWithClasses.has(key)
                    const isToday = key === todayKey
                    const isPastDay = key < todayKey
                    const inViewedWeek = weekKeys.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setViewDate(day)}
                        aria-label={`${DOW_LONG[dowIndex(day)]} ${day.getDate()} ${MONTHS_LONG[day.getMonth()]}${has ? ', has classes' : ''}${isToday ? ', today' : ''}`}
                        className={ui.focusable}
                        style={{
                          position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          height: 36, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, ...tabularNums,
                          border: isToday ? `2px solid ${color.primary}` : '2px solid transparent',
                          background: inViewedWeek ? color.primarySoft : 'transparent',
                          color: !inMonth ? '#B4BAB6' : isToday ? color.primaryInk : isPastDay ? '#6A726E' : color.ink,
                          fontWeight: isToday ? 700 : inMonth && !isPastDay ? 500 : 400,
                        }}
                      >
                        {day.getDate()}
                        {has && (
                          <span aria-hidden style={{
                            position: 'absolute', bottom: 3, left: '50%', marginLeft: -2.5, width: 5, height: 5, borderRadius: '50%',
                            background: isPastDay ? '#A9BDB4' : color.primary,
                          }} />
                        )}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: color.muted, borderTop: `1px solid ${color.divider}`, paddingTop: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: color.primary }} />Has classes
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${color.primary}`, boxSizing: 'border-box' }} />Today
                  </span>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
