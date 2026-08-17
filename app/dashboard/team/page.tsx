'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'

interface Teacher {
  id: string
  full_name: string
  email: string
  role: string
  profile: {
    slug: string
    display_name: string
    tagline: string | null
    bio: string | null
    photo_url: string | null
    is_page_published: boolean
    show_on_studio_page: boolean
  } | null
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    teacher_super: { bg: '#e8f5ee', color: '#085041', label: 'Super teacher' },
    teacher_general: { bg: '#e8eef8', color: '#1B4F8A', label: 'Teacher' },
    teacher_basic: { bg: '#f4f4f4', color: '#666', label: 'Basic teacher' },
    admin: { bg: '#fff3cd', color: '#7a4f00', label: 'Admin' },
    front_desk: { bg: '#f0ecf8', color: '#4B2D8A', label: 'Front desk' },
  }
  const s = styles[role] ?? { bg: '#f4f4f4', color: '#666', label: role }

  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '99px',
      fontSize: '12px',
      fontWeight: 500,
      backgroundColor: s.bg,
      color: s.color
    }}>
      {s.label}
    </span>
  )
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      backgroundColor: '#085041',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 600,
      flexShrink: 0
    }}>
      {initials}
    </div>
  )
}

export default function TeamPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    role: 'teacher_general'
  })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

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

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/teachers`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      if (res.ok) setTeachers(await res.json())
      setLoading(false)
    }
    load()
  }, [router])

  const handleInvite = async () => {
    if (!inviteForm.full_name || !inviteForm.email) {
      setInviteError('Name and email are required')
      return
    }
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/teachers/invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(inviteForm)
      }
    )

    const data = await res.json()

    if (res.ok) {
      setInviteSuccess(`${inviteForm.full_name} has been added to your team.`)
      setInviteForm({ full_name: '', email: '', role: 'teacher_general' })

      // Reload teachers
      const teachersRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/teachers`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (teachersRes.ok) setTeachers(await teachersRes.json())
    } else {
      setInviteError(data.error ?? 'Something went wrong')
    }
    setInviting(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="team" />
        <div style={{ marginLeft: '240px', flex: 1, padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <Sidebar active="team" />

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Team</h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} in your studio
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#085041',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Invite teacher
          </button>
        </div>

        {/* Teachers list */}
        {teachers.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '64px',
            textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No teachers yet</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
              Invite your first teacher to give them access to their sessions and students.
            </p>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{
                padding: '10px 24px',
                backgroundColor: '#085041',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Invite a teacher
            </button>
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
              gridTemplateColumns: '2fr 1fr 1fr 1fr 120px',
              padding: '12px 24px',
              backgroundColor: '#f4f4f4',
              borderBottom: '1px solid #e2e2e2',
              fontSize: '12px',
              fontWeight: 600,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <div>Teacher</div>
              <div>Role</div>
              <div>Landing page</div>
              <div>Visible on studio page</div>
              <div>Actions</div>
            </div>

            {teachers.map((teacher, i) => (
              <div
                key={teacher.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 120px',
                  padding: '16px 24px',
                  borderBottom: i < teachers.length - 1 ? '1px solid #f4f4f4' : 'none',
                  alignItems: 'center'
                }}
              >
                {/* Name + email */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar
                    name={teacher.full_name}
                    photoUrl={teacher.profile?.photo_url}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{teacher.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{teacher.email}</div>
                  </div>
                </div>

                {/* Role */}
                <div><RoleBadge role={teacher.role} /></div>

                {/* Landing page status */}
                <div style={{ fontSize: '13px' }}>
                  {teacher.profile?.is_page_published ? (
                    <span style={{ color: '#085041' }}>✓ Published</span>
                  ) : (
                    <span style={{ color: '#999' }}>Draft</span>
                  )}
                </div>

                {/* Show on studio page */}
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {teacher.profile?.show_on_studio_page ? 'Yes' : 'No'}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  
                    <a href={`/dashboard/team/${teacher.id}`}
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

      {/* Invite modal */}
      {showInviteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Invite a teacher</h2>
              <button
                onClick={() => { setShowInviteModal(false); setInviteError(''); setInviteSuccess('') }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jones"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(p => ({ ...p, full_name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #e2e2e2',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="sarah@yourstudio.com"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #e2e2e2',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #e2e2e2',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="teacher_super">Super teacher — full studio access</option>
                  <option value="teacher_general">Teacher — own sessions and students</option>
                  <option value="teacher_basic">Basic teacher — attendance only</option>
                  <option value="front_desk">Front desk — schedule and check-in</option>
                </select>

                {/* Role description */}
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  {inviteForm.role === 'teacher_super' && 'Can manage all sessions, view all members, issue passes and process bookings. Cannot change billing or org settings.'}
                  {inviteForm.role === 'teacher_general' && 'Can view and manage their own sessions and the students booked into them.'}
                  {inviteForm.role === 'teacher_basic' && 'Can add students to their sessions and mark attendance only. No access to member details.'}
                  {inviteForm.role === 'front_desk' && 'Can view the full schedule and check in members. No financial data.'}
                </p>
              </div>

              {inviteError && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fdecea',
                  borderRadius: '8px',
                  color: '#8b1a1a',
                  fontSize: '13px'
                }}>
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#e8f5ee',
                  borderRadius: '8px',
                  color: '#085041',
                  fontSize: '13px'
                }}>
                  {inviteSuccess}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => { setShowInviteModal(false); setInviteError(''); setInviteSuccess('') }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e2e2',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    color: '#444'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: inviting ? '#9fd6b8' : '#085041',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: inviting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {inviting ? 'Adding...' : 'Add to team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}