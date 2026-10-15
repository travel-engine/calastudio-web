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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    valid: { bg: '#e8f5ee', color: '#085041', label: 'Valid' },
    invalid: { bg: '#fdecea', color: '#8b1a1a', label: 'Invalid' },
    already_member: { bg: '#fff3cd', color: '#7a4f00', label: 'Already a member' },
  }
  const s = map[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
        maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
      {message}
    </div>
  )
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
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : <>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Members</h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              {members.length} member{members.length !== 1 ? 's' : ''} in your studio
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {canAddMember(roles) && (
              <button
                onClick={() => setShowAddMember(true)}
                style={{
                  padding: '10px 20px', backgroundColor: '#085041', color: 'white', border: 'none',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Add member
              </button>
            )}
            {canImportMembers(roles) && (
              <button
                onClick={openImportModal}
                style={{
                  padding: '10px 20px', backgroundColor: 'white', color: '#1a1a1a', border: '1px solid #d2d2d2',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Import CSV
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        {members.length > 0 && (
          <input
            type="text"
            placeholder="Search members by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', maxWidth: '360px', padding: '10px 14px', border: '1px solid #e2e2e2',
              borderRadius: '8px', fontSize: '14px', outline: 'none', marginBottom: '20px', backgroundColor: 'white'
            }}
          />
        )}

        {/* Member list */}
        {members.length === 0 ? (
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '64px', textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No members yet</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
              Members show up here once they book, or you can add someone directly or import an existing list.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {canAddMember(roles) && (
                <button
                  onClick={() => setShowAddMember(true)}
                  style={{
                    padding: '10px 24px', backgroundColor: '#085041', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  + Add member
                </button>
              )}
              {canImportMembers(roles) && (
                <button
                  onClick={openImportModal}
                  style={{
                    padding: '10px 24px', backgroundColor: 'white', color: '#1a1a1a', border: '1px solid #d2d2d2',
                    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Import CSV
                </button>
              )}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: '#666', fontSize: '14px'
          }}>
            No members match &quot;{search}&quot;.
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHeaderRow} style={{ gridTemplateColumns: '2fr 2fr 140px' }}>
              <div>Name</div>
              <div>Email</div>
              <div>Last active</div>
            </div>
            {filtered.map((m, i) => {
              const activity = memberActivity(m.auth_provisioned_at, m.last_seen_at)
              return (
                <a key={m.id} href={`/dashboard/members/${m.id}`} className={styles.tableRow} style={{
                  gridTemplateColumns: '2fr 2fr 140px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #f4f4f4' : 'none',
                  textDecoration: 'none', color: 'inherit', cursor: 'pointer'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{displayName(m)}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>{m.email}</div>
                  <div style={{ fontSize: '13px', color: activity.kind === 'seen' ? '#444' : '#999' }}>
                    {activity.kind === 'seen' ? formatRelativeShort(activity.at) : memberActivityLabel(activity)}
                  </div>
                </a>
              )
            })}
          </div>
        )}
        </>}
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
        <ModalShell title="Import members from CSV" onClose={() => setShowImportModal(false)}>
          {!preview ? (
            <>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                Columns recognized: first_name, last_name, email, join_date, phone, date_of_birth,
                gender, person_type, emergency_contact_name, emergency_contact_phone, address.
                Only first_name and email are required — a single full_name column is also accepted
                and split automatically. Include a header row so any subset works in any order.
                Dates must be YYYY-MM-DD. If given, gender must be male, female, other or
                prefer_not_to_say, and person_type must be adult, child, senior or student.
              </p>

              <button
                type="button"
                onClick={downloadSampleMembersCsv}
                style={{
                  background: 'none', border: 'none', padding: 0, marginBottom: '16px',
                  color: '#085041', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Download sample CSV
              </button>

              {importError && <ErrorBanner message={importError} />}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '10px 20px', backgroundColor: '#f4f4f4', border: '1px solid #e2e2e2',
                      borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer'
                    }}
                  >
                    Choose CSV file to upload
                  </button>
                  {fileName && <span style={{ marginLeft: '12px', fontSize: '13px', color: '#666' }}>{fileName}</span>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                <div style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>— or paste rows directly —</div>

                <textarea
                  value={csvText}
                  onChange={e => { setCsvText(e.target.value); setFileName('') }}
                  placeholder={'first_name,last_name,email,join_date\nJane,Smith,jane@example.com,2026-01-15'}
                  style={{
                    width: '100%', minHeight: '140px', padding: '10px 14px', border: '1px solid #e2e2e2',
                    borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={handlePreview}
                disabled={previewing}
                style={{
                  padding: '10px 24px', backgroundColor: '#085041', color: 'white', border: 'none',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  cursor: previewing ? 'default' : 'pointer', opacity: previewing ? 0.6 : 1
                }}
              >
                {previewing ? 'Checking...' : 'Preview import'}
              </button>
            </>
          ) : (
            <>
              {committed ? (
                <div style={{ padding: '16px', backgroundColor: '#e8f5ee', borderRadius: '8px', color: '#085041', fontSize: '14px', marginBottom: '16px' }}>
                  Imported {preview.imported_count} member{preview.imported_count !== 1 ? 's' : ''}.
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                  {preview.valid_count} row{preview.valid_count !== 1 ? 's' : ''} ready to import,{' '}
                  {preview.already_member_count} already a member, {preview.invalid_count} invalid.
                  Nothing has been saved yet.
                </p>
              )}

              {importError && <ErrorBanner message={importError} />}

              <div style={{ border: '1px solid #e2e2e2', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', maxHeight: '320px', overflowY: 'auto' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '40px 1.4fr 1.6fr 1fr 1.6fr',
                  padding: '10px 16px', backgroundColor: '#f4f4f4', borderBottom: '1px solid #e2e2e2',
                  fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  <div>#</div>
                  <div>Name</div>
                  <div>Email</div>
                  <div>Status</div>
                  <div>Reason</div>
                </div>
                {preview.rows.map(row => (
                  <div key={row.row_number} style={{
                    display: 'grid', gridTemplateColumns: '40px 1.4fr 1.6fr 1fr 1.6fr',
                    padding: '10px 16px', borderBottom: '1px solid #f4f4f4', alignItems: 'center', fontSize: '13px'
                  }}>
                    <div style={{ color: '#999' }}>{row.row_number}</div>
                    <div>{displayName(row) || '—'}</div>
                    <div style={{ color: '#666', wordBreak: 'break-word' }}>{row.email || '—'}</div>
                    <div><StatusBadge status={row.status} /></div>
                    <div style={{ color: '#999', fontSize: '12px' }}>{row.reason ?? '—'}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {!committed ? (
                  <>
                    <button
                      onClick={handleCommit}
                      disabled={committing || preview.valid_count === 0}
                      style={{
                        padding: '10px 24px', backgroundColor: '#085041', color: 'white', border: 'none',
                        borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                        cursor: committing || preview.valid_count === 0 ? 'default' : 'pointer',
                        opacity: committing || preview.valid_count === 0 ? 0.5 : 1
                      }}
                    >
                      {committing ? 'Importing...' : `Import ${preview.valid_count} member${preview.valid_count !== 1 ? 's' : ''}`}
                    </button>
                    <button
                      onClick={() => setPreview(null)}
                      style={{
                        padding: '10px 24px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
                        borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#444'
                      }}
                    >
                      Back
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowImportModal(false)}
                    style={{
                      padding: '10px 24px', backgroundColor: '#085041', color: 'white', border: 'none',
                      borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            </>
          )}
        </ModalShell>
      )}
    </div>
  )
}
