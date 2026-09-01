'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/dates'

// Scoped, read-only view of the org-wide activity log (app/dashboard/audit-log), pre-filtered to a
// single session — the "Audit History" surface called for in calastudio-spec/08-dashboard-reporting.md
// §8.10. This v1 shows only rows logged directly against the session entity (its creation with the
// occurrence-generation summary, every field edit, and the nightly generation summaries); occurrence,
// booking and waitlist rows will fold in once audit_log carries a denormalised session_id.

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

const actionStyles: Record<string, { bg: string; color: string; label: string }> = {
  create: { bg: '#e8f5ee', color: '#085041', label: 'Created' },
  update: { bg: '#e8eef8', color: '#1B4F8A', label: 'Updated' },
  delete: { bg: '#fdecea', color: '#8b1a1a', label: 'Deleted' },
  override: { bg: '#fff3cd', color: '#7a4f00', label: 'Override' },
  system: { bg: '#f4f4f4', color: '#666', label: 'System' },
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  teacher_super: 'Super teacher',
  teacher_general: 'Teacher',
  teacher_basic: 'Basic teacher',
  front_desk: 'Front desk',
  member: 'Member',
}

// Prettier labels for the session fields that show up in a diff; anything not listed falls back to
// the raw key with underscores turned into spaces.
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
  booking_window_days: 'Booking window (days)',
  min_advance_booking_hours: 'Min advance booking (h)',
  tax_rate_override: 'Tax rate override',
  guest_bookings_enabled: 'Guests allowed',
  guest_max_per_booking: 'Max guests per booking',
  instructor_id: 'Instructor',
  occurrences_generated: 'Occurrences',
}

function fieldLabel(key: string) {
  return fieldLabels[key] ?? key.replace(/_/g, ' ')
}

function formatValue(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function ActionBadge({ action }: { action: string }) {
  const s = actionStyles[action] ?? { bg: '#f4f4f4', color: '#666', label: action }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  )
}

function ChangesDetail({ changes }: { changes: string }) {
  let parsed: Record<string, { old: unknown; new: unknown }>
  try {
    parsed = JSON.parse(changes)
  } catch {
    return <p style={{ fontSize: '12px', color: '#666' }}>{changes}</p>
  }

  const fields = Object.entries(parsed)
  if (fields.length === 0) return null

  // Generation summaries are already a human sentence — show them as-is, not as an old → new row.
  if (fields.length === 1 && fields[0][0] === 'occurrences_generated') {
    return (
      <p style={{ fontSize: '12px', color: '#444', marginTop: '8px' }}>
        {formatValue(fields[0][1].new)}
      </p>
    )
  }

  return (
    <div style={{ marginTop: '10px', border: '1px solid #f4f4f4', borderRadius: '8px', overflow: 'hidden' }}>
      {fields.map(([field, { old: oldVal, new: newVal }], i) => (
        <div key={field} style={{
          display: 'grid', gridTemplateColumns: '160px 1fr 24px 1fr',
          padding: '8px 12px', alignItems: 'center', fontSize: '12px',
          borderBottom: i < fields.length - 1 ? '1px solid #f4f4f4' : 'none',
          backgroundColor: i % 2 === 0 ? '#fafafa' : 'white',
        }}>
          <div style={{ fontWeight: 600, color: '#444' }}>{fieldLabel(field)}</div>
          <div style={{ color: '#8b1a1a', wordBreak: 'break-word' }}>{formatValue(oldVal)}</div>
          <div style={{ textAlign: 'center', color: '#999' }}>→</div>
          <div style={{ color: '#085041', wordBreak: 'break-word' }}>{formatValue(newVal)}</div>
        </div>
      ))}
    </div>
  )
}

export default function SessionActivity({
  orgId, token, sessionId,
}: { orgId: string; token: string; sessionId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState('')

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      entity_type: 'session', entity_id: sessionId, limit: '25',
    })
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/audit-log?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    setEntries(res.ok ? await res.json() : [])
  }, [orgId, token, sessionId])

  useEffect(() => {
    if (orgId && token && sessionId) load()
  }, [orgId, token, sessionId, load])

  const count = entries?.length ?? 0

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '12px', padding: '32px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '24px',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 600 }}>Activity</h2>
          <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
            {entries === null
              ? 'Loading…'
              : count === 0
                ? 'Nothing logged for this session yet.'
                : `${count} change${count === 1 ? '' : 's'} recorded — who changed what, and when.`}
          </p>
        </div>
        {count > 0 && (
          <span style={{ fontSize: '13px', color: '#085041', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '16px' }}>
            {open ? 'Hide' : 'Show'}
          </span>
        )}
      </button>

      {open && count > 0 && (
        <div style={{ marginTop: '20px', border: '1px solid #f4f4f4', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '150px 1.4fr 100px 80px',
            padding: '10px 16px', backgroundColor: '#f4f4f4',
            fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <div>When</div>
            <div>Who</div>
            <div>Action</div>
            <div>Details</div>
          </div>

          {entries!.map((entry, i) => {
            const isExpanded = expandedId === entry.id
            const hasDetail = !!entry.changes || !!entry.reason
            return (
              <div key={entry.id} style={{ borderBottom: i < entries!.length - 1 ? '1px solid #f4f4f4' : 'none' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '150px 1.4fr 100px 80px',
                  padding: '10px 16px', alignItems: 'center', fontSize: '13px',
                }}>
                  <div style={{ color: '#444' }}>
                    {formatDateTime(entry.created_at)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{entry.actor_name ?? 'System'}</div>
                    {entry.actor_role && (
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {roleLabels[entry.actor_role] ?? entry.actor_role}
                      </div>
                    )}
                  </div>
                  <div><ActionBadge action={entry.action} /></div>
                  <div>
                    {hasDetail && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? '' : entry.id)}
                        style={{
                          padding: '5px 10px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                          fontSize: '11px', color: '#444', cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        {isExpanded ? 'Hide' : 'View'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 14px' }}>
                    {entry.reason && (
                      <div style={{
                        padding: '10px 12px', backgroundColor: '#fff3cd', borderRadius: '8px',
                        fontSize: '12px', color: '#7a4f00', marginBottom: entry.changes ? '10px' : 0,
                      }}>
                        <strong>Reason:</strong> {entry.reason}
                      </div>
                    )}
                    {entry.changes && <ChangesDetail changes={entry.changes} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {open && count > 0 && (
        <p style={{ fontSize: '12px', color: '#999', marginTop: '12px' }}>
          Occurrence, booking and waitlist changes for this session aren&apos;t shown here yet — see the
          full <a href="/dashboard/audit-log" style={{ color: '#085041', fontWeight: 500 }}>Activity log</a>.
        </p>
      )}
    </div>
  )
}
