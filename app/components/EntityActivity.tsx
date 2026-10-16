'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatClock, formatShortDate } from '@/lib/dates'
import { color, radius, tabularNums } from '@/lib/ui/tokens'
import { Button, Chip, cardStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'

// Scoped, read-only view of the org-wide activity log (app/dashboard/audit-log), pre-filtered to one
// entity by (entity_type, entity_id) — the "Audit History" surface called for in
// calastudio-spec/08-dashboard-reporting.md §8.10. Used on the session detail screen
// (entity_type=session) and the occurrence detail screen (entity_type=session_occurrence). Shows
// only rows logged directly against that entity; related booking / waitlist rows fold in once
// audit_log carries the links to query them by.

interface AuditEntry {
  id: string
  actor_name: string | null
  actor_role: string | null
  action: 'create' | 'update' | 'delete' | 'override' | 'system'
  entity_type: string
  entity_id: string
  changes: string | null
  reason: string | null
  created_at: string
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

// OccurrenceStatus serialises into audit `changes` as its raw enum ordinal (0/1/2). Map both that
// and the string form to something a person can read.
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

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  teacher_super: 'Super teacher',
  teacher_general: 'Teacher',
  teacher_basic: 'Basic teacher',
  front_desk: 'Front desk',
  member: 'Member',
}

// Prettier labels for the session / occurrence fields that show up in a diff; anything not listed
// falls back to the raw key with underscores turned into spaces.
const fieldLabels: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  photo_url: 'Photo',
  location_name: 'Location name',
  location_address: 'Address',
  online_instructions: 'Online instructions',
  capacity: 'Capacity',
  price: 'Price',
  duration_minutes: 'Duration (min)',
  first_occurrence_starts_at: 'First occurrence',
  is_recurring: 'Recurring',
  recurrence_rule: 'Recurrence rule',
  recurrence_end_date: 'Recurrence ends',
  recurrence_count: 'Recurrence count',
  visibility: 'Visibility',
  booking_access_mode: 'Booking access',
  cancellation_hours: 'Cancellation window (h)',
  cancellation_hours_override: 'Cancellation window (h)',
  booking_window_days: 'Booking window (days)',
  min_advance_booking_hours: 'Min advance booking (h)',
  tax_rate_override: 'Tax rate override',
  guest_bookings_enabled: 'Guests allowed',
  guest_max_per_booking: 'Max guests per booking',
  instructor_id: 'Instructor',
  occurrences_generated: 'Occurrences',
  // occurrence fields
  starts_at: 'Starts at',
  ends_at: 'Ends at',
  status: 'Status',
}

