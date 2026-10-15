'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewAuditLog } from '@/lib/roles'
import { formatDateTime } from '@/lib/dates'
import styles from '@/app/dashboard/dashboard.module.css'

interface AuditEntry {
  id: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  action: 'create' | 'update' | 'delete' | 'override' | 'system'
  entity_type: string
  entity_id: string
  changes: string | null
  reason: string | null
  created_at: string
}

interface AuditActor {
  actor_id: string
  actor_name: string | null
  actor_role: string | null
}

const entityTypeLabels: Record<string, string> = {
  session: 'Session',
  session_occurrence: 'Occurrence',
  booking: 'Booking',
  pass_template: 'Pass template',
  member_pass: 'Member pass',
  organisation: 'Organisation',
  organisation_member: 'Team member',
  teacher_profile: 'Teacher profile',
}

const actionStyles: Record<string, { bg: string; color: string; label: string }> = {
  create: { bg: '#e8f5ee', color: '#085041', label: 'Created' },
  update: { bg: '#e8eef8', color: '#1B4F8A', label: 'Updated' },
  delete: { bg: '#fdecea', color: '#8b1a1a', label: 'Deleted' },
  override: { bg: '#fff3cd', color: '#7a4f00', label: 'Override' },
  system: { bg: '#f4f4f4', color: '#666', label: 'System' },
  cancelled: { bg: '#fdecea', color: '#8b1a1a', label: 'Cancelled' },
  completed: { bg: '#f4f4f4', color: '#666', label: 'Completed' },
}

// OccurrenceStatus serialises into audit `changes` as its raw enum ordinal (0/1/2) — map that and
// the string form to something readable.
const statusLabels: Record<string, string> = {
  '0': 'Scheduled', '1': 'Cancelled', '2': 'Completed',
  scheduled: 'Scheduled', cancelled: 'Cancelled', completed: 'Completed',
}

// A status change to cancelled/completed reads better as its own badge than a generic "Updated".
function effectiveAction(entry: AuditEntry): string {
  if ((entry.action === 'update' || entry.action === 'override') && entry.changes) {
    try {
      const parsed = JSON.parse(entry.changes) as Record<string, { new: unknown }>
      const status = (statusLabels[String(parsed.status?.new ?? '').toLowerCase()] ?? '').toLowerCase()
      if (status === 'cancelled' || status === 'completed') return status
    } catch { /* fall through */ }
  }
  return entry.action
}

function ActionBadge({ action }: { action: string }) {
  const s = actionStyles[action] ?? { bg: '#f4f4f4', color: '#666', label: action }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  teacher_super: 'Super teacher',
  teacher_general: 'Teacher',
  teacher_basic: 'Basic teacher',
  front_desk: 'Front desk',
  member: 'Member',
}

function formatFieldValue(field: string, v: unknown) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (field === 'status' && v !== '') return statusLabels[String(v).toLowerCase()] ?? String(v)
  return String(v)
}

