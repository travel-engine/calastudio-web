'use client'

import { useEffect, useState } from 'react'
import { getOrgContext } from '@/lib/orgContext'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { canManageSessions, canViewOccurrences, canViewAllReports } from '@/lib/roles'
import { formatDate, formatDateWithWeekday, formatRelativeShort } from '@/lib/dates'
import styles from '@/app/dashboard/dashboard.module.css'

const API = process.env.NEXT_PUBLIC_API_URL

// ── Types ─────────────────────────────────────────────────
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

// ── Components ────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#085041' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '12px', padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${color}`,
      flex: 1, minWidth: '160px',
    }}>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function dayLabel(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return formatDateWithWeekday(date)
}

function SessionCard({ occ }: { occ: UpcomingOccurrence }) {
  const startsAt = new Date(occ.starts_at)
  const time = startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const isFull = occ.capacity !== null && occ.booked >= occ.capacity
  const meta = [occ.instructor_name, occ.location_name].filter(Boolean).join(' · ')

  return (
    <a href={`/dashboard/occurrences/${occ.occurrence_id}`} style={{
      backgroundColor: 'white', borderRadius: '12px', padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', textDecoration: 'none', color: 'inherit',
    }}>
      <div style={{ minWidth: '72px', textAlign: 'center', backgroundColor: '#f4f4f4', borderRadius: '8px', padding: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '2px' }}>{dayLabel(startsAt)}</div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#085041' }}>{time}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '2px' }}>{occ.session_name}</div>
        {meta && <div style={{ fontSize: '13px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      <span style={{
        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap',
        backgroundColor: isFull ? '#fdecea' : '#e8f5ee', color: isFull ? '#8b1a1a' : '#085041',
      }}>
        {occ.capacity === null ? occ.booked : `${occ.booked}/${occ.capacity}`}
      </span>
    </a>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{title}</h3>
      {children}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// ── Dashboard ─────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<string[]>([])
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
                instructor_name: null,
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
  const weekPct = week && week.capacity > 0 ? Math.round((week.booked / week.capacity) * 100) : null
  const nextStart = upcoming[0] ? new Date(upcoming[0].starts_at) : null

  return (
    <div className={styles.shell}>
      <Sidebar active="dashboard" roles={roles} />

      <div className={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>{greeting()} 👋</h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              {`${new Date().toLocaleDateString(undefined, { weekday: 'long' })} ${formatDate(new Date())}`}
            </p>
          </div>
          {canManageSessions(roles) && (
            <a href="/dashboard/sessions/new" style={{
              padding: '10px 20px', backgroundColor: '#085041', color: 'white',
              borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
            }}>
              + New session
            </a>
          )}
        </div>

        {loading ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            Loading…
          </div>
        ) : (
          <>
            {home && (
              <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
                <StatCard
                  label="This week"
                  value={week ? `${week.booked}${week.capacity > 0 ? ` / ${week.capacity}` : ''}` : '—'}
                  sub={weekPct !== null ? `${weekPct}% of capacity booked` : 'spots booked'}
                />
                <StatCard label="New members this week" value={home.new_members_this_week} color="#1B4F8A" />
                <StatCard
                  label="Next session"
                  value={nextStart ? dayLabel(nextStart) : '—'}
                  sub={nextStart ? nextStart.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'nothing scheduled'}
                  color="#7A4F00"
                />
                <StatCard label="Birthdays (30 days)" value={home.birthdays.length} color="#4B2D8A" />
              </div>
            )}

            <div className={styles.twoCol} style={{ display: 'grid', gridTemplateColumns: home ? '1fr 360px' : '1fr', gap: '24px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a1a' }}>Next up</h2>
                  <a href="/dashboard/schedule" style={{ fontSize: '13px', color: '#085041' }}>View all</a>
                </div>
                {upcoming.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#666', fontSize: '13px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    Nothing coming up.
                  </div>
                ) : (
                  upcoming.map(occ => <SessionCard key={occ.occurrence_id} occ={occ} />)
                )}
              </div>

              {home && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <Panel title="Recent activity">
                    {home.activity.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#999', padding: '4px 0' }}>Nothing yet.</div>
                    ) : (
                      home.activity.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: i < home.activity.length - 1 ? '1px solid #f4f4f4' : 'none' }}>
                          <span style={{ color: '#c2c2c2', lineHeight: '20px' }}>•</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', color: '#1a1a1a' }}>{a.text}</div>
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{formatRelativeShort(a.at)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </Panel>

                  <Panel title="Upcoming birthdays">
                    {home.birthdays.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#999', padding: '4px 0' }}>None in the next 30 days.</div>
                    ) : (
                      home.birthdays.map(b => (
                        <div key={b.member_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f4f4f4', fontSize: '13px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                          <span style={{ color: '#666', whiteSpace: 'nowrap' }}>
                            {formatDate(b.date)} · {b.days_until === 0 ? 'today' : b.days_until === 1 ? 'tomorrow' : `in ${b.days_until} days`}
                          </span>
                        </div>
                      ))
                    )}
                  </Panel>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
