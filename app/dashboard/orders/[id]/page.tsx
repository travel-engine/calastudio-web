'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers, canManageBookings } from '@/lib/roles'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { formatClock, formatShortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Button, Card, Chip, EmptyState, Field, Modal, PageHeader, alertStyle, controlStyle, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

interface PassBookingRow {
  date: string
  session_occurrence_id: string
  session_name: string
  status: string
}

interface PassOrderDetail {
  member_pass_id: string
  effective_from: string
  expires_at: string
  credits_total: number | null
  credits_remaining: number | null
  added_by_name: string
  added_by_admin: boolean
  bookings: PassBookingRow[]
}

interface OrderDetail {
  id: string
  created_at: string
  product_name: string
  type: 'booking' | 'pass_purchase' | 'membership_purchase'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'
  amount: number
  subtotal: number
  tax_rate: number
  tax_amount: number
  tax_name: string | null
  currency: string
  member_id: string
  member_name: string
  method: string
  card_brand: string | null
  card_last4: string | null
  fee: number | null
  net_amount: number | null
  // Not present on the live API response as of this writing (checked against a real booking
  // order) — kept optional so a future addition is picked up without a type change, and every use
  // below tolerates it being absent.
  refunded_amount?: number | null
  receipt_reference: string
  pass: PassOrderDetail | null
}

// GET /payments/{id} has no booking-side equivalent of `pass.member_pass_id` — a `type: "booking"`
// order doesn't carry the booking's own id. Bookings do carry `payment_id` back to their order
// (see dashboard/bookings/page.tsx's Booking type), so refunding a session order means fetching the
// member's bookings and matching on that, then calling the same /bookings/{id}/refund the roster
// uses. Confirmed against a live order — see git history for the request that traced this.
interface MemberBookingRef {
  id: string
  payment_id?: string | null
}

const orderTypeLabels: Record<string, string> = {
  booking: 'Class', pass_purchase: 'Pass', membership_purchase: 'Membership',
}

// pass.bookings[].status comes through as the raw C# enum name (PascalCase), unlike the
// snake_case enums elsewhere — normalise both forms. no-show carries no label (see
// bookingStatusLabel): an un-attended booking simply isn't marked attended.
const bookingStatusLabels: Record<string, string> = {
  confirmed: 'Confirmed', attended: 'Attended', cancelled: 'Cancelled',
  latecancel: 'Late cancel', late_cancel: 'Late cancel', waitlisted: 'Waitlisted',
}
function bookingStatusLabel(s: string) {
  const key = s.toLowerCase()
  if (key === 'noshow' || key === 'no_show') return ''
  return bookingStatusLabels[key] ?? s
}

const orderStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  succeeded: { label: 'Paid', tone: 'primary' },
  pending: { label: 'Awaiting payment', tone: 'warn' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  partially_refunded: { label: 'Part refunded', tone: 'neutral' },
}

