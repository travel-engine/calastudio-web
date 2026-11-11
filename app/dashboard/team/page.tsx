'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, UserPlus, X } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '../../components/Sidebar'
import Forbidden from '../../components/Forbidden'
import Toast from '../../components/Toast'
import { canViewTeam, canResendTeacherInvite } from '@/lib/roles'
import { displayName, teacherName } from '@/lib/names'
import { color, font, radius, space } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, Field, PageHeader, buttonStyle, controlStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

interface Teacher {
  id: string
  first_name: string
  last_name: string
  email: string
  roles: string[]
  profile: {
    slug: string
    display_name: string
    tagline: string | null
    bio: string | null
    photo_url: string | null
    is_page_published: boolean
    show_on_studio_page: boolean
    is_primary: boolean
  } | null
}

const ROLE_LABEL: Record<string, { label: string; tone: ChipTone }> = {
  admin: { label: 'Admin', tone: 'warn' },
  teacher_super: { label: 'Super teacher', tone: 'primary' },
  teacher_general: { label: 'Teacher', tone: 'info' },
  teacher_basic: { label: 'Basic teacher', tone: 'neutral' },
  front_desk: { label: 'Front desk', tone: 'neutral' },
}

const ROLE_HELP: Record<string, string> = {
  teacher_super: 'Can view every session, add or cancel dates, process paid bookings, and issue or adjust passes. Cannot create/edit session templates, invite teachers, or change studio settings.',
  teacher_general: 'Can view their own sessions and full roster, add students at no charge, and mark attendance. Cannot edit session details or process payments.',
  teacher_basic: 'Can add students to their own sessions and mark attendance only. Sees member names on the roster, not contact or financial details.',
  front_desk: 'Can view the full schedule and check members in. Sees member names only, no contact/financial details, and cannot add students.',
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
  }
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <span aria-hidden style={{
      width: 44, height: 44, borderRadius: '50%', background: color.primarySoft, color: color.primaryInk, flex: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600,
    }}>
      {initials}
    </span>
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
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const t = ctx.token
      setToken(t)
      const org = ctx.org
      setOrgId(org.id)
      const myRoles: string[] = ctx.roles
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
        setToast(`${teacherName(teacher)} is no longer an active teacher.`)
      } else {
        setToast('Could not resend the invite. Please try again.')
      }
    } catch {
      setToast('Could not reach the server. Please try again.')
    } finally {
      setResendingId(null)
    }
  }

  const closeInvite = () => { setShowInviteModal(false); setInviteError(''); setInviteSuccess('') }

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="team" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="team" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader
              eyebrow={`${teachers.length} teacher${teachers.length !== 1 ? 's' : ''} in your studio`}
              title="Team"
              actions={<Button variant="primary" onClick={() => setShowInviteModal(true)} icon={<Plus size={18} strokeWidth={2} aria-hidden />}>Invite teacher</Button>}
            />

            {teachers.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<UserPlus size={22} strokeWidth={1.8} />}
                  message="Invite your first teacher to give them access to their sessions and students."
                  action={<Button variant="primary" onClick={() => setShowInviteModal(true)}>Invite a teacher</Button>}
                />
              </Card>
            ) : (
              <Card style={{ overflow: 'hidden' }} aria-label="Teachers">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 15 }}>
                    <thead>
                      <tr>
                        {['Teacher', 'Role', 'Landing page', 'On studio page', ''].map((h, i) => (
                          <th key={i} scope="col" style={{
                            textAlign: i === 4 ? 'right' : 'left', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            color: color.muted, padding: '12px 20px', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap',
                          }}>{h || <span className={styles.srOnly}>Actions</span>}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map((teacher, i) => {
                        const td: React.CSSProperties = { padding: '14px 20px', borderBottom: i < teachers.length - 1 ? `1px solid ${color.divider}` : 'none', verticalAlign: 'middle' }
                        return (
                          <tr key={teacher.id}>
                            <td style={td}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Avatar name={teacherName(teacher)} photoUrl={teacher.profile?.photo_url} />
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontWeight: 600, fontSize: 16 }}>
                                    {teacherName(teacher)}
                                    {teacher.profile?.is_primary && <Chip tone="primary">Lead</Chip>}
                                  </span>
                                  {/* The account (sign-in) name, when the teacher goes by something else */}
                                  <span style={{ display: 'block', fontSize: 14, color: color.muted }}>
                                    {teacherName(teacher) !== displayName(teacher) && displayName(teacher) ? `${displayName(teacher)} · ` : ''}{teacher.email}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td style={td}>
                              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {/* Staff roles only — 'member' just means they can also book classes. */}
                                {teacher.roles.filter(r => r !== 'member').map(r => (
                                  <Chip key={r} tone={ROLE_LABEL[r]?.tone ?? 'neutral'}>{ROLE_LABEL[r]?.label ?? r}</Chip>
                                ))}
                              </span>
                            </td>
                            <td style={td}>
                              {teacher.profile?.is_page_published ? <Chip tone="primary">Published</Chip> : <Chip>Draft</Chip>}
                            </td>
                            <td style={{ ...td, color: color.ink2 }}>{teacher.profile?.show_on_studio_page ? 'Shown' : 'Hidden'}</td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                                {canResendTeacherInvite(roles) && (
                                  <Button size="sm" onClick={() => handleResendInvite(teacher)} disabled={resendingId === teacher.id}>
                                    {resendingId === teacher.id ? 'Sending…' : 'Resend invite'}
                                  </Button>
                                )}
                                <Button size="sm" href={`/dashboard/team/${teacher.id}`}>Edit<span className={styles.srOnly}> {teacherName(teacher)}</span></Button>
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Invite dialog */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(23, 32, 28, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="invite-heading" style={{
            background: color.surface, borderRadius: radius.card, padding: 28, width: '100%', maxWidth: 500,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: font.body, maxHeight: '100%', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 id="invite-heading" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Invite a teacher</h2>
              <button type="button" aria-label="Close" onClick={closeInvite} className={`${ui.button} ${ui.focusable}`} style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}>
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <Field label="First name" htmlFor="inv-first">
                  <input id="inv-first" type="text" placeholder="e.g. Sarah" value={inviteForm.first_name}
                    onChange={e => setInviteForm(p => ({ ...p, first_name: e.target.value }))} style={controlStyle} />
                </Field>
                <Field label="Last name" htmlFor="inv-last">
                  <input id="inv-last" type="text" placeholder="e.g. Jones" value={inviteForm.last_name}
                    onChange={e => setInviteForm(p => ({ ...p, last_name: e.target.value }))} style={controlStyle} />
                </Field>
              </div>
              <Field label="Email address" htmlFor="inv-email">
                <input id="inv-email" type="email" placeholder="sarah@yourstudio.com" value={inviteForm.email}
                  onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} style={controlStyle} />
              </Field>
              <Field label="Role" htmlFor="inv-role" hint={ROLE_HELP[inviteForm.role]}>
                <select id="inv-role" aria-describedby="inv-role-hint" value={inviteForm.role}
                  onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))} style={{ ...controlStyle, cursor: 'pointer' }}>
                  <option value="teacher_super">Super teacher — schedule and bookings</option>
                  <option value="teacher_general">Teacher — own sessions and roster</option>
                  <option value="teacher_basic">Basic teacher — attendance only</option>
                  <option value="front_desk">Front desk — schedule and check-in</option>
                </select>
              </Field>

              {inviteError && (
                <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>{inviteError}</div>
              )}
              {inviteSuccess && (
                <div role="status" style={{ padding: '12px 16px', background: color.primarySoft, borderRadius: radius.control, color: color.primaryInk, fontSize: 15 }}>{inviteSuccess}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Button onClick={closeInvite} style={{ flex: 1 }}>{inviteSuccess ? 'Done' : 'Cancel'}</Button>
                <Button variant="primary" onClick={handleInvite} disabled={inviting} style={{ flex: 1 }}>{inviting ? 'Adding…' : 'Add to team'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