function ChangesDiff({ changes }: { changes: string }) {
  let parsed: Record<string, { old: unknown; new: unknown }>
  try {
    parsed = JSON.parse(changes)
  } catch {
    return <p style={{ fontSize: '12px', color: '#666' }}>{changes}</p>
  }

  const fields = Object.entries(parsed)
  if (fields.length === 0) return null

  return (
    <div style={{ marginTop: '10px', border: '1px solid #f4f4f4', borderRadius: '8px', overflow: 'hidden' }}>
      {fields.map(([field, { old: oldVal, new: newVal }], i) => (
        <div key={field} style={{
          display: 'grid', gridTemplateColumns: '160px 1fr 24px 1fr',
          padding: '8px 12px', alignItems: 'center', fontSize: '12px',
          borderBottom: i < fields.length - 1 ? '1px solid #f4f4f4' : 'none',
          backgroundColor: i % 2 === 0 ? '#fafafa' : 'white'
        }}>
          <div style={{ fontWeight: 600, color: '#444' }}>{field}</div>
          <div style={{ color: '#8b1a1a', wordBreak: 'break-word' }}>{formatFieldValue(field, oldVal)}</div>
          <div style={{ textAlign: 'center', color: '#999' }}>→</div>
          <div style={{ color: '#085041', wordBreak: 'break-word' }}>{formatFieldValue(field, newVal)}</div>
        </div>
      ))}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '13px', outline: 'none', backgroundColor: 'white'
}

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [actors, setActors] = useState<AuditActor[]>([])
  const [actorId, setActorId] = useState('')
  const [entityType, setEntityType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedId, setExpandedId] = useState('')

  const fetchEntries = useCallback(async (org: string, t: string, currentOffset: number, append: boolean) => {
    const params = new URLSearchParams()
    if (actorId) params.set('actor_id', actorId)
    if (entityType) params.set('entity_type', entityType)
    if (from) params.set('from', new Date(from).toISOString())
    if (to) params.set('to', new Date(to + 'T23:59:59').toISOString())
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(currentOffset))

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org}/audit-log?${params}`, {
      headers: { Authorization: `Bearer ${t}` }
    })
    if (res.ok) {
      const data: AuditEntry[] = await res.json()
      setEntries(prev => append ? [...prev, ...data] : data)
      setHasMore(data.length === PAGE_SIZE)
    }
  }, [actorId, entityType, from, to])

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

      if (!canViewAuditLog(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      const actorsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/audit-log/actors`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (actorsRes.ok) {
        // The same person can appear once per role they've acted under — collapse to one row per
        // actor for the filter (it filters by actor_id regardless of role).
        const raw: AuditActor[] = await actorsRes.json()
        const byId = new Map<string, AuditActor>()
        for (const a of raw) if (!byId.has(a.actor_id)) byId.set(a.actor_id, a)
        setActors([...byId.values()])
      }

      await fetchEntries(org.id, t, 0, false)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Re-run the query from the top whenever a filter changes
  useEffect(() => {
    if (loading || forbidden || !orgId) return
    setOffset(0)
    fetchEntries(orgId, token, 0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, entityType, from, to])

  const loadMore = async () => {
    setLoadingMore(true)
    const nextOffset = offset + PAGE_SIZE
    await fetchEntries(orgId, token, nextOffset, true)
    setOffset(nextOffset)
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="audit-log" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="audit-log" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : <>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Activity log</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
            Every change made in your studio — who, what, and why
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <select value={actorId} onChange={e => setActorId(e.target.value)} style={inputStyle}>
            <option value="">All actors</option>
            {actors.map(a => (
              <option key={a.actor_id} value={a.actor_id}>{a.actor_name ?? 'Unknown'}</option>
            ))}
          </select>
          <select value={entityType} onChange={e => setEntityType(e.target.value)} style={inputStyle}>
            <option value="">All types</option>
            {Object.entries(entityTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} title="From date" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} title="To date" />
          {(actorId || entityType || from || to) && (
            <button
              onClick={() => { setActorId(''); setEntityType(''); setFrom(''); setTo('') }}
              style={{ ...inputStyle, backgroundColor: 'transparent', cursor: 'pointer', color: '#666' }}
            >
              Clear filters
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '64px', textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🕘</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No activity found</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              {actorId || entityType || from || to ? 'Try widening your filters.' : "Nothing's been logged yet."}
            </p>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div className={styles.tableHeaderRow} style={{ gridTemplateColumns: '1.3fr 1.6fr 1fr 1fr 100px' }}>
              <div>When</div>
              <div>Who</div>
              <div>Action</div>
              <div>Entity</div>
              <div>Details</div>
            </div>

            {entries.map((entry, i) => {
              const isExpanded = expandedId === entry.id
              const hasDetail = !!entry.changes || !!entry.reason
              return (
                <div key={entry.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid #f4f4f4' : 'none' }}>
                  <div className={styles.tableRow} style={{
                    gridTemplateColumns: '1.3fr 1.6fr 1fr 1fr 100px'
                  }}>
                    <div style={{ fontSize: '13px', color: '#444' }}>
                      {formatDateTime(entry.created_at)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{entry.actor_name ?? 'System'}</div>
                      {entry.actor_role && (
                        <div style={{ fontSize: '11px', color: '#666' }}>{roleLabels[entry.actor_role] ?? entry.actor_role}</div>
                      )}
                    </div>
                    <div><ActionBadge action={effectiveAction(entry)} /></div>
                    <div style={{ fontSize: '13px', color: '#444' }}>
                      {entityTypeLabels[entry.entity_type] ?? entry.entity_type}
                    </div>
                    <div>
                      {hasDetail && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? '' : entry.id)}
                          style={{
                            padding: '5px 10px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                            fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500
                          }}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 24px 16px' }}>
                      {entry.reason && (
                        <div style={{
                          padding: '10px 12px', backgroundColor: '#fff3cd', borderRadius: '8px',
                          fontSize: '12px', color: '#7a4f00', marginBottom: entry.changes ? '10px' : 0
                        }}>
                          <strong>Reason:</strong> {entry.reason}
                        </div>
                      )}
                      {entry.changes && <ChangesDiff changes={entry.changes} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                padding: '10px 24px', backgroundColor: 'white', border: '1px solid #e2e2e2',
                borderRadius: '8px', fontSize: '13px', color: '#444', cursor: loadingMore ? 'not-allowed' : 'pointer', fontWeight: 500
              }}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
        </>}
      </div>
    </div>
  )
}
