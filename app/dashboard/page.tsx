'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'

// ── Types ─────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

interface Session {
  id: string
  name: string
  time: string
  instructor: string
  booked: number
  capacity: number
  mode: string
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

function SessionCard({ session }: { session: Session }) {
  const fillPct = Math.round((session.booked / session.capacity) * 100)
  const isFull = session.booked >= session.capacity
  const isLow = session.capacity - session.booked <= 3

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
        minWidth: '60px',
        textAlign: 'center',
        backgroundColor: '#f4f4f4',
        borderRadius: '8px',
        padding: '8px'
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#085041' }}>
          {session.time}
        </div>
      </div>

      {/* Details */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '2px' }}>
          {session.name}
        </div>
        <div style={{ fontSize: '13px', color: '#666' }}>
          {session.instructor} · {session.mode}
        </div>
      </div>

      {/* Capacity */}
      <div style={{ textAlign: 'right', minWidth: '80px' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: isFull ? '#8b1a1a' : isLow ? '#7a4f00' : '#085041'
        }}>
          {isFull ? 'Full' : `${session.booked}/${session.capacity}`}
        </div>
        <div style={{
          height: '4px',
          backgroundColor: '#e2e2e2',
          borderRadius: '99px',
          marginTop: '6px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${fillPct}%`,
            backgroundColor: isFull ? '#8b1a1a' : isLow ? '#f59e0b' : '#085041',
            borderRadius: '99px'
          }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <ActionButton>Roster</ActionButton>
        <ActionButton>Check in</ActionButton>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        backgroundColor: '#f4f4f4',
        border: 'none',
        borderRadius: '6px',
        fontSize: '13px',
        cursor: 'pointer',
        color: '#444',
        fontWeight: 500,
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </button>
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

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUserEmail(session.user.email ?? '')
    }
    checkAuth()
  }, [router])

  // Placeholder data — will be replaced with real API calls in Sprint 13
  const todaySessions: Session[] = [
    { id: '1', name: 'Morning Vinyasa', time: '7:00 AM', instructor: 'Sarah', booked: 10, capacity: 12, mode: 'In-person' },
    { id: '2', name: 'Lunchtime Flow', time: '12:00 PM', instructor: 'Sarah', booked: 6, capacity: 12, mode: 'In-person' },
    { id: '3', name: 'Online Yin', time: '6:00 PM', instructor: 'Sarah', booked: 12, capacity: 12, mode: 'Online' },
  ]

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
      <Sidebar active="dashboard"/>
     
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
        </div>

        {/* Today at a glance */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <StatCard label="Sessions today" value={3} />
          <StatCard label="Bookings today" value={28} sub="across all sessions" color="#1B4F8A" />
          <StatCard label="Revenue today" value="$420" sub="3 payments" color="#4B2D8A" />
          <StatCard label="Waitlisted" value={4} sub="for today's sessions" color="#7A4F00" />
        </div>

        {/* Two column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>

          {/* Today's sessions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a1a' }}>
                Today&apos;s sessions
              </h2>
              <a href="/dashboard/sessions" style={{ fontSize: '13px', color: '#085041' }}>
                View all
              </a>
            </div>
            {todaySessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
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