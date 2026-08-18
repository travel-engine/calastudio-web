'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { canManageSessions, canViewOccurrences } from '@/lib/roles'

// ── Types ─────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

interface TodayOccurrence {
  id: string
  starts_at: string
  status: 'scheduled' | 'cancelled' | 'completed'
  session: {
    name: string
    delivery_mode: 'in_person' | 'online' | 'hybrid'
    capacity_inperson: number | null
    capacity_online: number | null
  } | null
}

interface Activity {
  id: string
  text: string
  time: string
  type: 'booking' | 'cancel' | 'member' | 'pass'
}

// ── Components ────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#085041' }: StatCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      borderTop: `3px solid ${color}`,
      flex: 1,
      minWidth: '160px'
    }}>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>{value}</div>
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
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function SessionCard({ occurrence }: { occurrence: TodayOccurrence }) {
  const startsAt = new Date(occurrence.starts_at)
  const time = startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const session = occurrence.session
  const capacity = session?.delivery_mode === 'online' ? session.capacity_online : session?.capacity_inperson

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '12px'
    }}>
      {/* Time */}
      <div style={{
        minWidth: '68px',
        textAlign: 'center',
        backgroundColor: '#f4f4f4',
        borderRadius: '8px',
        padding: '8px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '2px' }}>
          {dayLabel(startsAt)}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#085041' }}>
          {time}
        </div>
      </div>

      {/* Details */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '2px' }}>
          {session?.name ?? 'Session'}
        </div>
        <div style={{ fontSize: '13px', color: '#666' }}>
          {session?.delivery_mode.replace('_', ' ') ?? ''}{capacity ? ` · Capacity ${capacity}` : ''}
        </div>
      </div>

      {/* Actions */}
      <a href={`/dashboard/bookings?occurrence=${occurrence.id}`} style={{
        padding: '6px 12px',
        backgroundColor: '#f4f4f4',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#444',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        textDecoration: 'none'
      }}>
        Manage roster
      </a>
    </div>
  )
}

function ActivityItem({ activity }: { activity: Activity }) {
  const icons: Record<string, string> = {
    booking: '📅',
    cancel: '❌',
    member: '👤',
    pass: '🎟'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 0',
      borderBottom: '1px solid #f4f4f4'
    }}>
      <span style={{ fontSize: '18px' }}>{icons[activity.type]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', color: '#1a1a1a' }}>{activity.text}</div>
        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{activity.time}</div>
      </div>
    </div>
  )
}

function SidebarLink({ href, icon, label, active }: {
  href: string
  icon: string
  label: string
  active?: boolean
}) {
  return (
    
      <a href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderRadius: '8px',
        backgroundColor: active ? '#e8f5ee' : 'transparent',
        color: active ? '#085041' : '#444',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        marginBottom: '2px'
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  )
}

// ── Dashboard ─────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('My Studio')
  const [userEmail, setUserEmail] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [upcomingOccurrences, setUpcomingOccurrences] = useState<TodayOccurrence[]>([])
  const [sessionsToday, setSessionsToday] = useState(0)
  const [sessionsLoading, setSessionsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUserEmail(session.user.email ?? '')

      const token = session.access_token
      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!orgRes.ok) return
      const org = await orgRes.json()

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const myRoles: string[] = roleRes.ok ? (await roleRes.json()).roles : []
      setRoles(myRoles)

      if (!canViewOccurrences(myRoles)) {
        setSessionsLoading(false)
        return
      }

      const now = new Date()
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(startOfToday)
      endOfToday.setDate(endOfToday.getDate() + 1)

      const occRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/occurrences?from=${now.toISOString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (occRes.ok) {
        const all: TodayOccurrence[] = await occRes.json()
        const scheduled = all.filter(o => o.status === 'scheduled')
        setSessionsToday(scheduled.filter(o => new Date(o.starts_at) < endOfToday).length)
        setUpcomingOccurrences(scheduled.slice(0, 3))
      }
      setSessionsLoading(false)
    }
    checkAuth()
  }, [router])

  const recentActivity: Activity[] = [
    { id: '1', text: 'Emma Thompson booked Morning Vinyasa', time: '2 minutes ago', type: 'booking' },
    { id: '2', text: 'James Wilson purchased a 10-class pass', time: '15 minutes ago', type: 'pass' },
    { id: '3', text: 'New member: Sophie Laurent joined', time: '1 hour ago', type: 'member' },
    { id: '4', text : 'Michael Chen cancelled Lunchtime Flow', time: '2 hours ago', type: 'cancel' },
    { id: '5', text: 'Anna Park booked Online Yin', time: '3 hours ago', type: 'booking' },
  ]

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>

      {/* Sidebar */}
      <Sidebar active="dashboard" roles={roles}/>

      {/* Main content */}
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>
              Good morning 👋
            </h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {canManageSessions(roles) && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <a href="/dashboard/sessions/new"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#085041',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
                >
                + New session
              </a>
            </div>
          )}
        </div>

        {/* Today at a glance */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <StatCard label="Sessions today" value={sessionsToday} />
          <StatCard label="Bookings today" value={28} sub="across all sessions" color="#1B4F8A" />
          <StatCard label="Revenue today" value="$420" sub="3 payments" color="#4B2D8A" />
          <StatCard label="Waitlisted" value={4} sub="for today's sessions" color="#7A4F00" />
        </div>

        {/* Two column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>

          {/* Upcoming sessions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a1a' }}>
                Next up
              </h2>
              <a href="/dashboard/schedule" style={{ fontSize: '13px', color: '#085041' }}>
                View all
              </a>
            </div>
            {sessionsLoading ? (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#666', fontSize: '13px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                Loading...
              </div>
            ) : upcomingOccurrences.length === 0 ? (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#666', fontSize: '13px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                Nothing coming up.
              </div>
            ) : (
              upcomingOccurrences.map(occurrence => (
                <SessionCard key={occurrence.id} occurrence={occurrence} />
              ))
            )}
          </div>

          {/* Right column */}
          <div>
            {/* Quick stats */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Last 7 days</h3>
              {[
                { label: 'Revenue', value: '$2,840' },
                { label: 'New members', value: '7' },
                { label: 'Sessions run', value: '14' },
                { label: 'Avg fill rate', value: '78%' },
              ].map((stat, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < 3 ? '1px solid #f4f4f4' : 'none'
                }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>{stat.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Recent activity */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Recent activity</h3>
              {recentActivity.map(activity => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}