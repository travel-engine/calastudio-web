'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import Toast from '@/app/components/Toast'
import { canViewMembers, canManageMemberPasses, canResendMemberWelcome, canManageBookings, canViewEntityActivity } from '@/lib/roles'
import ActivityFeed from '@/app/components/ActivityFeed'
import { displayName } from '@/lib/names'
import { formatClock, formatDayMonth, formatRelativeShort, formatShortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { memberActivity, memberActivityLabel } from '@/lib/members'
import { color, font, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Button, Card, Chip, EmptyState, Field, buttonStyle, cardStyle, controlStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

interface MemberDetail {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  date_of_birth: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
  person_type: string | null
  gender: string | null
  roles: string[]
  join_date: string
  join_source: string
  last_seen_at: string | null
  auth_provisioned_at: string | null
  total_sessions_attended: number
  health_notes: string | null
  notes: string | null
}

interface PassTemplate {
  id: string
  name: string
  pass_type: 'credit' | 'unlimited'
  credit_count: number | null
  price: number
  currency: string
  is_active: boolean
}

const paymentMethodOptions: { value: string; label: string }[] = [
  { value: '', label: 'No payment recorded (comp / promo)' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'debit_card', label: 'Debit card' },
  { value: 'gift', label: 'Gift card' },
]

interface MemberPass {
  id: string
  credits_total: number | null
  credits_remaining: number | null
  effective_from: string
  expires_at: string
  status: 'active' | 'low' | 'frozen' | 'expired' | 'exhausted'
  notes: string | null
  pass_template: { name: string } | null
}

interface Order {
  id: string
  created_at: string
  product_name: string
  type: 'booking' | 'pass_purchase' | 'membership_purchase'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'
  amount: number
  currency: string
}

interface UpcomingBooking {
  id: string
  session_occurrence_id?: string
  payment_type: string | null
  session_occurrence: {
    id?: string
    starts_at: string
    session: { name: string; location_name?: string | null } | null
  } | null
  member_pass: { pass_template: { name: string } | null } | null
}

interface LedgerEntry {
  id: string
  movement_type: string
  credits_delta: number
  credits_after: number
  booking_id: string | null
  notes: string | null
  created_at: string
}

const movementLabels: Record<string, string> = {
  purchase: 'Purchase',
  booking_debit: 'Booking',
  cancel_credit: 'Cancellation credit',
  expired_forfeit: 'Expired',
  promotion_credit: 'Promotion',
  studio_adjustment: 'Studio adjustment',
}

const orderTypeLabels: Record<string, string> = {
  booking: 'Class',
  pass_purchase: 'Pass',
  membership_purchase: 'Membership',
}

const genderLabels: Record<string, string> = {
  male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say',
}
const personTypeLabels: Record<string, string> = {
  adult: 'Adult', child: 'Child', senior: 'Senior', student: 'Student',
}

// Status words carry the meaning; tone reinforces it. "Pending" reads as "Awaiting payment" (handoff).
const passStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  active: { label: 'Active', tone: 'primary' },
  low: { label: 'Running low', tone: 'warn' },
  frozen: { label: 'Frozen', tone: 'info' },
  expired: { label: 'Expired', tone: 'neutral' },
  exhausted: { label: 'Used up', tone: 'neutral' },
}
const orderStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  succeeded: { label: 'Paid', tone: 'primary' },
  pending: { label: 'Awaiting payment', tone: 'warn' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  partially_refunded: { label: 'Part refunded', tone: 'neutral' },
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: color.ink }
const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
  color: color.muted, background: '#FAFAF8', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '12px 16px', borderTop: `1px solid ${color.divider}`, fontSize: 15, verticalAlign: 'middle' }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

// "Oct 2026" — the joined chip.
function monthYear(iso: string) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

function SectionHead({ id, title, action }: { id: string; title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px 12px' }}>
      <h2 id={id} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
      {action}
    </div>
  )
}

