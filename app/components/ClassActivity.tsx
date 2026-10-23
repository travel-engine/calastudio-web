'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { formatClock, formatShortDate, dayKey } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color, radius, tabularNums } from '@/lib/ui/tokens'
import { Button, cardStyle } from '@/app/components/admin'
import { ChangesDetail } from '@/app/components/EntityActivity'

// Everything that happened on one class, newest first: edits, bookings, cancellations, waitlist
// moves, refunds, and who checked whom in and how. A view over the activity log
// (GET …/occurrences/{id}/activity), where each event is recorded once. Each kind of event gets a
// sentence here; one without a sentence yet still shows, under a generic one.

export interface ClassActivityEntry {
  id: string
  at: string
  kind: string | null
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  channel: 'self_service' | 'staff' | 'system' | null
  method: 'staff_roster' | 'booking_qr' | 'self_qr' | 'kiosk' | null
  subject_user_id: string | null
  subject_name: string | null
  guest_index: number | null
  guest_label: string | null
  details: Record<string, { old: unknown; new: unknown }> | null
  reason: string | null
}

const ROLE: Record<string, string> = {
  admin: 'Admin', teacher_super: 'Senior teacher', teacher_general: 'Teacher', teacher_basic: 'Teacher',
  front_desk: 'Front desk', member: 'Member',
}

// How someone was checked in. Only the roster exists today; the others are planned.
const METHOD: Record<string, string> = {
  staff_roster: 'roster', booking_qr: 'booking QR', self_qr: 'wall QR', kiosk: 'kiosk',
}

const b = (s: ReactNode) => <strong style={{ fontWeight: 600 }}>{s}</strong>

function sentence(e: ClassActivityEntry, currency: string): ReactNode {
  const actor = b(e.actor_name ?? 'System')
  const member = b(e.subject_name ?? 'A member')
  const guest = <>{b(e.guest_label ?? 'A guest')} ({e.subject_name ?? 'a member'}&apos;s booking)</>
  const self = e.channel === 'self_service'
  const system = e.channel === 'system' || !e.actor_name
  const studioCancel = e.details?.cancellation_reason?.new === 'StudioCancel'
  const refund = e.details?.refunded_amount?.new
  const credits = e.details?.credits_refunded?.new

  switch (e.kind) {
    case 'class_created': return <>{actor} created the class</>
    case 'class_edited': return <>{actor} edited the class</>
    case 'class_rescheduled': return <>{actor} rescheduled the class</>
    case 'class_cancelled': return <>{actor} cancelled the class</>
    case 'booked': return self ? <>{member} booked</> : <>{actor} added {member}</>
    case 'booking_cancelled':
      if (studioCancel) return <>{member}&apos;s booking was cancelled with the class</>
      return self ? <>{member} cancelled their booking</> : <>{actor} cancelled {member}&apos;s booking</>
    case 'late_cancelled':
      return self ? <>{member} cancelled late</> : <>{actor} cancelled {member}&apos;s booking (late)</>
    case 'guest_cancelled': return <>{actor} cancelled {guest}</>
    case 'checked_in': return self ? <>{member} checked themselves in</> : <>{actor} checked in {member}</>
    case 'check_in_undone': return <>{actor} undid {member}&apos;s check-in</>
    case 'guest_checked_in': return <>{actor} checked in {guest}</>
    case 'guest_check_in_undone': return <>{actor} undid the check-in for {guest}</>
    case 'waitlist_joined': return <>{member} joined the waitlist</>
    case 'waitlist_left': return <>{member} left the waitlist</>
    case 'waitlist_claimed': return <>{member} took a spot from the waitlist</>
    case 'waitlist_promoted': return <>{member} was offered a spot from the waitlist</>
    case 'waitlist_expired': return <>{member}&apos;s waitlist offer expired</>
    case 'waitlist_dead_zone': return <>{member}&apos;s waitlist place lapsed close to class time</>
    case 'refunded': {
      const amount = typeof refund === 'number' ? ` ${formatMoney(refund, currency)}` : ''
      return system ? <>{member} was refunded{amount} automatically</> : <>{actor} refunded {member}{amount}</>
    }
    case 'credit_refunded': {
      const n = typeof credits === 'number' ? credits : null
      return <>{actor} returned {n === null ? 'credits' : `${n} credit${n === 1 ? '' : 's'}`} to {member}</>
    }
    default:
      return <>{actor} {(e.kind ?? 'made a change').replace(/_/g, ' ')}{e.subject_name ? <> · {member}</> : null}</>
  }
}

export default function ClassActivity({ orgId, token, occurrenceId, refreshKey = 0, timeZone = null, currency }: {
  orgId: string; token: string; occurrenceId: string; refreshKey?: number; timeZone?: string | null; currency: string
}) {
  const [entries, setEntries] = useState<ClassActivityEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/occurrences/${occurrenceId}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setFailed(true); setEntries([]); return }
      const data = await res.json()
      setFailed(false)
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true); setEntries([])
    }
  }, [orgId, token, occurrenceId])

  // refreshKey lets the class page re-pull after a check-in, cancellation or edit.
  useEffect(() => { if (orgId && token && occurrenceId) load() }, [orgId, token, occurrenceId, load, refreshKey])

  const count = entries?.length ?? 0
  const today = dayKey(new Date().toISOString(), timeZone)

  return (
    <section aria-labelledby="class-activity" style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px' }}>
        <div>
          <h2 id="class-activity" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Activity</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted }}>
            {entries === null ? 'Loading…'
              : failed ? "Couldn't load this class's activity."
              : count === 0 ? 'Nothing has happened on this class yet.'
              : `${count} event${count === 1 ? '' : 's'}: bookings, check-ins, cancellations and edits, and who did them.`}
          </p>
        </div>
        {count > 0 && <Button size="sm" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide' : 'Show'}</Button>}
      </div>

      {open && count > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: `1px solid ${color.border}` }}>
          {entries!.map((e, i) => {
            const hasDetail = !!e.reason || (!!e.details && (e.kind === 'class_edited' || e.kind === 'class_rescheduled'))
            const expanded = expandedId === e.id
            const role = e.actor_role ? ROLE[e.actor_role] ?? e.actor_role : null
            const how = e.method ? METHOD[e.method] ?? e.method : null
            const when = dayKey(e.at, timeZone) === today
              ? formatClock(e.at, timeZone)
              : `${formatShortDate(e.at, timeZone)} · ${formatClock(e.at, timeZone)}`
            return (
              <li key={e.id} style={{ padding: '12px 20px', borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ flex: '0 0 auto', minWidth: 72, fontSize: 14, color: color.muted, ...tabularNums }}>{when}</span>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 15, lineHeight: 1.45 }}>{sentence(e, currency)}</div>
                    {(role || how) && (
                      <div style={{ fontSize: 13, color: color.muted, marginTop: 2 }}>
                        {[role, how && `via ${how}`].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  {hasDetail && (
                    <Button size="sm" onClick={() => setExpandedId(expanded ? '' : e.id)} aria-expanded={expanded}>
                      {expanded ? 'Hide' : 'Details'}
                    </Button>
                  )}
                </div>
                {expanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {e.reason && (
                      <div style={{ padding: '10px 14px', background: color.warnBg, borderRadius: radius.control, fontSize: 14, color: color.warnInk }}>
                        <strong style={{ fontWeight: 600 }}>Reason:</strong> {e.reason}
                      </div>
                    )}
                    {e.details && (e.kind === 'class_edited' || e.kind === 'class_rescheduled') && (
                      <ChangesDetail changes={JSON.stringify(e.details)} timeZone={timeZone} />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
