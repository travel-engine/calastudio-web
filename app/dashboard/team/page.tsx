'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import Forbidden from '../../components/Forbidden'
import Toast from '../../components/Toast'
import { canViewTeam, canResendTeacherInvite } from '@/lib/roles'
import { displayName } from '@/lib/names'
import styles from '@/app/dashboard/dashboard.module.css'

interface Teacher {
  id: string
  first_name: string
  last_name: string
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
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'teacher_general'
  })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

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

      if (!canViewTeam(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

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
    if (!inviteForm.first_name.trim() || !inviteForm.last_name.trim() || !inviteForm.email) {
      setInviteError('First name, last name and email are required')
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
      setInviteSuccess(`${displayName(inviteForm)} has been added to your team.`)
      setInviteForm({ first_name: '', last_name: '', email: '', role: 'teacher_general' })

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

  const handleResendInvite = async (teacher: Teacher) => {
    if (resendingId) return
    setResendingId(teacher.id)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/teachers/${teacher.id}/resend-invite`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        setToast(`Invite re-sent to ${teacher.email}.`)
      } else if (res.status === 404) {
        setToast(`${displayName(teacher)} is no longer an active teacher.`)
      } else {
        setToast('Could not resend the invite. Please try again.')
      }
    } catch {
      setToast('Could not reach the server. Please try again.')
    } finally {
      setResendingId(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="team" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="team" roles={roles} />

      <div className={styles.main}>

        {forbidden ? <Forbidden /> : <>

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
            <div className={styles.tableHeaderRow} style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 200px'
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
                className={styles.tableRow}
                style={{
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 200px',
                  borderBottom: i < teachers.length - 1 ? '1px solid #f4f4f4' : 'none'
                }}
              >
                {/* Name + email */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar
                    name={displayName(teacher)}
                    photoUrl={teacher.profile?.photo_url}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{displayName(teacher)}</div>
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                  {canResendTeacherInvite(roles) && (
                    <button
                      onClick={() => handleResendInvite(teacher)}
                      disabled={resendingId === teacher.id}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'transparent',
                        border: '1px solid #e2e2e2',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: resendingId === teacher.id ? 'default' : 'pointer',
                        color: '#444',
                        fontWeight: 500,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {resendingId === teacher.id ? 'Sending…' : 'Resend invite'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </>}
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
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                    First name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah"
                    value={inviteForm.first_name}
                    onChange={e => setInviteForm(p => ({ ...p, first_name: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2',
                      borderRadius: '8px', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                    Last name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jones"
                    value={inviteForm.last_name}
                    onChange={e => setInviteForm(p => ({ ...p, last_name: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2',
                      borderRadius: '8px', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
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
                  <option value="teacher_super">Super teacher — schedule and bookings</option>
                  <option value="teacher_general">Teacher — own sessions and roster</option>
                  <option value="teacher_basic">Basic teacher — attendance only</option>
                  <option value="front_desk">Front desk — schedule and check-in</option>
                </select>

                {/* Role description */}
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  {inviteForm.role === 'teacher_super' && 'Can view every session, add or cancel dates, process paid bookings, and issue or adjust passes. Cannot create/edit session templates, invite teachers, or change studio settings.'}
                  {inviteForm.role === 'teacher_general' && 'Can view their own sessions and full roster, add students at no charge, and mark attendance. Cannot edit session details or process payments.'}
                  {inviteForm.role === 'teacher_basic' && 'Can add students to their own sessions and mark attendance only. Sees member names on the roster, not contact or financial details.'}
                  {inviteForm.role === 'front_desk' && 'Can view the full schedule and check members in. Sees member names only, no contact/financial details, and cannot add students.'}
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

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}