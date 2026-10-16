'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewAuditLog } from '@/lib/roles'
import { formatClock, formatShortDate } from '@/lib/dates'
import { History } from 'lucide-react'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, PageHeader, controlStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
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

const actionStyles: Record<string, { tone: ChipTone; label: string }> = {
  create: { tone: 'primary', label: 'Created' },
  update: { tone: 'info', label: 'Updated' },
  delete: { tone: 'danger', label: 'Deleted' },
  override: { tone: 'warn', label: 'Override' },
  system: { tone: 'neutral', label: 'System' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
  completed: { tone: 'neutral', label: 'Completed' },
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
  const s = actionStyles[action] ?? { tone: 'neutral' as ChipTone, label: action }
  return <Chip tone={s.tone}>{s.label}</Chip>
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

// "booking_window_days" → "Booking window days"
const fieldLabel = (f: string) => { const t = f.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1) }

function ChangesDiff({ changes }: { changes: string }) {
  let parsed: Record<string, { old: unknown; new: unknown }>
  try {
    parsed = JSON.parse(changes)
  } catch {
    return <p style={{ margin: 0, fontSize: 14, color: color.muted }}>{changes}</p>
  }

  const fields = Object.entries(parsed)
  if (fields.length === 0) return null

  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            {['Field', 'Before', 'After'].map(h => (
              <th key={h} scope="col" style={{ textAlign: 'left', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: color.muted, padding: '8px 14px', borderBottom: `1px solid ${color.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map(([field, { old: oldVal, new: newVal }], i) => {
            const td: React.CSSProperties = { padding: '8px 14px', borderBottom: i < fields.length - 1 ? `1px solid ${color.divider}` : 'none', wordBreak: 'break-word', verticalAlign: 'top' }
            return (
              <tr key={field}>
                <td style={{ ...td, fontWeight: 600, color: color.ink2, width: '30%' }}>{fieldLabel(field)}</td>
                <td style={{ ...td, color: color.muted }}>{formatFieldValue(field, oldVal)}</td>
                <td style={{ ...td, color: color.ink }}>{formatFieldValue(field, newVal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const filterStyle: React.CSSProperties = { ...controlStyle, width: 'auto', minWidth: 160 }

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [timeZone, setTimeZone] = useState<string | null>(null)
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
      setTimeZone(org.timezone ?? null)
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

  const filtered = !!(actorId || entityType || from || to)

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="audit-log" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="audit-log" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader eyebrow="Every change in your studio: who, what and why" title="Activity log" />

            {/* Filters */}
            <div role="group" aria-label="Filters" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <select aria-label="Who" value={actorId} onChange={e => setActorId(e.target.value)} style={filterStyle}>
                <option value="">Everyone</option>
                {actors.map(a => (
                  <option key={a.actor_id} value={a.actor_id}>{a.actor_name ?? 'Unknown'}</option>
                ))}
              </select>
              <select aria-label="What changed" value={entityType} onChange={e => setEntityType(e.target.value)} style={filterStyle}>
                <option value="">All types</option>
                {Object.entries(entityTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} style={{ ...filterStyle, minWidth: 0 }} />
                <span style={{ color: color.muted, fontSize: 14 }}>to</span>
                <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} style={{ ...filterStyle, minWidth: 0 }} />
              </span>
              {filtered && (
                <button type="button" onClick={() => { setActorId(''); setEntityType(''); setFrom(''); setTo('') }} className={ui.focusable}
                  style={{ background: 'none', border: 0, padding: '10px 4px', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: color.primary, cursor: 'pointer' }}>
                  Clear filters
                </button>
              )}
            </div>

            {entries.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<History size={22} strokeWidth={1.8} />}
                  message={filtered ? 'No activity matches these filters. Try widening them.' : "Nothing's been logged yet."}
                />
              </Card>
            ) : (
              <Card style={{ overflow: 'hidden' }} aria-label="Activity">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 15 }}>
                    <thead>
                      <tr>
                        {['When', 'Who', 'Action', 'What', ''].map((h, i) => (
                          <th key={i} scope="col" style={{
                            textAlign: i === 4 ? 'right' : 'left', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            color: color.muted, padding: '12px 20px', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap',
                          }}>{h || <span className={styles.srOnly}>Details</span>}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, i) => {
                        const isExpanded = expandedId === entry.id
                        const hasDetail = !!entry.changes || !!entry.reason
                        const last = i === entries.length - 1
                        const td: React.CSSProperties = { padding: '12px 20px', borderBottom: last && !isExpanded ? 'none' : `1px solid ${color.divider}`, verticalAlign: 'middle' }
                        return (
                          <Fragment key={entry.id}>
                            <tr>
                              <td style={{ ...td, whiteSpace: 'nowrap', color: color.ink2, ...tabularNums }}>
                                {formatShortDate(entry.created_at, timeZone)} · {formatClock(entry.created_at, timeZone)}
                              </td>
                              <td style={td}>
                                <span style={{ display: 'block', fontWeight: 600 }}>{entry.actor_name ?? 'System'}</span>
                                {entry.actor_role && (
                                  <span style={{ display: 'block', fontSize: 14, color: color.muted }}>{roleLabels[entry.actor_role] ?? entry.actor_role}</span>
                                )}
                              </td>
                              <td style={td}><ActionBadge action={effectiveAction(entry)} /></td>
                              <td style={{ ...td, color: color.ink2 }}>{entityTypeLabels[entry.entity_type] ?? entry.entity_type}</td>
                              <td style={{ ...td, textAlign: 'right' }}>
                                {hasDetail && (
                                  <Button size="sm" onClick={() => setExpandedId(isExpanded ? '' : entry.id)} aria-expanded={isExpanded}>
                                    {isExpanded ? 'Hide' : 'Details'}
                                  </Button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={5} style={{ padding: '4px 20px 16px', borderBottom: last ? 'none' : `1px solid ${color.divider}` }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {entry.reason && (
                                      <div style={{ padding: '10px 14px', background: color.warnBg, borderRadius: radius.control, fontSize: 14, color: color.warnInk }}>
                                        <strong style={{ fontWeight: 600 }}>Reason:</strong> {entry.reason}
                                      </div>
                                    )}
                                    {entry.changes && <ChangesDiff changes={entry.changes} />}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {hasMore && (
              <div style={{ textAlign: 'center' }}>
                <Button onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
