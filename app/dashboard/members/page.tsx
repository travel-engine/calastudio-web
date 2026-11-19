'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers, canImportMembers, canAddMember, staffRoleLabel } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { formatRelativeShort } from '@/lib/dates'
import { memberActivity, memberActivityLabel } from '@/lib/members'
import AddMemberModal from '@/app/components/AddMemberModal'
import ImportMembersModal from './ImportMembersModal'
import Link from 'next/link'
import { Plus, Search, Upload, Users } from 'lucide-react'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, PageHeader, alertStyle, controlStyle, smallCapsStyle } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

interface Member {
  id: string
  first_name: string
  last_name: string
  email: string
  last_seen_at: string | null
  auth_provisioned_at: string | null
  // Studio roles; staff (the owner is admin) get a chip so they don't read as ordinary members.
  roles?: string[]
  welcome_pending?: boolean
}

export default function MembersPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')

  const [showAddMember, setShowAddMember] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  // Imported members whose welcome email is held until the studio presses send (API #85).
  const [pendingWelcomes, setPendingWelcomes] = useState(0)
  const [welcomeBusy, setWelcomeBusy] = useState(false)
  const [welcomeNote, setWelcomeNote] = useState('')

  const authedFetch = useCallback((path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` }
    }), [orgId, token])

  const reloadMembers = useCallback(async () => {
    const res = await authedFetch('/members')
    if (res.ok) setMembers(await res.json())
  }, [authedFetch])

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

      if (!canViewMembers(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      const membersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/members`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (membersRes.ok) setMembers(await membersRes.json())

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const loadPendingWelcomes = useCallback(async () => {
    const res = await authedFetch('/members/pending-welcome-count')
    if (res.ok) setPendingWelcomes((await res.json()).count ?? 0)
  }, [authedFetch])

  useEffect(() => {
    if (orgId && token && canImportMembers(roles)) loadPendingWelcomes()
  }, [orgId, token, roles, loadPendingWelcomes])

  const sendPendingWelcomes = async () => {
    setWelcomeBusy(true)
    setWelcomeNote('')
    try {
      const res = await authedFetch('/members/send-pending-welcomes', { method: 'POST' })
      if (!res.ok) { setWelcomeNote("Couldn't send the welcome emails. Please try again."); return }
      const queued: number = (await res.json()).queued ?? 0
      setWelcomeNote(queued === 0
        ? 'No welcome emails were waiting to go out.'
        : `${queued} welcome email${queued === 1 ? '' : 's'} will go out over the next few minutes.`)
      await Promise.all([loadPendingWelcomes(), reloadMembers()])
    } finally {
      setWelcomeBusy(false)
    }
  }

  const filtered = members.filter(m =>
    !search.trim() ||
    displayName(m).toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="members" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  const actions = (
    <>
      {canImportMembers(roles) && <Button onClick={() => setShowImportModal(true)} icon={<Upload size={18} strokeWidth={1.8} aria-hidden />}>Import CSV</Button>}
      {canAddMember(roles) && <Button variant="primary" onClick={() => setShowAddMember(true)} icon={<Plus size={18} strokeWidth={2} aria-hidden />}>Add member</Button>}
    </>
  )
  const initials = (m: Member) => `${m.first_name?.[0] ?? ''}${m.last_name?.[0] ?? ''}`.toUpperCase() || '?'

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader eyebrow={`${members.length} member${members.length !== 1 ? 's' : ''} in your studio`} title="Members" actions={actions} />

            {pendingWelcomes > 0 && (
              <div style={{ ...alertStyle('warn'), display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>
                  {pendingWelcomes} imported member{pendingWelcomes === 1 ? " hasn't" : "s haven't"} been sent their welcome email yet.
                </span>
                <Button variant="primary" size="sm" onClick={sendPendingWelcomes} disabled={welcomeBusy}>
                  {welcomeBusy ? 'Sending…' : 'Send welcome emails'}
                </Button>
              </div>
            )}
            {welcomeNote && <div role="status" style={alertStyle(welcomeNote.startsWith("Couldn't") ? 'danger' : 'ok')}>{welcomeNote}</div>}

            {members.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Users size={22} strokeWidth={1.8} />}
                  message="Members show up here once they book. You can also add someone directly or import an existing list."
                  action={<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>{actions}</div>}
                />
              </Card>
            ) : (
              <>
                <label style={{ position: 'relative', maxWidth: 380 }}>
                  <span className={styles.srOnly}>Search members by name or email</span>
                  <Search size={18} strokeWidth={2} color={color.muted} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="search" placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)}
                    style={{ ...controlStyle, paddingLeft: 38 }} />
                </label>

                {filtered.length === 0 ? (
                  <Card><EmptyState message={<>No members match &ldquo;{search}&rdquo;.</>} /></Card>
                ) : (
                  <Card style={{ overflow: 'hidden' }} aria-label="Members">
                    <div className={styles.membersHead} aria-hidden style={{
                      display: 'flex', gap: 16, padding: '12px 20px', borderBottom: `1px solid ${color.border}`, ...smallCapsStyle,
                    }}>
                      <span style={{ flex: '1 1 240px' }}>Name</span>
                      <span style={{ flex: '1 1 240px' }}>Email</span>
                      <span style={{ width: 140, flex: 'none', textAlign: 'right' }}>Last active</span>
                    </div>
                    {filtered.map((m, i) => {
                      const activity = memberActivity(m.auth_provisioned_at, m.last_seen_at, m.welcome_pending)
                      const staff = staffRoleLabel(m.roles)
                      return (
                        <Link key={m.id} href={`/dashboard/members/${m.id}`} className={`${ui.rowLink} ${ui.focusable}`}
                          style={{
                            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', padding: '12px 20px',
                            borderTop: i ? `1px solid ${color.divider}` : 'none', textDecoration: 'none', color: color.ink,
                            ['--hover-bg' as string]: '#F7F8F5',
                          }}>
                          <span style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span aria-hidden style={{
                              width: 36, height: 36, borderRadius: '50%', flex: 'none', background: color.primarySoft, color: color.primaryInk,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600,
                            }}>{initials(m)}</span>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{displayName(m)}</span>
                            {staff && <Chip tone="info">{staff}</Chip>}
                          </span>
                          <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 14, color: color.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</span>
                          <span style={{ width: 140, flex: 'none', textAlign: 'right', fontSize: 14, color: activity.kind === 'seen' ? color.ink2 : color.muted, ...tabularNums }}>
                            {activity.kind === 'seen' ? formatRelativeShort(activity.at) : memberActivityLabel(activity)}
                          </span>
                        </Link>
                      )
                    })}
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showAddMember && (
        <AddMemberModal
          orgId={orgId}
          token={token}
          onClose={() => setShowAddMember(false)}
          onCreated={m => { setShowAddMember(false); router.push(`/dashboard/members/${m.id}`) }}
        />
      )}

      {showImportModal && (
        <ImportMembersModal
          orgId={orgId}
          token={token}
          onClose={() => setShowImportModal(false)}
          onImported={() => { reloadMembers(); loadPendingWelcomes() }}
        />
      )}
    </div>
  )
}
