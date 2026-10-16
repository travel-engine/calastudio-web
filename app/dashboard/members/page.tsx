'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers, canImportMembers, canAddMember } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { formatRelativeShort } from '@/lib/dates'
import { memberActivity, memberActivityLabel } from '@/lib/members'
import AddMemberModal from '@/app/components/AddMemberModal'
import Link from 'next/link'
import { Plus, Search, Upload, Users } from 'lucide-react'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, Field, Modal, PageHeader, alertStyle, controlStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

interface Member {
  id: string
  first_name: string
  last_name: string
  email: string
  last_seen_at: string | null
  auth_provisioned_at: string | null
}

interface ImportRow {
  row_number: number
  first_name: string
  last_name: string
  email: string | null
  join_date: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  person_type: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
  status: 'valid' | 'invalid' | 'already_member'
  reason: string | null
}

interface ImportResult {
  rows: ImportRow[]
  valid_count: number
  invalid_count: number
  already_member_count: number
  imported_count: number
}

const IMPORT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  valid: { label: 'Valid', tone: 'primary' },
  invalid: { label: 'Invalid', tone: 'danger' },
  already_member: { label: 'Already a member', tone: 'warn' },
}

// Kept in sync with the "Columns recognized" copy in the import modal and the API's
// MemberEndpoints.cs importer. Enum values (gender, person_type) and the ISO date format
// mirror calastudio-spec/03-member-management.md §3.3–3.4 and §CSV import.
const SAMPLE_MEMBERS_CSV = [
  'first_name,last_name,email,join_date,phone,date_of_birth,gender,person_type,emergency_contact_name,emergency_contact_phone,address',
  'Jane,Smith,jane.smith@example.com,2026-01-15,+61 400 000 111,1990-06-24,female,adult,John Smith,+61 400 000 222,"12 Yoga Lane, Bondi NSW 2026"',
  'Arjun,Patel,arjun.patel@example.com,,,,,,,,',
  'Mei,Chen,mei.chen@example.com,2025-11-03,,1978-02-09,prefer_not_to_say,senior,,,',
  '',
].join('\n')

function downloadSampleMembersCsv() {
  const blob = new Blob([SAMPLE_MEMBERS_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'calastudio-members-sample.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function MembersPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')

  const [showAddMember, setShowAddMember] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const [committed, setCommitted] = useState(false)

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

  const openImportModal = () => {
    setCsvText('')
    setFileName('')
    setPreview(null)
    setImportError('')
    setCommitted(false)
    setShowImportModal(true)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setCsvText(await file.text())
    setPreview(null)
    setImportError('')
  }

  const handlePreview = async () => {
    if (!csvText.trim()) { setImportError('Add some CSV content first — upload a file or paste rows below.'); return }
    setPreviewing(true)
    setImportError('')
    try {
      const res = await authedFetch('/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: csvText, commit: false })
      })
      if (!res.ok) { setImportError('Could not validate this file. Check the format and try again.'); return }
      setPreview(await res.json())
    } finally {
      setPreviewing(false)
    }
  }

  const handleCommit = async () => {
    setCommitting(true)
    setImportError('')
    try {
      const res = await authedFetch('/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: csvText, commit: true })
      })
      if (!res.ok) { setImportError('Import failed. Nothing was saved.'); return }
      setPreview(await res.json())
      setCommitted(true)
      await reloadMembers()
    } finally {
      setCommitting(false)
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
      {canImportMembers(roles) && <Button onClick={openImportModal} icon={<Upload size={18} strokeWidth={1.8} aria-hidden />}>Import CSV</Button>}
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
                      const activity = memberActivity(m.auth_provisioned_at, m.last_seen_at)
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
        <Modal title="Import members from CSV" onClose={() => setShowImportModal(false)} width={820}>
          {!preview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: color.ink2 }}>
                Columns recognised: first_name, last_name, email, join_date, phone, date_of_birth,
                gender, person_type, emergency_contact_name, emergency_contact_phone, address.
                Only first_name and email are required — a single full_name column is also accepted
                and split automatically. Include a header row so any subset works in any order.
                Dates must be YYYY-MM-DD. If given, gender must be male, female, other or
                prefer_not_to_say, and person_type must be adult, child, senior or student.
              </p>
              <div>
                <button type="button" onClick={downloadSampleMembersCsv} className={ui.focusable}
                  style={{ background: 'none', border: 0, padding: '6px 0', color: color.primary, fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  Download sample CSV
                </button>
              </div>

              {importError && <div role="alert" style={alertStyle()}>{importError}</div>}

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <Button onClick={() => fileInputRef.current?.click()} icon={<Upload size={18} strokeWidth={1.8} aria-hidden />}>Choose CSV file</Button>
                {fileName && <span style={{ fontSize: 14, color: color.ink2 }}>{fileName}</span>}
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>

              <Field label="Or paste rows" htmlFor="csv-paste">
                <textarea id="csv-paste" value={csvText} onChange={e => { setCsvText(e.target.value); setFileName('') }}
                  placeholder={'first_name,last_name,email,join_date\nJane,Smith,jane@example.com,2026-01-15'}
                  style={{ ...controlStyle, minHeight: 140, padding: '10px 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, resize: 'vertical' }} />
              </Field>

              <div><Button variant="primary" onClick={handlePreview} disabled={previewing}>{previewing ? 'Checking…' : 'Preview import'}</Button></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
              {committed ? (
                <div role="status" style={alertStyle('ok')}>Imported {preview.imported_count} member{preview.imported_count !== 1 ? 's' : ''}.</div>
              ) : (
                <p style={{ margin: 0, fontSize: 15, color: color.ink2, ...tabularNums }}>
                  {preview.valid_count} row{preview.valid_count !== 1 ? 's' : ''} ready to import,{' '}
                  {preview.already_member_count} already a member, {preview.invalid_count} invalid.
                  Nothing has been saved yet.
                </p>
              )}

              {importError && <div role="alert" style={alertStyle()}>{importError}</div>}

              <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, overflow: 'auto', maxHeight: 340 }}>
                <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      {['Row', 'Name', 'Email', 'Status', 'Reason'].map(h => (
                        <th key={h} scope="col" style={{ ...smallCapsStyle, textAlign: 'left', padding: '10px 14px', borderBottom: `1px solid ${color.border}`, position: 'sticky', top: 0, background: color.surface }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => {
                      const st = IMPORT_STATUS[row.status] ?? { label: row.status, tone: 'neutral' as ChipTone }
                      const td: React.CSSProperties = { padding: '10px 14px', borderBottom: `1px solid ${color.divider}`, verticalAlign: 'top' }
                      return (
                        <tr key={row.row_number}>
                          <td style={{ ...td, color: color.muted, ...tabularNums }}>{row.row_number}</td>
                          <td style={td}>{displayName(row) || '—'}</td>
                          <td style={{ ...td, color: color.ink2, wordBreak: 'break-word' }}>{row.email || '—'}</td>
                          <td style={td}><Chip tone={st.tone}>{st.label}</Chip></td>
                          <td style={{ ...td, color: color.muted }}>{row.reason ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {!committed ? (
                  <>
                    <Button onClick={() => setPreview(null)}>Back</Button>
                    <Button variant="primary" onClick={handleCommit} disabled={committing || preview.valid_count === 0}>
                      {committing ? 'Importing…' : `Import ${preview.valid_count} member${preview.valid_count !== 1 ? 's' : ''}`}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" onClick={() => setShowImportModal(false)}>Done</Button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
