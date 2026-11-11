'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import Toast from '@/app/components/Toast'
import ActivityFeed from '@/app/components/ActivityFeed'
import { canManageMemberMemberships, canChangeMemberMembershipPrice, canViewEntityActivity } from '@/lib/roles'
import {
  MEMBERSHIP_STATUS, dateOnlyLabel, isLiveMembership, localDateKey, periodUnit,
  type MembershipRefundQuote, type StaffMembershipDetail,
} from '@/lib/memberships'
import { formatMoney } from '@/lib/money'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Button, Card, Chip, ChoiceGroup, Field, Modal, CheckRow, alertStyle, controlStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

const paymentChip: Record<string, { label: string; tone: ChipTone }> = {
  succeeded: { label: 'Paid', tone: 'primary' },
  pending: { label: 'Awaiting payment', tone: 'warn' },
  requires_action: { label: 'Awaiting payment', tone: 'warn' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  partially_refunded: { label: 'Part refunded', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
  color: color.muted, background: '#FAFAF8', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '12px 16px', borderTop: `1px solid ${color.divider}`, fontSize: 15, verticalAlign: 'middle' }

type Ctx = { orgId: string; token: string; roles: string[]; currency: string; timeZone: string | null }

// One member's membership, for staff (spec 05 §5.2 "Staff tools"): status, dates, charges, and the
// studio's actions on it: cancel (now with an optional refund, or at the end of the period) and,
// for Admin, a price change for this member only. Every number and rule comes from the API.
export default function MemberMembershipPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [m, setM] = useState<StaffMembershipDetail | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [activityKey, setActivityKey] = useState(0)
  const [dialog, setDialog] = useState<'' | 'cancel' | 'price'>('')

  const api = useCallback((c: Ctx, path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${c.orgId}/member-memberships/${id}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` },
    }), [id])

  useEffect(() => {
    (async () => {
      const c = await getOrgContext()
      if (c.status === 'signed-out') { router.push('/login'); return }
      if (c.status === 'no-org') { router.push('/onboarding'); return }
      if (!canManageMemberMemberships(c.roles)) { setForbidden(true); return }
      const next: Ctx = { orgId: c.org.id, token: c.token, roles: c.roles, currency: (c.org.currency ?? 'AUD').toUpperCase(), timeZone: c.org.timezone ?? null }
      setCtx(next)
      try {
        const res = await api(next, '')
        if (!res.ok) { setError(res.status === 404 ? 'This membership doesn’t exist.' : 'Could not load this membership.'); return }
        setM(await res.json())
      } catch {
        setError('Could not reach the server. Please try again.')
      }
    })()
  }, [router, api])

  const updated = (next: StaffMembershipDetail, message: string) => {
    setM(next)
    setDialog('')
    setToast(message)
    setActivityKey(k => k + 1)
  }

  const s = m ? MEMBERSHIP_STATUS[m.status] : null
  const unit = m ? periodUnit(m.period_type, m.period_rolling_value) : null
  const live = m ? isLiveMembership(m.status) : false
  const renews = !!m && !m.is_comp && !!m.next_charge_on

  return (
    <div className={styles.shell}>
      <Sidebar active="memberships" roles={ctx?.roles} />
      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <Breadcrumb items={[
              { label: 'Memberships', href: '/dashboard/memberships?tab=members' },
              { label: m ? `${m.member_name} · ${m.name}` : 'Membership' },
            ]} />

            {error ? <div role="alert" style={alertStyle()}>{error}</div> : !m || !ctx ? <div style={{ color: color.muted }}>Loading…</div> : (
              <>
                <Card padded>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>{m.name}</h1>
                      <div style={{ fontSize: 15, color: color.ink2 }}>
                        <Link href={`/dashboard/members/${m.member_id}`} className={ui.focusable} style={{ color: color.primary, fontWeight: 600, textDecoration: 'none' }}>{m.member_name}</Link>
                        {' · '}{m.is_comp ? 'Free (given by the studio)' : `${formatMoney(m.price, m.currency)}${unit ? (unit.includes(' ') ? ` every ${unit}` : ` a ${unit}`) : ''}`}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        {s && <Chip tone={s.tone}>{s.label}</Chip>}
                        {m.cancel_at && live && <Chip tone="warn">Ends {dateOnlyLabel(m.cancel_at)}</Chip>}
                      </div>
                    </div>
                    {live && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {renews && canChangeMemberMembershipPrice(ctx.roles) && <Button onClick={() => setDialog('price')}>Change price</Button>}
                        <Button variant="destructive" onClick={() => setDialog('cancel')}>Cancel membership</Button>
                      </div>
                    )}
                  </div>

                  {m.past_due && (
                    <div role="status" style={{ ...alertStyle('danger'), marginTop: 18 }}>
                      Renewal of {formatMoney(m.past_due.amount, m.currency)} failed on {dateOnlyLabel(m.past_due.since)}
                      {m.past_due.attempts > 1 ? ` (${m.past_due.attempts} attempts)` : ''}.
                      {m.past_due.next_retry_on ? ` Next try ${dateOnlyLabel(m.past_due.next_retry_on)}.` : ' No more automatic retries.'}
                      {m.past_due.grace_until && (m.past_due.can_book ? ` They can book until ${dateOnlyLabel(m.past_due.grace_until)}.` : ' Booking is paused until it’s paid.')}
                      {' '}The member has been emailed a link to pay.
                    </div>
                  )}

                  <dl style={{ margin: '20px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px 20px' }}>
                    {([
                      ['Started', dateOnlyLabel(m.started_on)],
                      ['This period', m.current_period_start && m.current_period_end ? `${dateOnlyLabel(m.current_period_start)} – ${dateOnlyLabel(m.current_period_end)}` : null],
                      ['Sessions', m.session_cap == null ? 'Unlimited' : `${m.sessions_used_this_period} of ${m.session_cap} used${unit ? ` this ${unit.includes(' ') ? 'period' : unit}` : ''}`],
                      ['Next payment', renews && m.status !== 'past_due' ? `${dateOnlyLabel(m.next_charge_on!)}${m.card ? ` · ${m.card.brand} ••${m.card.last4}` : ''}` : null],
                      ['Price change', m.scheduled_price ? `${formatMoney(m.scheduled_price.price, m.currency)} from ${dateOnlyLabel(m.scheduled_price.from)}` : null],
                      ['Periods', m.max_cycles ? `${m.cycles_completed} of ${m.max_cycles}` : null],
                      ['Cancelled', m.cancelled_at ? `${dateOnlyLabel(m.cancelled_at)}${m.cancellation_reason ? ` · ${cancelReasonLabel(m.cancellation_reason)}` : ''}` : null],
                      ['Notes', m.notes],
                    ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                      <div key={label}>
                        <dt style={{ ...smallCapsStyle, marginBottom: 4 }}>{label}</dt>
                        <dd style={{ margin: 0, fontSize: 15, ...tabularNums }}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>

                <Card style={{ overflow: 'hidden' }} aria-labelledby="payments-heading">
                  <h2 id="payments-heading" style={{ margin: 0, padding: '18px 20px 12px', fontSize: 18, fontWeight: 600 }}>Payments</h2>
                  {m.payments.length === 0 ? (
                    <p style={{ margin: 0, padding: '4px 20px 18px', fontSize: 15, color: color.muted }}>{m.is_comp ? 'None. This membership was given free.' : 'No payments yet.'}</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>Date</th><th style={th}>For period from</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Status</th></tr></thead>
                        <tbody>
                          {m.payments.map(p => {
                            const c = paymentChip[p.status] ?? { label: p.status, tone: 'neutral' as const }
                            return (
                              <tr key={p.id}>
                                <td style={{ ...td, whiteSpace: 'nowrap', ...tabularNums }}>
                                  <Link href={`/dashboard/orders/${p.id}`} className={ui.focusable} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{dateOnlyLabel(p.created_at)}</Link>
                                </td>
                                <td style={{ ...td, color: color.ink2, ...tabularNums }}>{p.period_start ? dateOnlyLabel(p.period_start) : '—'}</td>
                                <td style={{ ...td, textAlign: 'right', ...tabularNums }}>
                                  {formatMoney(p.amount, p.currency)}
                                  {p.refunded_amount > 0 && <div style={{ fontSize: 13, color: color.muted }}>{formatMoney(p.refunded_amount, p.currency)} refunded</div>}
                                </td>
                                <td style={td}><Chip tone={c.tone}>{c.label}</Chip></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {canViewEntityActivity(ctx.roles) && (
                  <ActivityFeed orgId={ctx.orgId} token={ctx.token} entityType="member_membership" entityId={m.id}
                    noun="membership" currency={m.currency} timeZone={ctx.timeZone} refreshKey={activityKey}
                    description="Payments, renewals, cancellations and price changes on this membership." />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {dialog === 'cancel' && m && ctx && (
        <CancelDialog m={m} onClose={() => setDialog('')}
          getQuote={() => api(ctx, '/refund-quote')}
          submit={body => api(ctx, '/cancel', { method: 'POST', body: JSON.stringify(body) })}
          onDone={(next, msg) => updated(next, msg)} />
      )}
      {dialog === 'price' && m && ctx && (
        <PriceDialog m={m} onClose={() => setDialog('')}
          submit={body => api(ctx, '/price', { method: 'POST', body: JSON.stringify(body) })}
          onDone={(next, msg) => updated(next, msg)} />
      )}

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}

function cancelReasonLabel(r: string) {
  const k = r.toLowerCase()
  if (k === 'member' || k === 'member_request') return 'by the member'
  if (k === 'studio' || k === 'studio_cancel') return 'by the studio'
  if (k === 'payment_failed') return 'payment failed'
  return r.replace(/_/g, ' ')
}

async function errorText(res: Response, fallback: string) {
  const data = await res.json().catch(() => null)
  return data?.error ?? fallback
}

function CancelDialog({ m, onClose, getQuote, submit, onDone }: {
  m: StaffMembershipDetail
  onClose: () => void
  getQuote: () => Promise<Response>
  submit: (body: object) => Promise<Response>
  onDone: (next: StaffMembershipDetail, message: string) => void
}) {
  // End of period is only offered while it's running normally (the API refuses it for pending / past due).
  const canWait = (m.status === 'active' || m.status === 'capped') && !m.cancel_at
  const [when, setWhen] = useState<'now' | 'period_end'>('now')
  const [quote, setQuote] = useState<MembershipRefundQuote | null>(null)
  const [refund, setRefund] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getQuote().then(async res => {
      if (!res.ok) return
      const q: MembershipRefundQuote = await res.json()
      setQuote(q)
      setRefund(q.suggested_refund > 0 ? q.suggested_refund.toFixed(2) : '')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const amount = refund.trim() ? Number(refund) : 0
  const badAmount = when === 'now' && (isNaN(amount) || amount < 0 || (quote != null && amount > quote.refundable))

  const go = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await submit({ when, refund_amount: when === 'now' && amount > 0 ? amount : null, reason: reason.trim() || null })
      if (!res.ok) { setError(await errorText(res, 'Could not cancel this membership.')); return }
      onDone(await res.json(), when === 'now'
        ? `Membership cancelled${amount > 0 ? ` and ${formatMoney(amount, m.currency)} refunded` : ''}.`
        : 'Membership will end at the end of this period.')
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Cancel ${m.member_name}’s membership`} onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
        {error && <div role="alert" style={alertStyle()}>{error}</div>}

        {canWait && (
          <ChoiceGroup label="When" value={when} onChange={setWhen} options={[
            { value: 'now', label: 'End it today' },
            { value: 'period_end', label: `At the end of this period${m.current_period_end ? ` (${dateOnlyLabel(m.current_period_end)})` : ''}` },
          ]} />
        )}

        {when === 'now' ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
              Access ends today and no more payments are taken{m.status === 'past_due' ? ', including the overdue one' : ''}.
            </p>
            {m.is_comp ? null : quote == null ? (
              <div style={{ fontSize: 14, color: color.muted }}>Working out the refund…</div>
            ) : quote.refundable <= 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: color.muted }}>Nothing left to refund on the current period.</p>
            ) : (
              <Field label="Refund (optional)" htmlFor="cancel-refund"
                hint={<>
                  Paid {formatMoney(quote.amount_paid, m.currency)} for {quote.period_start && quote.period_end ? `${dateOnlyLabel(quote.period_start)} – ${dateOnlyLabel(quote.period_end)}` : 'this period'}
                  {quote.period_days > 0 && <>; {quote.unused_days} of {quote.period_days} days unused, so we suggest {formatMoney(quote.suggested_refund, m.currency)}</>}.
                  {' '}Up to {formatMoney(quote.refundable, m.currency)}. Leave blank for no refund.
                </>}>
                <input id="cancel-refund" type="number" inputMode="decimal" min="0" step="0.01" max={quote.refundable}
                  value={refund} onChange={e => setRefund(e.target.value)} aria-describedby="cancel-refund-hint" style={controlStyle} />
              </Field>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
            They keep access until {m.current_period_end ? dateOnlyLabel(m.current_period_end) : 'the end of this period'} and won’t be charged again. No refund.
          </p>
        )}

        <Field label="Note (optional)" htmlFor="cancel-reason" hint="Kept in the membership’s history. Not shown to the member.">
          <input id="cancel-reason" type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Moving away" style={controlStyle} />
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button onClick={onClose} style={{ flex: 1 }}>Keep it</Button>
          <Button variant="primary" onClick={go} disabled={busy || badAmount} style={{ flex: 1 }}>
            {busy ? 'Cancelling…' : when === 'now' && amount > 0 ? `Cancel and refund ${formatMoney(amount, m.currency)}` : 'Cancel membership'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function PriceDialog({ m, onClose, submit, onDone }: {
  m: StaffMembershipDetail
  onClose: () => void
  submit: (body: object) => Promise<Response>
  onDone: (next: StaffMembershipDetail, message: string) => void
}) {
  const [price, setPrice] = useState(m.price.toFixed(2))
  const [from, setFrom] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const value = Number(price)
  const bad = !price.trim() || isNaN(value) || value < 0

  const go = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await submit({ price: value, effective_from: from || null, notify_member: notify })
      if (!res.ok) { setError(await errorText(res, 'Could not change the price.')); return }
      const next: StaffMembershipDetail = await res.json()
      onDone(next, next.scheduled_price
        ? `New price ${formatMoney(next.scheduled_price.price, m.currency)} from ${dateOnlyLabel(next.scheduled_price.from)}.`
        : 'Price changed.')
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Change ${m.member_name}’s price`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
        {error && <div role="alert" style={alertStyle()}>{error}</div>}
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
          For this member only. They pay {formatMoney(m.price, m.currency)} now; the plan’s price for everyone else doesn’t change.
        </p>
        <Field label={`New price (${m.currency})`} htmlFor="price-new">
          <input id="price-new" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} style={controlStyle} />
        </Field>
        <Field label="From (optional)" htmlFor="price-from" hint={`Leave blank to start from their next payment${m.next_charge_on ? ` (${dateOnlyLabel(m.next_charge_on)})` : ''}.`}>
          <input id="price-from" type="date" min={localDateKey()} value={from} onChange={e => setFrom(e.target.value)} aria-describedby="price-from-hint" style={controlStyle} />
        </Field>
        <CheckRow checked={notify} onChange={setNotify}>Email the member about the new price</CheckRow>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="primary" onClick={go} disabled={busy || bad} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Change price'}</Button>
        </div>
      </div>
    </Modal>
  )
}
