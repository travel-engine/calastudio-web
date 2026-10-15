'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getOrgContext } from '@/lib/orgContext'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewSessions, canManageSessions } from '@/lib/roles'
import styles from '@/app/dashboard/dashboard.module.css'

interface Session {
  id: string
  name: string
  session_type: string
  delivery_mode: string
  duration_minutes: number
  capacity: number | null
  price: number | null
  visibility: string
  is_recurring: boolean
  location_name: string | null
  is_active: boolean
  photo_url?: string | null
}

function Badge({ text }: { text: string | null | undefined; color?: string }) {
    if (!text) return null
  
    const colors: Record<string, { bg: string; text: string }> = {
      in_person: { bg: '#e8f5ee', text: '#085041' },
      online: { bg: '#e8eef8', text: '#1B4F8A' },
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
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const token = ctx.token
      const org = ctx.org
      setOrgId(org.id)
      const myRoles: string[] = ctx.roles
      setRoles(myRoles)

      if (!canViewSessions(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

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
    const handleDuplicate = async (sessionId: string) => {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
      
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/sessions/${sessionId}/duplicate`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` }
          }
        )
      
        if (res.ok) {
          // Reload sessions
          const sessionsRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/sessions`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          )
          if (sessionsRes.ok) {
            setSessions(await sessionsRes.json())
          }
        }
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
    <div className={styles.shell}>

      {/* Sidebar */}
      <Sidebar active="sessions" roles={roles}/>

      {/* Main */}
      <div className={styles.main}>

        {forbidden ? <Forbidden /> : <>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Sessions</h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} in your studio
            </p>
          </div>
          {canManageSessions(roles) && (
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
          )}
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
              {canManageSessions(roles)
                ? 'Create your first session and your booking page will go live immediately.'
                : "Your studio hasn't added any sessions yet."}
            </p>
            {canManageSessions(roles) && (
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
            )}
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            overflow: 'hidden'
          }}>
            {/* Table header */}
            <div className={styles.tableHeaderRow} style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px'
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
                className={styles.tableRow}
                style={{
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px',
                  borderBottom: i < sessions.length - 1 ? '1px solid #f4f4f4' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f4f4f4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                  }}>
                    {session.photo_url ? (
                      <img src={session.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '14px' }}>📅</span>
                    )}
                  </div>
                  <div>
                    <div
                      style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', cursor: 'default' }}
                      title={(session as any).description ?? undefined}
                    >
                      {session.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {(session as any).duration_minutes} min
                      {(session as any).location_name ? ` · ${(session as any).location_name}` : ''}
                      {(session as any).is_recurring ? ' · Weekly' : ' · One-off'}
                    </div>
                  </div>
                </div>
                <div><Badge text={session.session_type} /></div>
                <div><Badge text={session.delivery_mode} /></div>
                <div style={{ fontSize: '14px', color: '#444' }}>
                  {session.capacity ?? '∞'}
                </div>
                <div style={{ fontSize: '14px', color: '#444' }}>
                  {session.price ? `$${session.price}` : 'Free'}
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
                    {canManageSessions(roles) ? 'Edit' : 'View'}
                  </a>
                  {canManageSessions(roles) && (
                    <a href={`/dashboard/sessions/new?copy=${session.id}`}
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
                      Copy
                      </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </>}
      </div>
    </div>
  )
}