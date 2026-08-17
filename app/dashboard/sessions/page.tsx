'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Session {
  id: string
  name: string
  session_type: string
  delivery_mode: string
  duration_minutes: number
  capacity_inperson: number | null
  capacity_online: number | null
  price_inperson: number | null
  price_online: number | null
  visibility: string
  is_recurring: boolean
  location_name: string | null
  is_active: boolean
}

function Badge({ text }: { text: string | null | undefined; color?: string }) {
    if (!text) return null
  
    const colors: Record<string, { bg: string; text: string }> = {
      in_person: { bg: '#e8f5ee', text: '#085041' },
      online: { bg: '#e8eef8', text: '#1B4F8A' },
      hybrid: { bg: '#f0ecf8', text: '#4B2D8A' },
      public: { bg: '#e8f5ee', text: '#085041' },
      private: { bg: '#fff3cd', text: '#7a4f00' },
      draft: { bg: '#f4f4f4', text: '#666' },
      class: { bg: '#e8f5ee', text: '#085041' },
      workshop: { bg: '#f0ecf8', text: '#4B2D8A' },
    }
    const style = colors[text] ?? { bg: '#f4f4f4', text: '#666' }
  
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '99px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.text
      }}>
        {text.replace('_', ' ')}
      </span>
    )
  }

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const token = session.access_token

      // Get org ID from API
      const orgRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!orgRes.ok) {
        router.push('/onboarding')
        return
      }

      const org = await orgRes.json()
      setOrgId(org.id)

      // Get sessions
      const sessionsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/sessions`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data)
      }

      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>

      {/* Sidebar */}
      <div style={{
        width: '240px',
        backgroundColor: 'white',
        borderRight: '1px solid #e2e2e2',
        padding: '24px 16px',
        position: 'fixed',
        height: '100vh'
      }}>
        <div style={{
          backgroundColor: '#085041',
          color: 'white',
          fontWeight: 700,
          fontSize: '16px',
          padding: '8px 16px',
          borderRadius: '8px',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          CalaStudio
        </div>
        <nav>
          {[
            { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
            { href: '/dashboard/sessions', icon: '📅', label: 'Sessions', active: true },
            { href: '/dashboard/members', icon: '👥', label: 'Members' },
            { href: '/dashboard/bookings', icon: '🎟', label: 'Bookings' },
            { href: '/dashboard/passes', icon: '💳', label: 'Passes' },
            { href: '/dashboard/memberships', icon: '⭐', label: 'Memberships' },
            { href: '/dashboard/reports', icon: '📊', label: 'Reports' },
            { href: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
          ].map(item => (
            
              <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: item.active ? '#e8f5ee' : 'transparent',
                color: item.active ? '#085041' : '#444',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: item.active ? 600 : 400,
                marginBottom: '2px'
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Sessions</h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} in your studio
            </p>
          </div>
          
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

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '64px',
            textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No sessions yet</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
              Create your first session and your booking page will go live immediately.
            </p>
            
              <a href="/dashboard/sessions/new"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                backgroundColor: '#085041',
                color: 'white',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              Create a session
            </a>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            overflow: 'hidden'
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px',
              padding: '12px 24px',
              backgroundColor: '#f4f4f4',
              borderBottom: '1px solid #e2e2e2',
              fontSize: '12px',
              fontWeight: 600,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <div>Session</div>
              <div>Type</div>
              <div>Mode</div>
              <div>Capacity</div>
              <div>Price</div>
              <div>Actions</div>
            </div>

            {/* Session rows */}
            {sessions.map((session, i) => (
              <div
                key={session.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px',
                  padding: '16px 24px',
                  borderBottom: i < sessions.length - 1 ? '1px solid #f4f4f4' : 'none',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    {session.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {session.duration_minutes} min
                    {session.location_name ? ` · ${session.location_name}` : ''}
                    {session.is_recurring ? ' · Recurring' : ' · One-off'}
                  </div>
                </div>
                <div><Badge text={session.session_type} /></div>
                <div><Badge text={session.delivery_mode} /></div>
                <div style={{ fontSize: '14px', color: '#444' }}>
                  {session.capacity_inperson ?? session.capacity_online ?? '∞'}
                </div>
                <div style={{ fontSize: '14px', color: '#444' }}>
                  {session.price_inperson ? `$${session.price_inperson}` : 'Free'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  
                    <a href={`/dashboard/sessions/${session.id}`}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f4f4f4',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#444',
                      textDecoration: 'none',
                      fontWeight: 500
                    }}
                  >
                    Edit
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}