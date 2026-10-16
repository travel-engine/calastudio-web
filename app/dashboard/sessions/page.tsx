'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Plus, Search } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewSessions, canManageSessions, seesOnlyOwnSessions } from '@/lib/roles'
import { formatClock, formatShortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, CapacityBar, Card, Chip, EmptyState, PageHeader, Segmented, controlStyle } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

interface Session {
  id: string
  name: string
  description?: string | null
  session_type: string
  delivery_mode: string
  duration_minutes: number
  capacity: number | null
  price: number | null
  currency?: string | null
  visibility: string
  is_recurring: boolean
  location_name: string | null
  instructor_id: string | null
  first_occurrence_starts_at: string | null
  photo_url?: string | null
}

// The next class per session comes from the occurrences list, which carries the teacher's name,
// booked count and capacity — the sessions list itself doesn't.
interface UpcomingOccurrence {
  id: string
  session_id: string
  starts_at: string
  status: string
  booked: number
  capacity: number | null
  instructor_name: string | null
}

const venueOf = (s: Session) => (s.delivery_mode === 'online' ? 'Online' : s.location_name?.trim() || 'No venue set')

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [nextBySession, setNextBySession] = useState<Record<string, UpcomingOccurrence>>({})
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('AUD')
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [venue, setVenue] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const org = ctx.org
      setCurrency(org.currency ?? 'AUD')
      setTimeZone(org.timezone ?? null)
      setRoles(ctx.roles)

      if (!canViewSessions(ctx.roles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      const api = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}`
      const auth = { headers: { Authorization: `Bearer ${ctx.token}` } }
      const [sessionsRes, occRes] = await Promise.all([
        fetch(`${api}/sessions`, auth),
        fetch(`${api}/occurrences?from=${new Date().toISOString()}`, auth),
      ])
      if (sessionsRes.ok) setSessions(await sessionsRes.json())
      if (occRes.ok) {
        const occs: UpcomingOccurrence[] = await occRes.json()
        const next: Record<string, UpcomingOccurrence> = {}
        for (const o of occs) {
          if (o.status !== 'scheduled') continue
          const cur = next[o.session_id]
          if (!cur || o.starts_at < cur.starts_at) next[o.session_id] = o
        }
        setNextBySession(next)
      }
      setLoading(false)
    }
    load()
  }, [router])

  const venues = useMemo(() => [...new Set(sessions.map(venueOf))].sort(), [sessions])
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = sessions.filter(s => (venue === 'all' || venueOf(s) === venue) && (!q || s.name.toLowerCase().includes(q)))
    const map = new Map<string, Session[]>()
    for (const s of shown) {
      const v = venueOf(s)
      if (!map.has(v)) map.set(v, [])
      map.get(v)!.push(s)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [sessions, venue, query])

  // "Sat · 7:00 am · 60 min · weekly" — the schedule line under a session's name.
  const scheduleLine = (s: Session) => {
    const parts: string[] = []
    if (s.first_occurrence_starts_at) {
      const start = s.first_occurrence_starts_at
      parts.push(s.is_recurring ? formatShortDate(start, timeZone).split(' ')[0] : formatShortDate(start, timeZone))
      parts.push(formatClock(start, timeZone))
    }
    parts.push(`${s.duration_minutes} min`)
    parts.push(s.is_recurring ? 'weekly' : 'one-off')
    return parts.join(' · ')
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="sessions" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  const own = seesOnlyOwnSessions(roles)

  return (
    <div className={styles.shell}>
      <Sidebar active="sessions" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader
              eyebrow={`${sessions.length} session${sessions.length !== 1 ? 's' : ''} ${own ? 'assigned to you' : 'in your studio'}`}
              title="Sessions"
              actions={canManageSessions(roles) && (
                <Button href="/dashboard/sessions/new" variant="primary" icon={<Plus size={18} strokeWidth={2} aria-hidden />}>New session</Button>
              )}
            />

            {sessions.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<CalendarDays size={22} strokeWidth={1.8} />}
                  message={canManageSessions(roles)
                    ? 'Create your first session and your booking page goes live straight away.'
                    : own
                      ? "No sessions assigned to you yet. When the studio makes you the teacher on a session, it'll show up here."
                      : "Your studio hasn't added any sessions yet."}
                  action={canManageSessions(roles) ? <Button href="/dashboard/sessions/new" variant="primary">Create a session</Button> : undefined}
                />
              </Card>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  {venues.length > 1 ? (
                    <Segmented
                      label="Venue"
                      value={venue}
                      onChange={setVenue}
                      options={[{ value: 'all', label: 'All venues' }, ...venues.map(v => ({ value: v, label: v }))]}
                    />
                  ) : <span />}
                  <label style={{ position: 'relative', flex: '0 1 320px', minWidth: 220 }}>
                    <span className={styles.srOnly}>Filter sessions by name</span>
                    <Search size={18} strokeWidth={2} color={color.muted} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by name" style={{ ...controlStyle, paddingLeft: 38 }} />
                  </label>
                </div>

                {groups.length === 0 ? (
                  <Card><EmptyState message="No sessions match that filter." /></Card>
                ) : groups.map(([venueName, list]) => (
                  <Card key={venueName} style={{ overflow: 'hidden' }} aria-label={venueName}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '16px 20px' }}>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{venueName}</h2>
                      <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>{list.length} session{list.length !== 1 ? 's' : ''}</span>
                    </div>
                    {list.map(s => {
                      const next = nextBySession[s.id]
                      const teacher = next?.instructor_name
                      return (
                        <Link
                          key={s.id}
                          href={`/dashboard/sessions/${s.id}`}
                          className={`${ui.rowLink} ${ui.focusable}`}
                          style={{
                            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px', padding: '14px 20px',
                            borderTop: `1px solid ${color.divider}`, textDecoration: 'none', color: color.ink,
                            ['--hover-bg' as string]: '#F7F8F5',
                          }}
                        >
                          <span style={{
                            width: 48, height: 48, borderRadius: radius.control, flex: 'none', overflow: 'hidden',
                            background: color.primarySoft, color: color.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {s.photo_url
                              ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <CalendarDays size={20} strokeWidth={1.8} aria-hidden />}
                          </span>
                          <span style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 16, fontWeight: 600 }} title={s.description ?? undefined}>{s.name}</span>
                              {s.visibility === 'draft' && <Chip tone="warn">Draft</Chip>}
                              {s.visibility === 'private' && <Chip>Private</Chip>}
                            </span>
                            <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>{scheduleLine(s)}</span>
                          </span>
                          <span style={{ width: 150, flex: 'none' }}>
                            {s.instructor_id == null ? <Chip tone="warn">No teacher</Chip> : teacher ? <Chip>{teacher}</Chip> : null}
                          </span>
                          <span style={{ width: 90, flex: 'none', fontSize: 15, fontWeight: 600, ...tabularNums }}>
                            {s.price ? formatMoney(s.price, s.currency ?? currency) : 'Free'}
                          </span>
                          <span style={{ width: 170, flex: 'none', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            {next ? (
                              <>
                                <span style={{ fontSize: 13, color: color.muted, ...tabularNums }}>Next {formatShortDate(next.starts_at, timeZone)}</span>
                                <CapacityBar booked={next.booked} capacity={next.capacity ?? s.capacity} width={90} layout="inline" />
                              </>
                            ) : (
                              <span style={{ fontSize: 13, color: color.muted }}>No upcoming classes</span>
                            )}
                          </span>
                        </Link>
                      )
                    })}
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