const th: React.CSSProperties = { ...smallCapsStyle, textAlign: 'left', padding: '10px 20px', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap' }

export default function OrderDetailPage() {
  const router = useRouter()
  const orderId = useParams().id as string

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  // Resolved for `type: "booking"` orders only — see the MemberBookingRef comment above.
  const [bookingRefundId, setBookingRefundId] = useState<string | null>(null)

  // Issue-refund modal — covers both a session booking (money via Stripe, POST /bookings/{id}/refund)
  // and a pass purchase (POST /member-passes/{id}/refund). Separate from the credit-only "Refund
  // credit" action that lives on the bookings roster. Mirrors that roster's modal: prefilled,
  // editable amount + a required reason, admin reviews before confirming.
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundKind, setRefundKind] = useState<'booking' | 'pass' | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundQuoteLoading, setRefundQuoteLoading] = useState(false)
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundError, setRefundError] = useState('')

  const fetchOrder = useCallback(async (oId: string, t: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${oId}/payments/${orderId}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.status === 404) { setNotFound(true); return }
    if (!res.ok) return
    const data: OrderDetail = await res.json()
    setOrder(data)

    if (data.type === 'booking' && data.member_id) {
      const bRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${oId}/members/${data.member_id}/bookings`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (bRes.ok) {
        const bookings: MemberBookingRef[] = await bRes.json()
        setBookingRefundId(bookings.find(b => b.payment_id === data.id)?.id ?? null)
      }
    } else {
      setBookingRefundId(null)
    }
  }, [orderId])

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
      if (!canViewMembers(myRoles)) { setForbidden(true); setLoading(false); return }

      await fetchOrder(org.id, t)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, orderId])

  // The refund target: a booking id for a session order, a member-pass id for a pass-purchase
  // order. Null while it can't be resolved (still loading, or no matching booking found).
  const refundTargetId = refundKind === 'booking' ? bookingRefundId : refundKind === 'pass' ? order?.pass?.member_pass_id ?? null : null

  // The pass refund-quote endpoint's response shape isn't documented anywhere we can check ahead
  // of time; read a number off whichever plausible field it uses, and fall back to the outstanding
  // balance if none matches. The amount is always shown to the admin and stays editable before
  // they confirm, so a missed field name just means a worse pre-fill, not a wrong charge. Booking
  // refunds have no quote endpoint — same prefill as the bookings roster's own modal.
  const openRefund = useCallback(async (kind: 'booking' | 'pass') => {
    if (!order) return
    setRefundKind(kind)
    setRefundOpen(true)
    setRefundReason('')
    setRefundError('')
    setRefundAmount(order.amount > 0 ? order.amount.toFixed(2) : '')

    if (kind !== 'pass' || !order.pass) return
    setRefundQuoteLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/member-passes/${order.pass.member_pass_id}/refund-quote`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (res.ok) {
        const data = await res.json().catch(() => null)
        const quoted = data && typeof data === 'object'
          ? [data.amount, data.refund_amount, data.refundable_amount, data.suggested_amount, data.max_amount]
              .find((v: unknown) => typeof v === 'number' && v > 0)
          : undefined
        if (typeof quoted === 'number') setRefundAmount(quoted.toFixed(2))
      }
    } catch {
      /* keep the outstanding-balance fallback */
    } finally {
      setRefundQuoteLoading(false)
    }
  }, [order, orgId, token])

  const handleIssueRefund = async () => {
    if (!refundKind || !refundTargetId) return
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) { setRefundError('Enter a refund amount greater than zero.'); return }
    if (!refundReason.trim()) { setRefundError('A reason is required.'); return }

    const path = refundKind === 'booking' ? `/bookings/${refundTargetId}/refund` : `/member-passes/${refundTargetId}/refund`
    setRefundBusy(true)
    setRefundError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, reason: refundReason }),
      })
      if (res.ok) {
        setRefundOpen(false)
        await fetchOrder(orgId, token)
      } else {
        const data = await res.json().catch(() => null)
        setRefundError(data?.error ?? 'Could not issue this refund.')
      }
    } catch {
      setRefundError('Could not reach the server. Please try again.')
    } finally {
      setRefundBusy(false)
    }
  }

  const downloadReceipt = useCallback(async () => {
    setDownloading(true)
    setDownloadError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/payments/${orderId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setDownloadError('Receipt is not available for this order.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Could not reach the server. Please try again.')
    } finally {
      setDownloading(false)
    }
  }, [orgId, orderId, token])

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

  const receiptDownloadable = order != null && order.status !== 'pending' && order.status !== 'failed'
  const hasTax = order != null && order.tax_amount > 0
  const pass = order?.pass ?? null
  const canRefund = order != null && (order.status === 'succeeded' || order.status === 'partially_refunded') && canManageBookings(roles)
    && (order.pass != null || (order.type === 'booking' && bookingRefundId != null))
  const st = order ? (orderStatusChip[order.status] ?? { label: order.status, tone: 'neutral' as ChipTone }) : null

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />
      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            {notFound || !order ? (
              <>
                <Breadcrumb items={[{ label: 'Members', href: '/dashboard/members' }, { label: 'Order' }]} />
                <PageHeader title="Order details" />
                <Card><EmptyState message="This order could not be found." /></Card>
              </>
            ) : (
              <>
                <Breadcrumb items={[
                  { label: 'Members', href: '/dashboard/members' },
                  { label: order.member_name, href: `/dashboard/members/${order.member_id}` },
                  { label: 'Orders', href: `/dashboard/members/${order.member_id}/orders` },
                  { label: order.product_name },
                ]} />
                <PageHeader
                  eyebrow={`${orderTypeLabels[order.type] ?? order.type} · ${formatShortDate(order.created_at, timeZone)}`}
                  title={order.product_name}
                  actions={<>
                    {receiptDownloadable && (
                      <Button onClick={downloadReceipt} disabled={downloading} icon={<Download size={18} strokeWidth={1.8} aria-hidden />}>
                        {downloading ? 'Preparing…' : 'Download receipt'}
                      </Button>
                    )}
                    {canRefund && <Button onClick={() => openRefund(order.pass ? 'pass' : 'booking')}>Issue refund</Button>}
                  </>}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {st && <Chip tone={st.tone}>{st.label}</Chip>}
                    <span style={{ fontSize: 15, color: color.ink2 }}>
                      for <Link href={`/dashboard/members/${order.member_id}`} className={ui.focusable} style={{ color: color.primary, fontWeight: 600, textDecoration: 'none' }}>{order.member_name}</Link>
                    </span>
                  </div>
                </PageHeader>
                {downloadError && <div role="alert" style={alertStyle()}>{downloadError}</div>}

                <div className={styles.orderCols} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: space.cardGap, alignItems: 'start' }}>
                  {/* Payment */}
                  <Card padded aria-labelledby="pay-heading">
                    <h2 id="pay-heading" style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 600 }}>Payment</h2>
                    <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.1, ...tabularNums }}>{formatMoney(order.amount, order.currency)}</div>
                    <div style={{ fontSize: 15, color: color.ink2, marginTop: 6 }}>
                      {order.method}
                      {order.card_brand && <span style={{ color: color.muted }}>{' · '}{order.card_brand.charAt(0).toUpperCase() + order.card_brand.slice(1)}{order.card_last4 ? ` ending ${order.card_last4}` : ''}</span>}
                    </div>
                    <dl style={{ margin: '18px 0 0', borderTop: `1px solid ${color.divider}`, paddingTop: 10 }}>
                      <Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
                      {hasTax && <Row label={`${order.tax_name ?? 'Tax'} (${order.tax_rate}%)`} value={formatMoney(order.tax_amount, order.currency)} />}
                      <Row label="Total" value={formatMoney(order.amount, order.currency)} strong />
                      {order.fee != null && <Row label="Stripe processing fee" value={`− ${formatMoney(order.fee, order.currency)}`} muted />}
                      {order.fee != null && order.net_amount != null && <Row label="Net to studio" value={formatMoney(order.net_amount, order.currency)} />}
                      {!!order.refunded_amount && <Row label="Refunded" value={`− ${formatMoney(order.refunded_amount, order.currency)}`} muted />}
                    </dl>
                  </Card>

                  {/* Details */}
                  <Card padded aria-labelledby="details-heading">
                    <h2 id="details-heading" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>Details</h2>
                    <dl style={{ margin: 0 }}>
                      <Row label="Added by" value={pass?.added_by_name ?? order.member_name} />
                      {pass && <Row label="Starts" value={formatShortDate(pass.effective_from, timeZone)} />}
                      {pass && <Row label="Expires" value={formatShortDate(pass.expires_at, timeZone)} />}
                      {pass?.credits_remaining != null && (
                        <Row label="Credits left" value={pass.credits_total != null ? `${pass.credits_remaining} of ${pass.credits_total}` : String(pass.credits_remaining)} />
                      )}
                      <Row label="Receipt date" value={formatShortDate(order.created_at, timeZone)} />
                      <Row label="Reference" value={order.receipt_reference} mono />
                    </dl>
                  </Card>
                </div>

                {/* Bookings against the pass */}
                {pass && (
                  <Card style={{ overflow: 'hidden' }} aria-labelledby="booked-heading">
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '18px 20px 12px' }}>
                      <h2 id="booked-heading" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Booked with this pass</h2>
                      {pass.credits_total != null && pass.credits_remaining != null && (
                        <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>{pass.credits_remaining} of {pass.credits_total} credits left</span>
                      )}
                    </div>
                    {pass.bookings.length === 0 ? (
                      <p style={{ margin: 0, padding: '0 20px 20px', fontSize: 15, color: color.muted }}>No classes booked with this pass yet.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 15 }}>
                          <thead>
                            <tr>
                              {['When', 'Class', 'Status'].map(h => <th key={h} scope="col" style={th}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {pass.bookings.map((b, i) => {
                              const td: React.CSSProperties = { padding: '12px 20px', borderBottom: i < pass.bookings.length - 1 ? `1px solid ${color.divider}` : 'none' }
                              const label = bookingStatusLabel(b.status)
                              return (
                                <tr key={`${b.session_occurrence_id}-${i}`}>
                                  <td style={{ ...td, whiteSpace: 'nowrap', color: color.ink2, ...tabularNums }}>{formatShortDate(b.date, timeZone)} · {formatClock(b.date, timeZone)}</td>
                                  <td style={td}>
                                    <Link href={`/dashboard/occurrences/${b.session_occurrence_id}`} className={ui.focusable} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{b.session_name}</Link>
                                  </td>
                                  <td style={td}>{label ? <Chip tone={/cancel/i.test(label) ? 'neutral' : label === 'Attended' ? 'primary' : 'info'}>{label}</Chip> : <span style={{ color: color.muted }}>—</span>}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}

                {refundOpen && refundKind && (
                  <Modal title="Issue refund" onClose={() => setRefundOpen(false)} width={440}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
                        {order.member_name} paid {formatMoney(order.amount, order.currency)} for {order.product_name}.
                        Partial refunds are allowed; the amount can&apos;t exceed what&apos;s left unrefunded.
                      </p>
                      <Field label={refundQuoteLoading ? 'Refund amount (fetching suggested amount…)' : 'Refund amount'} htmlFor="refund-amount">
                        <input id="refund-amount" type="number" min="0" step="0.01" value={refundAmount}
                          onChange={e => setRefundAmount(e.target.value)} disabled={refundQuoteLoading} style={{ ...controlStyle, ...tabularNums }} />
                      </Field>
                      <Field label="Reason" htmlFor="refund-reason">
                        <textarea id="refund-reason" value={refundReason} onChange={e => setRefundReason(e.target.value)}
                          placeholder="e.g. Studio closure, member requested cancellation"
                          style={{ ...controlStyle, minHeight: 80, padding: '10px 12px', resize: 'vertical' }} />
                      </Field>
                      {refundError && <div role="alert" style={alertStyle()}>{refundError}</div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
                        <Button onClick={() => setRefundOpen(false)} disabled={refundBusy}>Cancel</Button>
                        <Button variant="primary" onClick={handleIssueRefund} disabled={refundBusy || refundQuoteLoading}>{refundBusy ? 'Refunding…' : 'Issue refund'}</Button>
                      </div>
                    </div>
                  </Modal>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, strong, muted, mono }: { label: string; value: string; strong?: boolean; muted?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', fontSize: 15 }}>
      <dt style={{ color: muted ? color.muted : color.ink2, fontWeight: strong ? 600 : 400 }}>{label}</dt>
      <dd style={{
        margin: 0, textAlign: 'right', color: muted ? color.muted : color.ink, fontWeight: strong ? 600 : 500, minWidth: 0, wordBreak: 'break-all',
        ...(mono ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 } : tabularNums),
      }}>{value}</dd>
    </div>
  )
}