function fieldLabel(key: string) {
  const t = key.replace(/_/g, ' ')
  return fieldLabels[key] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

function formatValue(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
function formatFieldValue(field: string, v: unknown, timeZone: string | null = null) {
  if (field === 'status' && v != null && v !== '') {
    return statusLabels[String(v).toLowerCase()] ?? formatValue(v)
  }
  // Timestamps arrive as raw ISO strings — show them as studio-time dates.
  if (typeof v === 'string' && ISO_DATETIME.test(v)) return `${formatShortDate(v, timeZone)} · ${formatClock(v, timeZone)}`
  return formatValue(v)
}

function ActionBadge({ action }: { action: string }) {
  const s = actionStyles[action] ?? { tone: 'neutral' as ChipTone, label: action }
  return <Chip tone={s.tone}>{s.label}</Chip>
}

function ChangesDetail({ changes, timeZone }: { changes: string; timeZone: string | null }) {
  let parsed: Record<string, { old: unknown; new: unknown }>
  try {
    parsed = JSON.parse(changes)
  } catch {
    return <p style={{ margin: 0, fontSize: 14, color: color.muted }}>{changes}</p>
  }

  const fields = Object.entries(parsed)
  if (fields.length === 0) return null

  // Generation summaries are already a human sentence — show them as-is, not as a before/after row.
  if (fields.length === 1 && fields[0][0] === 'occurrences_generated') {
    return <p style={{ margin: 0, fontSize: 14, color: color.ink2 }}>{formatValue(fields[0][1].new)}</p>
  }

  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.control, overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            {['Field', 'Before', 'After'].map(h => (
              <th key={h} scope="col" style={{ ...smallCapsStyle, textAlign: 'left', padding: '8px 14px', borderBottom: `1px solid ${color.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map(([field, { old: oldVal, new: newVal }], i) => {
            const td: React.CSSProperties = { padding: '8px 14px', borderBottom: i < fields.length - 1 ? `1px solid ${color.divider}` : 'none', wordBreak: 'break-word', verticalAlign: 'top' }
            return (
              <tr key={field}>
                <td style={{ ...td, fontWeight: 600, color: color.ink2, width: '32%' }}>{fieldLabel(field)}</td>
                <td style={{ ...td, color: color.muted }}>{formatFieldValue(field, oldVal, timeZone)}</td>
                <td style={{ ...td, color: color.ink }}>{formatFieldValue(field, newVal, timeZone)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function EntityActivity({
  orgId, token, entityType, entityId, noun, refreshKey = 0, timeZone = null,
}: { orgId: string; token: string; entityType: string; entityId: string; noun: string; refreshKey?: number; timeZone?: string | null }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState('')

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      entity_type: entityType, entity_id: entityId, limit: '25',
    })
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/audit-log?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    setEntries(res.ok ? await res.json() : [])
  }, [orgId, token, entityType, entityId])

  // refreshKey lets the parent re-pull after it mutates the entity (edit, cancel).
  useEffect(() => {
    if (orgId && token && entityId) load()
  }, [orgId, token, entityId, load, refreshKey])

  const count = entries?.length ?? 0

  return (
    <section aria-labelledby={`activity-${entityId}`} style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px' }}>
        <div>
          <h2 id={`activity-${entityId}`} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Activity</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted }}>
            {entries === null
              ? 'Loading…'
              : count === 0
                ? `Nothing logged for this ${noun} yet.`
                : `${count} change${count === 1 ? '' : 's'} recorded — who changed what, and when.`}
          </p>
        </div>
        {count > 0 && (
          <Button size="sm" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide' : 'Show'}</Button>
        )}
      </div>

      {open && count > 0 && (
        <>
          <div style={{ overflowX: 'auto', borderTop: `1px solid ${color.border}` }}>
            <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr>
                  {['When', 'Who', 'Action', ''].map((h, i) => (
                    <th key={i} scope="col" style={{ ...smallCapsStyle, textAlign: i === 3 ? 'right' : 'left', padding: '10px 20px', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap' }}>
                      {h || <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Details</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries!.map((entry, i) => {
                  const isExpanded = expandedId === entry.id
                  const hasDetail = !!entry.changes || !!entry.reason
                  const last = i === entries!.length - 1
                  const td: React.CSSProperties = { padding: '12px 20px', borderBottom: last && !isExpanded ? 'none' : `1px solid ${color.divider}`, verticalAlign: 'middle' }
                  return (
                    <Fragment key={entry.id}>
                      <tr>
                        <td style={{ ...td, whiteSpace: 'nowrap', color: color.ink2, ...tabularNums }}>
                          {formatShortDate(entry.created_at, timeZone)} · {formatClock(entry.created_at, timeZone)}
                        </td>
                        <td style={td}>
                          <span style={{ display: 'block', fontWeight: 600 }}>{entry.actor_name ?? 'System'}</span>
                          {entry.actor_role && <span style={{ display: 'block', fontSize: 14, color: color.muted }}>{roleLabels[entry.actor_role] ?? entry.actor_role}</span>}
                        </td>
                        <td style={td}><ActionBadge action={effectiveAction(entry)} /></td>
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
                          <td colSpan={4} style={{ padding: '4px 20px 16px', borderBottom: last ? 'none' : `1px solid ${color.divider}` }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {entry.reason && (
                                <div style={{ padding: '10px 14px', background: color.warnBg, borderRadius: radius.control, fontSize: 14, color: color.warnInk }}>
                                  <strong style={{ fontWeight: 600 }}>Reason:</strong> {entry.reason}
                                </div>
                              )}
                              {entry.changes && <ChangesDetail changes={entry.changes} timeZone={timeZone} />}
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
          <p style={{ margin: 0, padding: '12px 20px 16px', fontSize: 13, color: color.muted, borderTop: `1px solid ${color.divider}` }}>
            Related booking and waitlist changes aren&apos;t folded in here yet — see the full{' '}
            <Link href="/dashboard/audit-log" className={ui.focusable} style={{ color: color.primary, fontWeight: 600, textDecoration: 'none' }}>Activity log</Link>.
          </p>
        </>
      )}
    </section>
  )
}