export default function MemberDetailPage() {
  const router = useRouter()
  const memberId = useParams().id as string

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [currency, setCurrency] = useState('')
  // Bumped after a change on this page so the Activity feeds re-pull.
  const [activityKey, setActivityKey] = useState(0)

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [passes, setPasses] = useState<MemberPass[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingBooking[]>([])

  const [expandedPassId, setExpandedPassId] = useState<string | null>(null)
  const [passLedgers, setPassLedgers] = useState<Record<string, LedgerEntry[]>>({})
  // booking_id -> "Sat 17 Oct, 7:00 am" for ledger rows tied to a booking.
  const [bookingWhen, setBookingWhen] = useState<Record<string, string>>({})

  const [toast, setToast] = useState('')
  const [resendingWelcome, setResendingWelcome] = useState(false)

  const [showIssue, setShowIssue] = useState(false)
  const [templates, setTemplates] = useState<PassTemplate[]>([])
  const [issueForm, setIssueForm] = useState({ passTemplateId: '', effectiveFrom: '', notes: '', paymentMethod: '' })
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState('')

  const authedFetch = useCallback((path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    }), [orgId, token])

  const reloadPasses = useCallback(async () => {
    const p = await authedFetch(`/members/${memberId}/passes`)
    if (p.ok) setPasses(await p.json())
    setPassLedgers({})
    setActivityKey(k => k + 1)
  }, [authedFetch, memberId])

  const togglePassHistory = useCallback(async (passId: string) => {
    if (expandedPassId === passId) { setExpandedPassId(null); return }
    setExpandedPassId(passId)
    if (!passLedgers[passId]) {
      const res = await authedFetch(`/member-passes/${passId}/ledger`)
      if (res.ok) {
        const rows: LedgerEntry[] = await res.json()
        setPassLedgers(prev => ({ ...prev, [passId]: rows }))

        // Resolve the occurrence date/time for each booking-linked row — the ledger only carries
        // booking_id. Lazy, and only for ids not already resolved.
        const ids = [...new Set(rows.map(r => r.booking_id).filter((x): x is string => !!x))]
          .filter(id => !bookingWhen[id])
        if (ids.length) {
          const results = await Promise.all(ids.map(id =>
            authedFetch(`/bookings/${id}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
          ))
          const next: Record<string, string> = {}
          results.forEach((b, i) => {
            const startsAt = b?.session_occurrence?.starts_at
            if (startsAt) next[ids[i]] = `${formatShortDate(startsAt, timeZone)}, ${formatClock(startsAt, timeZone)}`
          })
          if (Object.keys(next).length) setBookingWhen(prev => ({ ...prev, ...next }))
        }
      }
    }
  }, [authedFetch, expandedPassId, passLedgers, bookingWhen, timeZone])

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
      setCurrency(org.currency ?? '')
      const myRoles: string[] = ctx.roles
      setRoles(myRoles)
      if (!canViewMembers(myRoles)) { setForbidden(true); setLoading(false); return }

      const base = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}`
      const h = { Authorization: `Bearer ${t}` }
      const [detailRes, passesRes, ordersRes, upcomingRes] = await Promise.all([
        fetch(`${base}/members/${memberId}`, { headers: h }),
        fetch(`${base}/members/${memberId}/passes`, { headers: h }),
        fetch(`${base}/members/${memberId}/payments`, { headers: h }),
        fetch(`${base}/members/${memberId}/bookings/upcoming`, { headers: h }),
      ])
      if (detailRes.ok) setMember(await detailRes.json())
      if (passesRes.ok) setPasses(await passesRes.json())
      if (ordersRes.ok) setOrders(await ordersRes.json())
      if (upcomingRes.ok) setUpcoming(await upcomingRes.json())
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, memberId])

  const handleResendWelcome = async () => {
    if (resendingWelcome) return
    setResendingWelcome(true)
    try {
      const res = await authedFetch(`/members/${memberId}/resend-welcome`, { method: 'POST' })
      if (res.ok) {
        setToast(`Welcome email re-sent${member ? ` to ${member.email}` : ''}.`)
      } else if (res.status === 404) {
        setToast('This person is no longer an active member.')
      } else {
        setToast('Could not resend the welcome email. Please try again.')
      }
    } catch {
      setToast('Could not reach the server. Please try again.')
    } finally {
      setResendingWelcome(false)
    }
  }

  const openIssue = async () => {
    setIssueForm({ passTemplateId: '', effectiveFrom: '', notes: '', paymentMethod: '' })
    setIssueError('')
    setShowIssue(true)
    const res = await authedFetch('/pass-templates')
    if (res.ok) setTemplates((await res.json() as PassTemplate[]).filter(t => t.is_active))
  }

  const handleIssue = async () => {
    if (!issueForm.passTemplateId) { setIssueError('Choose a pass'); return }
    setIssuing(true)
    setIssueError('')
    try {
      const res = await authedFetch('/member-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: memberId,
          pass_template_id: issueForm.passTemplateId,
          effective_from: issueForm.effectiveFrom || null,
          auto_renew_enabled: false,
          notes: issueForm.notes || null,
          payment_method: issueForm.paymentMethod || null,
        }),
      })
      if (res.ok) {
        setShowIssue(false)
        setIssueForm({ passTemplateId: '', effectiveFrom: '', notes: '', paymentMethod: '' })
        await reloadPasses()
      } else {
        const data = await res.json().catch(() => null)
        setIssueError(data?.error ?? 'Could not issue this pass.')
      }
    } catch {
      setIssueError('Could not reach the server. Please try again.')
    } finally {
      setIssuing(false)
    }
  }

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

  const activePasses = passes.filter(p => p.status === 'active' || p.status === 'low' || p.status === 'frozen')
  const pricingOptionFor = (b: UpcomingBooking) =>
    b.member_pass?.pass_template?.name
    ?? (b.payment_type === 'card' ? 'Drop-in' : b.payment_type === 'free' || b.payment_type === 'admin_waived' ? 'Free' : null)
  const name = (member && displayName(member)) || 'Member'
  const activity = member ? memberActivity(member.auth_provisioned_at, member.last_seen_at) : null
  const notSignedIn = activity != null && activity.kind !== 'seen'
  const nowMs = Date.now()
  const showActivity = canViewEntityActivity(roles) && !!orgId && !!token

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />
      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <Breadcrumb items={[{ label: 'Members', href: '/dashboard/members' }, { label: name }]} />

            {!member ? (
              <Card><EmptyState message="This member couldn't be found." action={<Button href="/dashboard/members">Back to members</Button>} /></Card>
            ) : (
              <>
                {/* Header card */}
                <section style={{ ...cardStyle, padding: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
                  ) : (
                    <span aria-hidden style={{
                      width: 72, height: 72, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: color.primarySoft, color: color.primaryInk, fontSize: 24, fontWeight: 600,
                    }}>{initials(name)}</span>
                  )}
                  <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: 40, lineHeight: 1.05 }}>{name}</h1>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 15, color: color.ink2 }}>
                      <span>{member.email}</span>
                      {member.phone && <span>{member.phone}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      {member.person_type && <Chip>{personTypeLabels[member.person_type] ?? member.person_type}</Chip>}
                      {member.join_date && <Chip>Joined {monthYear(member.join_date)}</Chip>}
                      {activity?.kind === 'seen'
                        ? <Chip>Active {formatRelativeShort(activity.at)}</Chip>
                        : activity && <Chip tone="warn">{activity.kind === 'pending' ? 'Invite pending' : "Hasn't signed in yet"}</Chip>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {canResendMemberWelcome(roles) && notSignedIn && (
                      <Button onClick={handleResendWelcome} disabled={resendingWelcome}>{resendingWelcome ? 'Sending…' : 'Resend invite'}</Button>
                    )}
                    {canManageBookings(roles) && <Button variant="primary" href="/dashboard/schedule">Book a class</Button>}
                  </div>
                </section>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.cardGap, alignItems: 'flex-start' }}>
                  {/* Left: passes, orders, activity */}
                  <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
                    <Card style={{ overflow: 'hidden' }} aria-labelledby="passes-heading">
                      <SectionHead id="passes-heading" title="Passes" action={canManageMemberPasses(roles) && (
                        <Button size="sm" onClick={openIssue}>Add pricing option</Button>
                      )} />
                      {activePasses.length === 0 ? (
                        <p style={{ margin: 0, padding: '4px 20px 18px', fontSize: 15, color: color.muted }}>No active passes.</p>
                      ) : activePasses.map(p => {
                        const isCredit = p.credits_total !== null
                        const open = expandedPassId === p.id
                        const entries = passLedgers[p.id]
                        const ratio = isCredit && p.credits_total ? (p.credits_remaining ?? 0) / p.credits_total : 1
                        const daysLeft = Math.ceil((Date.parse(p.expires_at) - nowMs) / 864e5)
                        const s = passStatusChip[p.status] ?? { label: p.status, tone: 'neutral' as const }
                        return (
                          <div key={p.id} style={{ borderTop: `1px solid ${color.divider}` }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px', padding: '14px 20px' }}>
                              <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <span style={{ fontSize: 16, fontWeight: 600 }}>
                                  {p.pass_template?.name ?? 'Pass'}
                                  {p.notes ? <span style={{ fontWeight: 400, color: color.muted }}> · {p.notes}</span> : null}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {isCredit && (
                                    <div aria-hidden style={{ width: 160, height: 6, borderRadius: 3, background: color.track, overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.round(Math.min(ratio, 1) * 100)}%`, height: '100%', background: ratio <= 0.2 ? color.lowBar : color.primary }} />
                                    </div>
                                  )}
                                  <span style={{ fontSize: 14, color: color.ink2, ...tabularNums }}>
                                    {isCredit ? `${p.credits_remaining} of ${p.credits_total} credits left` : 'Unlimited classes'}
                                  </span>
                                </div>
                              </div>
                              <span style={{ fontSize: 14, color: daysLeft <= 7 ? color.warnInk : color.ink2, fontWeight: daysLeft <= 7 ? 600 : 400, ...tabularNums }}>
                                Expires {formatDayMonth(p.expires_at, timeZone)}
                              </span>
                              <Chip tone={s.tone}>{s.label}</Chip>
                              {(isCredit || showActivity) && (
                                <button type="button" onClick={() => togglePassHistory(p.id)} aria-expanded={open}
                                  className={`${ui.button} ${ui.focusable}`} style={buttonStyle('secondary', 'sm')}>
                                  {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}History
                                </button>
                              )}
                            </div>
                            {open && (
                              <div style={{ padding: '0 20px 14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {!isCredit ? null : !entries ? (
                                  <p style={{ margin: 0, fontSize: 14, color: color.muted }}>Loading history…</p>
                                ) : entries.length === 0 ? (
                                  <p style={{ margin: 0, fontSize: 14, color: color.muted }}>No credit movements.</p>
                                ) : (
                                  <div style={{ border: `1px solid ${color.divider}`, borderRadius: radius.control, overflow: 'hidden' }}>
                                    {entries.map((e, j) => (
                                      <div key={e.id} style={{
                                        display: 'grid', gridTemplateColumns: 'minmax(130px, 160px) 1fr 56px 56px', gap: 8, alignItems: 'center',
                                        padding: '8px 12px', fontSize: 14, borderTop: j ? `1px solid ${color.divider}` : 'none',
                                      }}>
                                        <span style={{ color: color.ink2, ...tabularNums }}>{formatShortDate(e.created_at, timeZone)}, {formatClock(e.created_at, timeZone)}</span>
                                        <span style={{ color: color.ink2 }}>
                                          {movementLabels[e.movement_type] ?? e.movement_type}
                                          {e.booking_id && bookingWhen[e.booking_id] ? ` (${bookingWhen[e.booking_id]})` : ''}
                                          {e.notes ? ` · ${e.notes}` : ''}
                                        </span>
                                        <span style={{ textAlign: 'right', fontWeight: 600, color: e.credits_delta < 0 ? color.dangerInk : color.primaryInk, ...tabularNums }}>
                                          {e.credits_delta > 0 ? '+' : ''}{e.credits_delta}
                                        </span>
                                        <span style={{ textAlign: 'right', color: color.muted, ...tabularNums }} title="Credits after">{e.credits_after}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {showActivity && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <span style={smallCapsStyle}>Activity</span>
                                    <ActivityFeed embedded orgId={orgId} token={token} entityType="member_pass" entityId={p.id}
                                      noun="pass" currency={currency} timeZone={timeZone} refreshKey={activityKey} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </Card>

                    <Card style={{ overflow: 'hidden' }} aria-labelledby="orders-heading">
                      <SectionHead id="orders-heading" title="Orders" action={orders.length > 0 && (
                        <Link href={`/dashboard/members/${memberId}/orders`} className={ui.focusable} style={{ fontSize: 14, fontWeight: 600, color: color.primary, textDecoration: 'none' }}>
                          All orders
                        </Link>
                      )} />
                      {orders.length === 0 ? (
                        <p style={{ margin: 0, padding: '4px 20px 18px', fontSize: 15, color: color.muted }}>No orders yet.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                            <thead><tr><th style={th}>Date</th><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Status</th></tr></thead>
                            <tbody>
                              {orders.slice(0, 15).map(o => {
                                const s = orderStatusChip[o.status] ?? { label: o.status, tone: 'neutral' as const }
                                return (
                                  <tr key={o.id}>
                                    <td style={{ ...td, color: color.ink2, whiteSpace: 'nowrap', ...tabularNums }}>{formatDayMonth(o.created_at, timeZone)}</td>
                                    <td style={td}>
                                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Link href={`/dashboard/orders/${o.id}`} className={ui.focusable} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{o.product_name}</Link>
                                        <span style={{ fontSize: 13, color: color.muted }}>{orderTypeLabels[o.type] ?? o.type}</span>
                                      </span>
                                    </td>
                                    <td style={{ ...td, textAlign: 'right', ...tabularNums }}>{formatMoney(o.amount, o.currency)}</td>
                                    <td style={td}><Chip tone={s.tone}>{s.label}</Chip></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>

                    {showActivity && (
                      <ActivityFeed orgId={orgId} token={token} entityType="member" entityId={memberId}
                        noun="member" currency={currency} timeZone={timeZone} refreshKey={activityKey} />
                    )}
                  </div>

                  {/* Right: upcoming, details, notes */}
                  <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
                    <Card style={{ overflow: 'hidden' }} aria-labelledby="upcoming-heading">
                      <SectionHead id="upcoming-heading" title="Upcoming" />
                      {upcoming.length === 0 ? (
                        <p style={{ margin: 0, padding: '4px 20px 18px', fontSize: 15, color: color.muted }}>No upcoming bookings.</p>
                      ) : upcoming.map(b => {
                        const occ = b.session_occurrence
                        const occId = b.session_occurrence_id ?? occ?.id
                        const starts = occ?.starts_at
                        const weekday = starts ? formatShortDate(starts, timeZone).split(' ')[0].toUpperCase() : ''
                        const dayNum = starts ? formatDayMonth(starts, timeZone).split(' ')[0] : ''
                        const meta = [starts && formatClock(starts, timeZone), occ?.session?.location_name, pricingOptionFor(b)].filter(Boolean).join(' · ')
                        const inner = (
                          <>
                            <span aria-hidden style={{
                              width: 52, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0',
                              borderRadius: radius.control, background: color.primarySoft, color: color.primaryInk,
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{weekday}</span>
                              <span style={{ fontSize: 20, fontWeight: 600, ...tabularNums }}>{dayNum}</span>
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                              <span style={{ fontWeight: 600 }}>{occ?.session?.name ?? 'Class'}</span>
                              <span style={{ fontSize: 14, color: color.ink2, ...tabularNums }}>
                                {starts && <span className={styles.srOnly}>{formatShortDate(starts, timeZone)}, </span>}{meta}
                              </span>
                            </span>
                          </>
                        )
                        const rowStyle: React.CSSProperties = {
                          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderTop: `1px solid ${color.divider}`,
                          textDecoration: 'none', color: color.ink, ['--hover-bg' as string]: '#F7F8F5',
                        }
                        return occId ? (
                          <Link key={b.id} href={`/dashboard/occurrences/${occId}`} className={`${ui.rowLink} ${ui.focusable}`} style={rowStyle}>{inner}</Link>
                        ) : (
                          <div key={b.id} style={rowStyle}>{inner}</div>
                        )
                      })}
                    </Card>

                    <Card padded aria-labelledby="details-heading">
                      <h2 id="details-heading" style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>Details</h2>
                      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px 20px' }}>
                        {[
                          ['Date of birth', member.date_of_birth ? formatDayMonth(member.date_of_birth) : null],
                          ['Emergency contact', member.emergency_contact_name
                            ? `${member.emergency_contact_name}${member.emergency_contact_phone ? ` · ${member.emergency_contact_phone}` : ''}` : null],
                          ['Address', member.address],
                          ['Gender', member.gender ? genderLabels[member.gender] ?? member.gender : null],
                          ['Joined via', member.join_source ? member.join_source.replace(/_/g, ' ') : null],
                          ['Classes attended', String(member.total_sessions_attended)],
                        ].map(([label, value]) => (
                          <div key={label as string}>
                            <dt style={{ ...smallCapsStyle, marginBottom: 4 }}>{label}</dt>
                            <dd style={{ margin: 0, fontSize: 15, color: value ? color.ink : color.muted, ...tabularNums }}>{value || 'Not added'}</dd>
                          </div>
                        ))}
                      </dl>
                    </Card>

                    <section aria-labelledby="notes-heading" style={{ ...cardStyle, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: '#F7F8F5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <h2 id="notes-heading" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Notes</h2>
                        <Chip>Staff only</Chip>
                      </div>
                      {member.health_notes || member.notes ? (
                        <>
                          {member.health_notes && (
                            <div>
                              <div style={{ ...smallCapsStyle, marginBottom: 4 }}>Health</div>
                              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{member.health_notes}</p>
                            </div>
                          )}
                          {member.notes && (
                            <div>
                              <div style={{ ...smallCapsStyle, marginBottom: 4 }}>General</div>
                              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{member.notes}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.muted }}>No notes yet. Health and admin notes are never shown to the member.</p>
                      )}
                    </section>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showIssue && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(23, 32, 28, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24,
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="issue-heading" style={{
            background: color.surface, borderRadius: radius.card, padding: 28, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: font.body,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <h2 id="issue-heading" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Add a pass for {name}</h2>
              <button type="button" aria-label="Close" onClick={() => setShowIssue(false)} className={ui.focusable}
                style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}>
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>

            {issueError && (
              <div role="alert" style={{ padding: '10px 12px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15, marginBottom: 16 }}>
                {issueError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
              <Field label="Pass" htmlFor="issue-pass" hint={templates.length === 0 ? 'No active pass types yet. Create one on the Passes page.' : undefined}>
                <select id="issue-pass" value={issueForm.passTemplateId} onChange={e => setIssueForm(f => ({ ...f, passTemplateId: e.target.value }))} style={controlStyle}>
                  <option value="">Choose a pass type…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} · {t.pass_type === 'credit' ? `${t.credit_count} credits` : 'unlimited'}</option>
                  ))}
                </select>
              </Field>

              <Field label="Starts" htmlFor="issue-from" hint="Leave blank for today. Expiry comes from the pass type.">
                <input id="issue-from" type="date" value={issueForm.effectiveFrom} onChange={e => setIssueForm(f => ({ ...f, effectiveFrom: e.target.value }))} style={controlStyle} />
              </Field>

              <div>
                <label htmlFor="issue-payment" style={labelStyle}>Payment</label>
                <select id="issue-payment" value={issueForm.paymentMethod} onChange={e => setIssueForm(f => ({ ...f, paymentMethod: e.target.value }))} style={controlStyle}>
                  {paymentMethodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {issueForm.paymentMethod && (() => {
                  const t = templates.find(x => x.id === issueForm.passTemplateId)
                  return (
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: color.muted }}>
                      {t ? `Records a ${formatMoney(t.price, t.currency)} payment in this member's order history.` : "Records a payment for the pass price in this member's order history."}
                    </p>
                  )
                })()}
              </div>

              <Field label="Notes (optional)" htmlFor="issue-notes">
                <input id="issue-notes" type="text" placeholder="e.g. comp for referral, family member" value={issueForm.notes}
                  onChange={e => setIssueForm(f => ({ ...f, notes: e.target.value }))} style={controlStyle} />
              </Field>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Button onClick={() => setShowIssue(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button variant="primary" onClick={handleIssue} disabled={issuing || !issueForm.passTemplateId} style={{ flex: 1 }}>
                  {issuing ? 'Adding…' : 'Add pass'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
