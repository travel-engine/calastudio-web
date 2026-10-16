'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarCheck, CreditCard, Plus, TriangleAlert, Dot } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import { canManageSessions, canManageBookings, canManageOccurrences, canViewOccurrences, canViewAllReports } from '@/lib/roles'
import { formatClock, formatDayLabel, formatDayMonth, formatShortDate, formatWhen } from '@/lib/dates'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Button, CapacityBar, Card, Chip, PageHeader, StatTile } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

const API = process.env.NEXT_PUBLIC_API_URL

// ── Types (GET /organisations/{id}/dashboard/home) ─────────
interface UpcomingOccurrence {
  occurrence_id: string
  session_name: string
  starts_at: string
  location_name: string | null
  instructor_name: string | null
  booked: number
  capacity: number | null
}
interface ActivityItemData { at: string; text: string }
interface Birthday { member_id: string; name: string; date: string; days_until: number }
interface HomeDashboard {
  week_spots: { booked: number; capacity: number }
  new_members_this_week: number
  upcoming: UpcomingOccurrence[]
  activity: ActivityItemData[]
  birthdays: Birthday[]
}

const rosterHref = (occurrenceId: string) => `/dashboard/occurrences/${occurrenceId}`

function greeting(now: Date) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// "Full" / "Almost full" / "No teacher" — the chip beside a class; words carry the status.
function flagFor(occ: UpcomingOccurrence): { text: string; tone: 'warn' | 'danger' } | null {
  if (occ.instructor_name == null) return { text: 'No teacher', tone: 'warn' }
  if (occ.capacity != null && occ.capacity > 0) {
    const r = occ.booked / occ.capacity
    if (r >= 1) return { text: 'Full', tone: 'danger' }
    if (r >= 0.8) return { text: 'Almost full', tone: 'warn' }
  }
  return null
}

// Activity arrives as one sentence ("<member> booked <class>" / "<member> purchased <pass>").
// Split it for presentation only — the bold name and the icon — and fall back to the plain text.
function splitActivity(text: string): { who: string; verb: string; what: string; kind: 'booked' | 'bought' | 'other' } {
  const m = text.match(/^(.+?) (booked|purchased) (.+)$/)
  if (!m) return { who: '', verb: '', what: text, kind: 'other' }
  return { who: m[1], verb: m[2] === 'purchased' ? 'bought' : 'booked', what: m[3], kind: m[2] === 'purchased' ? 'bought' : 'booked' }
}

function NextUpRow({ occ, timeZone }: { occ: UpcomingOccurrence; timeZone: string | null }) {
  const day = formatDayLabel(occ.starts_at, timeZone)
  const flag = flagFor(occ)
  const meta = [occ.location_name, occ.instructor_name ?? 'No teacher'].filter(Boolean).join(' · ')
  return (
    <Link
      href={rosterHref(occ.occurrence_id)}
      className={`${ui.rowLink} ${ui.focusable}`}
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '14px 20px',
        borderTop: `1px solid ${color.divider}`, textDecoration: 'none', color: color.ink,
        ['--hover-bg' as string]: '#F7F8F5',
      }}
    >
      <div style={{ width: 92, flex: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: color.muted }}>
          {day === 'Today' || day === 'Tomorrow' ? day : formatShortDate(occ.starts_at, timeZone)}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, ...tabularNums }}>{formatClock(occ.starts_at, timeZone)}</span>
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{occ.session_name}</span>
        {meta && <span style={{ fontSize: 14, color: color.muted }}>{meta}</span>}
      </div>
      {flag && <Chip tone={flag.tone}>{flag.text}</Chip>}
      <CapacityBar booked={occ.booked} capacity={occ.capacity} />
    </Link>
  )
}

