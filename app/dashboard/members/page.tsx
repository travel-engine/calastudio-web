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
import WelcomeEmailForm from './WelcomeEmailForm'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Plus, Search, Upload, Users } from 'lucide-react'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, Modal, PageHeader, alertStyle, controlStyle, smallCapsStyle } from '@/app/components/admin'
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

// Sorting is display only, over the list already loaded. Name and email A→Z first; "Last active"
// newest first, with members who haven't signed in yet after everyone who has. The choice is kept
// for the browser tab so coming back from a member keeps the order.
type SortKey = 'name' | 'email' | 'active'
type SortState = { key: SortKey; dir: 'asc' | 'desc' }
const SORT_STORE = 'cs-members-sort'
const DEFAULT_DIR: Record<SortKey, 'asc' | 'desc'> = { name: 'asc', email: 'asc', active: 'desc' }
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function sortMembers(list: Member[], { key, dir }: SortState): Member[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    if (key === 'active') {
      // Never-seen members always sit at the bottom, whichever way it's sorted.
      if (!a.last_seen_at || !b.last_seen_at) {
        if (a.last_seen_at || b.last_seen_at) return a.last_seen_at ? -1 : 1
        return collator.compare(displayName(a), displayName(b))
      }
      return sign * (Date.parse(a.last_seen_at) - Date.parse(b.last_seen_at))
    }
    const r = key === 'email' ? collator.compare(a.email, b.email) : collator.compare(displayName(a), displayName(b))
    return sign * (r || collator.compare(a.email, b.email))
  })
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'active:desc', label: 'Recently active' },
  { value: 'active:asc', label: 'Least recently active' },
  { value: 'email:asc', label: 'Email A–Z' },
  { value: 'email:desc', label: 'Email Z–A' },
]

export default function MembersPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [studioName, setStudioName] = useState('')
  const [showWelcomeForm, setShowWelcomeForm] = useState(false)
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' })

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SORT_STORE) ?? 'null')
      if (saved && ['name', 'email', 'active'].includes(saved.key) && ['asc', 'desc'].includes(saved.dir)) setSort(saved)
    } catch { /* ignore */ }
  }, [])

  const applySort = (next: SortState) => {
    setSort(next)
    try { sessionStorage.setItem(SORT_STORE, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const toggleSort = (key: SortKey) =>
    applySort(sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: DEFAULT_DIR[key] })

  const [showAddMember, setShowAddMember] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  // Imported members whose welcome email is held until the studio presses send (API #85).
  const [pendingWelcomes, setPendingWelcomes] = useState(0)
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
      setStudioName(typeof org.name === 'string' ? org.name : '')
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

  const welcomesSent = async (queued: number) => {
    setShowWelcomeForm(false)
    setWelcomeNote(queued === 0
      ? 'No welcome emails were waiting to go out.'
      : `${queued} welcome email${queued === 1 ? '' : 's'} will go out over the next few minutes.`)
    await Promise.all([loadPendingWelcomes(), reloadMembers()])
  }

  const filtered = sortMembers(members.filter(m =>
    !search.trim() ||
    displayName(m).toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  ), sort)

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
  const sortHead = (k: SortKey, label: string, style: React.CSSProperties) => {
    const active = sort.key === k
    const Icon = sort.dir === 'asc' ? ArrowUp : ArrowDown
    return (
      <span role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={style}>
        <button type="button" onClick={() => toggleSort(k)} className={ui.focusable}
          style={{
            all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            color: active ? color.ink : undefined, borderRadius: 4,
          }}>
          {label}
          {active && <Icon size={14} strokeWidth={2.2} aria-hidden />}
        </button>
      </span>
    )
  }
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
                <Button variant="primary" size="sm" onClick={() => { setWelcomeNote(''); setShowWelcomeForm(true) }}>
                  Send welcome emails
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <label style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
                  <span className={styles.srOnly}>Search members by name or email</span>
                  <Search size={18} strokeWidth={2} color={color.muted} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="search" placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)}
                    style={{ ...controlStyle, paddingLeft: 38 }} />
                </label>
                <label className={styles.membersSortPhone}>
                  <span className={styles.srOnly}>Sort members</span>
                  <select value={`${sort.key}:${sort.dir}`} onChange={e => { const [key, dir] = e.target.value.split(':'); applySort({ key: key as SortKey, dir: dir as 'asc' | 'desc' }) }}
                    style={{ ...controlStyle, width: 'auto' }}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                </div>

                {filtered.length === 0 ? (
                  <Card><EmptyState message={<>No members match &ldquo;{search}&rdquo;.</>} /></Card>
                ) : (
                  <Card style={{ overflow: 'hidden' }} aria-label="Members">
                    <div className={styles.membersHead} role="row" style={{
                      display: 'flex', gap: 16, padding: '12px 20px', borderBottom: `1px solid ${color.border}`, ...smallCapsStyle,
                    }}>
                      {sortHead('name', 'Name', { flex: '1 1 240px' })}
                      {sortHead('email', 'Email', { flex: '1 1 240px' })}
                      {sortHead('active', 'Last active', { width: 140, flex: 'none', display: 'flex', justifyContent: 'flex-end' })}
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

      {showWelcomeForm && (
        <Modal title="Send welcome emails" onClose={() => setShowWelcomeForm(false)} width={560}>
          <WelcomeEmailForm api={authedFetch} pendingCount={pendingWelcomes} studioName={studioName}
            onSent={welcomesSent} onCancel={() => setShowWelcomeForm(false)} />
        </Modal>
      )}
      {showImportModal && (
        <ImportMembersModal
          orgId={orgId}
          token={token}
          studioName={studioName}
          onClose={() => setShowImportModal(false)}
          onImported={() => { reloadMembers(); loadPendingWelcomes() }}
        />
      )}
    </div>
  )
}
