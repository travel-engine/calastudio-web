'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { formatClock, formatShortDate, dayKey } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color, radius, tabularNums } from '@/lib/ui/tokens'
import { Button, cardStyle } from '@/app/components/admin'
import { ChangesDetail } from '@/app/components/EntityActivity'

// The activity log as plain sentences: who did what to whom, and how. One item shape serves the
// class feed (GET …/occurrences/{id}/activity, see ClassActivity) and the entity feed
// (GET …/activity?entity_type=&entity_id=), spec 08 §8.10a/§8.10b. Class events carry a short
// `kind`; everything else is named by its namespaced `event` (pass.credits_adjusted, member.updated,
// …). An event without a sentence yet still shows, under a generic one built from its name and label.

export interface ActivityEntry {
  id: string
  at: string
  kind: string | null
  event: string | null
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  actor_type: 'staff' | 'member' | 'system' | 'stripe' | 'kiosk' | null
  source: string | null
  channel: 'self_service' | 'staff' | 'system' | null
  method: 'staff_roster' | 'booking_qr' | 'self_qr' | 'kiosk' | null
  subject_user_id: string | null
  subject_name: string | null
  guest_index: number | null
  guest_label: string | null
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  details: Record<string, { old: unknown; new: unknown }> | null
  metadata: Record<string, unknown> | null
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

// Where a change came from, when it wasn't simply someone on the dashboard.
const SOURCE: Record<string, string> = {
  member_site: 'member site', job: 'automatic', stripe_webhook: 'Stripe', kiosk: 'kiosk', qr: 'QR',
}

// details.status.new is the PascalCase name ("Frozen"); rows written before backend PR #53 hold
// the enum number instead.
const PASS_STATUS: Record<string, string> = {
  active: 'active', low: 'running low', frozen: 'frozen', expired: 'expired', exhausted: 'used up', refunded: 'refunded',
  '0': 'active', '1': 'running low', '2': 'frozen', '3': 'expired', '4': 'used up', '5': 'refunded',
}

const b = (s: ReactNode) => <strong style={{ fontWeight: 600 }}>{s}</strong>

// Events whose `details` diff is worth opening: edits to a thing's fields. Booking rows carry
// payment bookkeeping there instead, which the sentence already covers.
const DIFF_KINDS = new Set(['class_edited', 'class_rescheduled'])
const DIFF_NAMESPACES = new Set(['member', 'pass', 'pass_template', 'session', 'settings', 'billing', 'teacher_page'])
function showsDiff(e: ActivityEntry) {
  if (!e.details || Object.keys(e.details).length === 0) return false
  if (e.kind) return DIFF_KINDS.has(e.kind)
  return DIFF_NAMESPACES.has((e.event ?? '').split('.')[0])
}

// On a member's or pass's page a class event needs to say which class: the booking / occurrence
// label, minus the member's name it starts with ("Ann Lee · Flow · Sat 24 Oct" → "Flow · Sat 24 Oct").
function classLabel(e: ActivityEntry) {
  const t = e.entity_type ?? ''
  if (!e.entity_label || !(t === 'booking' || t === 'session_occurrence' || t.startsWith('waitlist'))) return null
  const prefix = e.subject_name ? `${e.subject_name} · ` : ''
  return prefix && e.entity_label.startsWith(prefix) ? e.entity_label.slice(prefix.length) : e.entity_label
}

function classSentence(e: ActivityEntry, currency: string): ReactNode {
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

// Everything that isn't a class event, by namespaced event (catalogue: spec 08 §8.10b).
function eventSentence(e: ActivityEntry): ReactNode {
  const actor = b(e.actor_name ?? (e.actor_type === 'stripe' ? 'Stripe' : 'System'))
  const member = b(e.subject_name ?? 'A member')
  const label = e.entity_label ? b(e.entity_label) : null
  const self = e.actor_type === 'member'
  const system = e.actor_type === 'system' || e.actor_type === 'stripe' || !e.actor_name
  const status = e.details?.status?.new

  switch (e.event) {
    // Passes: the label is the pass's name.
    case 'pass.issued': return self ? <>{member} bought {label ?? 'a pass'}</> : <>{actor} gave {member} {label ?? 'a pass'}</>
    case 'pass.credits_adjusted': {
      const before = e.details?.credits_remaining?.old
      const after = e.details?.credits_remaining?.new
      const delta = typeof before === 'number' && typeof after === 'number' ? after - before : null
      const what = delta === null ? 'adjusted the credits on' : `${delta > 0 ? 'added' : 'removed'} ${Math.abs(delta)} credit${Math.abs(delta) === 1 ? '' : 's'} ${delta > 0 ? 'to' : 'from'}`
      return <>{actor} {what} {label ?? 'a pass'}</>
    }
    case 'pass.status_changed': {
      const key = typeof status === 'string' || typeof status === 'number' ? String(status).toLowerCase() : null
      const word = key ? PASS_STATUS[key] ?? key : null
      const pass = label ?? 'a pass'
      if (system) return word ? <>{label ?? 'A pass'} is now {word}</> : <>{label ?? 'A pass'} changed status</>
      if (word === 'frozen') return <>{actor} froze {pass}</>
      return word ? <>{actor} set {pass} to {word}</> : <>{actor} changed the status of {pass}</>
    }
    case 'pass.expired': return <>{label ?? 'A pass'} expired</>
    case 'pass.refunded_voided': return <>{actor} refunded and cancelled {label ?? 'a pass'}</>

    // Payments: the label is "AUD 25.00 · credit card" (or "Payment" without financial access).
    case 'payment.created': return self ? <>{member} started a payment: {label}</> : <>{actor} started a payment: {label}</>
    case 'payment.recorded': return <>{actor} recorded a payment: {label}</>
    case 'payment.succeeded': return <>Payment received: {label}</>
    case 'payment.failed': return <>A payment failed: {label}</>
    case 'payment.cancelled': return <>A payment was cancelled: {label}</>
    case 'payment.refunded': return system ? <>Refunded automatically: {label}</> : <>{actor} refunded {label}</>

    // The member's own record.
    case 'member.added': return self ? <>{member} signed up</> : <>{actor} added {member} as a member</>
    case 'member.updated': return self ? <>{member} updated their details</> : <>{actor} updated {member}&apos;s details</>
    case 'member.roles_changed': return <>{actor} changed {member}&apos;s roles</>
    case 'member.waiver_accepted': return <>{member} accepted the waiver</>
    case 'member.removed': return <>{actor} removed {member} from the studio</>

    case 'pass_template.created': return <>{actor} created the pass {label}</>
    case 'pass_template.updated': return <>{actor} edited the pass {label}</>
    case 'pass_template.deleted': return <>{actor} deleted the pass {label}</>
    case 'session.created': return <>{actor} created {label ?? 'a class'}</>
    case 'session.updated': return <>{actor} edited {label ?? 'a class'}</>
    case 'session.deleted': return <>{actor} deleted {label ?? 'a class'}</>
    case 'session.occurrences_generated': return <>{label ?? 'A class'}: new dates added to the timetable</>
    case 'session.pricing_updated': {
      // The row is on session_pricing_access, labelled "{session} pricing".
      const cls = e.entity_label?.replace(/ pricing$/, '')
      return <>{actor} changed which passes {cls ? b(cls) : 'a class'} accepts</>
    }

    // Teacher pages: the label (and subject) is the teacher.
    case 'teacher_page.created': return <>{actor} created {member}&apos;s teacher page</>
    case 'teacher_page.updated': {
      const published = e.details?.is_page_published?.new
      if (published === true) return <>{actor} published {member}&apos;s teacher page</>
      if (published === false) return <>{actor} unpublished {member}&apos;s teacher page</>
      return <>{actor} edited {member}&apos;s teacher page</>
    }
    case 'teacher_page.slug_changed': return <>{actor} changed the web address of {member}&apos;s teacher page</>

    // Studio-wide.
    case 'studio.created': return <>{actor} created the studio{label ? <> {label}</> : null}</>
    case 'settings.updated': return <>{actor} changed the studio settings</>
    case 'settings.stripe_connected': return <>{actor} connected Stripe</>
    case 'settings.stripe_disconnected': return <>{actor} disconnected Stripe</>
    case 'settings.waiver_updated': return <>{actor} updated the liability waiver</>
    case 'settings.tax_rate_changed': return <>{actor} changed the tax rates</>
    case 'billing.plan_changed': return <>{actor} changed the CalaStudio plan</>
    case 'billing.updated': return <>{actor} updated CalaStudio billing</>
  }

  // Generic: "{actor} {verb} {label}", from the event's own name.
  const [ns = '', verb = 'changed'] = (e.event ?? '').split('.')
  const what = label ?? (ns ? <>a {ns.replace(/_/g, ' ')}</> : 'something')
  return <>{actor} {verb.replace(/_/g, ' ')} {what}</>
}

export function sentence(e: ActivityEntry, currency: string, context: 'class' | 'entity'): ReactNode {
  if (!e.kind) return eventSentence(e)
  const s = classSentence(e, currency)
  const where = context === 'entity' ? classLabel(e) : null
  return where ? <>{s} · <span style={{ color: color.ink2 }}>{where}</span></> : s
}

// The list itself: one row per event, newest first, with Details for reasons and field diffs.
export function ActivityItems({ entries, currency, timeZone, context }: {
  entries: ActivityEntry[]; currency: string; timeZone: string | null; context: 'class' | 'entity'
}) {
  const [expandedId, setExpandedId] = useState('')
  const today = dayKey(new Date().toISOString(), timeZone)

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {entries.map((e, i) => {
        const diff = showsDiff(e)
        const hasDetail = !!e.reason || diff
        const expanded = expandedId === e.id
        const role = e.actor_role ? ROLE[e.actor_role] ?? e.actor_role : null
        const how = e.method ? METHOD[e.method] ?? e.method : null
        const from = !how && e.source ? SOURCE[e.source] ?? null : null
        const when = dayKey(e.at, timeZone) === today
          ? formatClock(e.at, timeZone)
          : `${formatShortDate(e.at, timeZone)} · ${formatClock(e.at, timeZone)}`
        return (
          <li key={e.id} style={{ padding: '12px 20px', borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ flex: '0 0 auto', minWidth: 72, fontSize: 14, color: color.muted, ...tabularNums }}>{when}</span>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 15, lineHeight: 1.45 }}>{sentence(e, currency, context)}</div>
                {(role || how || from) && (
                  <div style={{ fontSize: 13, color: color.muted, marginTop: 2 }}>
                    {[role, how && `via ${how}`, from && `via ${from}`].filter(Boolean).join(' · ')}
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
                {diff && <ChangesDetail changes={JSON.stringify(e.details)} timeZone={timeZone} />}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const PAGE = 25

// Everything linked to one record (a member, a pass, a payment, …), newest first, 25 at a time.
// Admin and teacher_super only (canViewEntityActivity).
export default function ActivityFeed({ orgId, token, entityType, entityId, currency, timeZone = null, refreshKey = 0, noun, embedded = false }: {
  orgId: string; token: string; entityType: string; entityId: string; currency: string
  timeZone?: string | null; refreshKey?: number; noun: string
  // Embedded: no card, no Show/Hide; for a panel that's already been opened (a pass's history).
  embedded?: boolean
}) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(embedded)

  const fetchPage = useCallback(async (offset: number) => {
    const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId, limit: String(PAGE), offset: String(offset) })
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/activity?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    return Array.isArray(data) ? data as ActivityEntry[] : []
  }, [orgId, token, entityType, entityId])

  // refreshKey lets the page re-pull after it changes something (issues a pass, adjusts credits).
  useEffect(() => {
    if (!orgId || !token || !entityId) return
    let cancelled = false
    fetchPage(0)
      .then(rows => { if (!cancelled) { setFailed(false); setEntries(rows); setMore(rows.length === PAGE) } })
      .catch(() => { if (!cancelled) { setFailed(true); setEntries([]); setMore(false) } })
    return () => { cancelled = true }
  }, [orgId, token, entityId, fetchPage, refreshKey])

  const loadMore = async () => {
    if (!entries || loadingMore) return
    setLoadingMore(true)
    try {
      const rows = await fetchPage(entries.length)
      setEntries(prev => [...(prev ?? []), ...rows])
      setMore(rows.length === PAGE)
    } catch {
      setMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const count = entries?.length ?? 0
  const status = entries === null ? 'Loading…'
    : failed ? `Couldn't load this ${noun}'s activity.`
    : count === 0 ? `Nothing recorded for this ${noun} yet.`
    : null

  const list = count > 0 && (
    <>
      <ActivityItems entries={entries!} currency={currency} timeZone={timeZone} context="entity" />
      {more && (
        <div style={{ padding: '10px 20px 14px', borderTop: `1px solid ${color.divider}` }}>
          <Button size="sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show older'}</Button>
        </div>
      )}
    </>
  )

  if (embedded) {
    return status
      ? <p style={{ margin: 0, fontSize: 14, color: color.muted }}>{status}</p>
      : <div style={{ border: `1px solid ${color.divider}`, borderRadius: radius.control, overflow: 'hidden' }}>{list}</div>
  }

  const headingId = `activity-${entityType}-${entityId}`
  return (
    <section aria-labelledby={headingId} style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px' }}>
        <div>
          <h2 id={headingId} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Activity</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted }}>
            {status ?? `Bookings, check-ins, passes, payments and changes, and who made them.`}
          </p>
        </div>
        {count > 0 && <Button size="sm" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide' : 'Show'}</Button>}
      </div>
      {open && list && <div style={{ borderTop: `1px solid ${color.border}` }}>{list}</div>}
    </section>
  )
}