function ActivityRow({ item, timeZone }: { item: ActivityItemData; timeZone: string | null }) {
  const a = splitActivity(item.text)
  const icon = a.kind === 'booked'
    ? { Icon: CalendarCheck, bg: color.primarySoft, ink: color.primaryInk }
    : a.kind === 'bought'
      ? { Icon: CreditCard, bg: color.infoBg, ink: color.infoInk }
      : { Icon: Dot, bg: color.neutralChip, ink: color.neutralInk }
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 20px', alignItems: 'flex-start' }}>
      <span aria-hidden style={{
        width: 32, height: 32, flex: 'none', borderRadius: '50%', background: icon.bg, color: icon.ink,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <icon.Icon size={16} strokeWidth={2} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, lineHeight: 1.35 }}>
          {a.who && <strong style={{ fontWeight: 600 }}>{a.who}</strong>}
          {a.verb && ` ${a.verb} `}
          <span style={{ color: a.who ? color.ink2 : color.ink }}>{a.what}</span>
        </span>
        <span style={{ fontSize: 13, color: color.muted, ...tabularNums }}>{formatDayMonth(item.at, timeZone)}</span>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<string[]>([])
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  // The greeting and date depend on the clock, so they're worked out in the browser after mount:
  // this page is prerendered at build time, and baking them in caused a hydration mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])
  const [home, setHome] = useState<HomeDashboard | null>(null)
  const [fallbackUpcoming, setFallbackUpcoming] = useState<UpcomingOccurrence[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }
      const token = ctx.token
      const auth = { headers: { Authorization: `Bearer ${token}` } }
      const org = ctx.org
      const myRoles: string[] = ctx.roles
      setRoles(myRoles)
      setTimeZone(org.timezone ?? null)
      setFirstName(ctx.firstName)

      if (canViewAllReports(myRoles)) {
        const res = await fetch(`${API}/api/organisations/${org.id}/dashboard/home`, auth)
        if (res.ok) setHome(await res.json())
      } else if (canViewOccurrences(myRoles)) {
        // No home payload for non-admins — fall back to the plain upcoming-occurrences list.
        const res = await fetch(`${API}/api/organisations/${org.id}/occurrences?from=${new Date().toISOString()}`, auth)
        if (res.ok) {
          const all = await res.json()
          setFallbackUpcoming(
            all
              .filter((o: { status: string }) => o.status === 'scheduled')
              .slice(0, 6)
              .map((o: { id: string; session?: { name?: string }; starts_at: string; booked: number; capacity: number | null }) => ({
                occurrence_id: o.id,
                session_name: o.session?.name ?? 'Session',
                starts_at: o.starts_at,
                location_name: null,
                // Unknown in this payload; '' (not null) so the row doesn't claim "No teacher".
                instructor_name: '',
                booked: o.booked,
                capacity: o.capacity,
              })),
          )
        }
      }
      setLoading(false)
    }
    load()
  }, [router])

  const upcoming = home?.upcoming ?? fallbackUpcoming ?? []
  const week = home?.week_spots
  const next = upcoming[0]
  const noTeacher = home ? home.upcoming.filter(o => o.instructor_name == null) : []
  const today = now ? now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timeZone ?? undefined }) : ' '

  return (
    <div className={styles.shell}>
      <Sidebar active="dashboard" roles={roles} />

      <div className={styles.main}>
        <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <PageHeader
            eyebrow={today}
            title={now ? `${greeting(now)}${firstName ? `, ${firstName}` : ''}` : 'Dashboard'}
            actions={<>
              {canManageBookings(roles) && <Button href="/dashboard/schedule">Add booking</Button>}
              {canManageSessions(roles) && (
                <Button href="/dashboard/sessions/new" variant="primary" icon={<Plus size={18} strokeWidth={2} aria-hidden />}>New session</Button>
              )}
            </>}
          />

          {loading ? (
            <Card padded style={{ textAlign: 'center', color: color.muted, padding: 48 }}>Loading…</Card>
          ) : (
            <>
              {home && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  {week && week.capacity > 0 && week.booked > 0 ? (
                    <StatTile
                      label="Booked this week" href="/dashboard/schedule"
                      value={week.booked} suffix={`/ ${week.capacity} spots`}
                      bar={week.booked / week.capacity}
                      sub={`${Math.round((week.booked / week.capacity) * 100)}% of this week's spots`}
                    />
                  ) : (
                    <StatTile label="Booked this week" href="/dashboard/schedule">
                      <span style={{ fontSize: 15, lineHeight: 1.4, color: color.ink2 }}>
                        {week && week.capacity > 0
                          ? 'No bookings yet. Share your booking page to start filling classes.'
                          : 'No classes scheduled this week.'}
                      </span>
                    </StatTile>
                  )}
                  <StatTile label="New members this week" href="/dashboard/members" value={home.new_members_this_week} />
                  <StatTile label="Next session" href={next ? rosterHref(next.occurrence_id) : '/dashboard/schedule'}
                    sub={next ? [next.session_name, next.location_name].filter(Boolean).join(' · ') : undefined}>
                    <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, ...tabularNums }}>
                      {next ? formatWhen(next.starts_at, timeZone) : 'Nothing scheduled'}
                    </span>
                  </StatTile>
                  <StatTile label="Birthdays · next 30 days" href="/dashboard/members"
                    sub={home.birthdays.length === 0
                      ? 'Birthdays show here once members add a date of birth.'
                      : home.birthdays.length > 1 ? `and ${home.birthdays.length - 1} more` : undefined}>
                    {home.birthdays.length === 0 ? (
                      <span style={{ fontSize: 20, fontWeight: 600 }}>None coming up</span>
                    ) : (
                      <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>
                        {home.birthdays[0].name}
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: color.ink2 }}>
                          {home.birthdays[0].days_until === 0 ? 'Today' : home.birthdays[0].days_until === 1 ? 'Tomorrow' : formatDayMonth(home.birthdays[0].date)}
                        </span>
                      </span>
                    )}
                  </StatTile>
                </div>
              )}

              {/* Attention: the next classes that have no teacher. Hidden when there are none. */}
              {noTeacher.length > 0 && (
                <section aria-labelledby="no-teacher-heading" style={{
                  background: '#FBF4E6', border: '1px solid #EBD9B4', borderRadius: 14,
                  padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TriangleAlert size={20} strokeWidth={2} color={color.warnInk} aria-hidden />
                    <h2 id="no-teacher-heading" style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#4A2E05' }}>
                      {noTeacher.length === 1 ? '1 upcoming class has no teacher' : `${noTeacher.length} upcoming classes have no teacher`}
                    </h2>
                  </div>
                  {noTeacher.map(o => (
                    <div key={o.occurrence_id} style={{
                      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      padding: '10px 14px', background: color.surface, borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 15 }}>
                        <strong style={{ fontWeight: 600 }}>{o.session_name}</strong>
                        <span style={{ color: color.muted }}>
                          {' · '}{formatShortDate(o.starts_at, timeZone)}, {formatClock(o.starts_at, timeZone)}
                          {o.location_name ? ` · ${o.location_name}` : ''}
                        </span>
                      </span>
                      {canManageOccurrences(roles) && <Button size="sm" href={rosterHref(o.occurrence_id)}>Assign teacher</Button>}
                    </div>
                  ))}
                </section>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.cardGap, alignItems: 'flex-start' }}>
                <Card style={{ flex: '999 1 520px', minWidth: 0, overflow: 'hidden' }} aria-labelledby="next-up-heading">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px' }}>
                    <h2 id="next-up-heading" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Next up</h2>
                    <Link href="/dashboard/schedule" className={ui.focusable} style={{ fontSize: 14, fontWeight: 600, color: color.primary, textDecoration: 'none' }}>
                      Full schedule
                    </Link>
                  </div>
                  {upcoming.length === 0 ? (
                    <p style={{ margin: 0, padding: '20px', borderTop: `1px solid ${color.divider}`, color: color.muted, fontSize: 15 }}>
                      Nothing coming up.
                    </p>
                  ) : (
                    upcoming.map(occ => <NextUpRow key={occ.occurrence_id} occ={occ} timeZone={timeZone} />)
                  )}
                </Card>

                {home && (
                  <Card style={{ flex: '1 1 320px', minWidth: 0, overflow: 'hidden', paddingBottom: 8 }} aria-labelledby="activity-heading">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 8px' }}>
                      <h2 id="activity-heading" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Recent activity</h2>
                      <Link href="/dashboard/audit-log" className={ui.focusable} style={{ fontSize: 14, fontWeight: 600, color: color.primary, textDecoration: 'none' }}>
                        Activity log
                      </Link>
                    </div>
                    {home.activity.length === 0 ? (
                      <p style={{ margin: 0, padding: '12px 20px', color: color.muted, fontSize: 15 }}>Nothing yet.</p>
                    ) : (
                      home.activity.map((a, i) => <ActivityRow key={i} item={a} timeZone={timeZone} />)
                    )}
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
