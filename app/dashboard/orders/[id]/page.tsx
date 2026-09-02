'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers } from '@/lib/roles'
import { formatDate, formatDateTime } from '@/lib/dates'
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
  receipt_reference: string
  pass: PassOrderDetail | null
}

const orderTypeLabels: Record<string, string> = {
  booking: 'Session', pass_purchase: 'Pass', membership_purchase: 'Membership',
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    succeeded: { bg: '#e8f5ee', color: '#085041', label: 'Paid' },
    pending: { bg: '#fff3cd', color: '#7a4f00', label: 'Pending' },
    failed: { bg: '#fdecea', color: '#8b1a1a', label: 'Failed' },
    refunded: { bg: '#f4f4f4', color: '#666', label: 'Refunded' },
    partially_refunded: { bg: '#f4f4f4', color: '#666', label: 'Partly refunded' },
  }
  const s = map[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{title}</h2>
      {children}
    </div>
  )
}

const divider = <div style={{ borderTop: '1px solid #eee', margin: '24px 0' }} />

const th: React.CSSProperties = { textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 0 8px' }
const td: React.CSSProperties = { fontSize: '13px', color: '#444', padding: '10px 0', borderTop: '1px solid #f4f4f4' }
const rowLabel: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }
const rowValue: React.CSSProperties = { fontSize: '13px', color: '#444', textAlign: 'right' }

function fmtMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

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
  const [showPaymentDetail, setShowPaymentDetail] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const t = session.access_token
      setToken(t)

      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()
      setOrgId(org.id)

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const myRoles: string[] = roleRes.ok ? (await roleRes.json()).roles : []
      setRoles(myRoles)
      if (!canViewMembers(myRoles)) { setForbidden(true); setLoading(false); return }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/payments/${orderId}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.status === 404) { setNotFound(true); setLoading(false); return }
      if (res.ok) setOrder(await res.json())
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, orderId])

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
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const receiptDownloadable = order != null && order.status !== 'pending' && order.status !== 'failed'
  const hasTax = order != null && order.tax_amount > 0
  const pass = order?.pass ?? null

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />
      <div className={styles.main} style={{ maxWidth: '720px' }}>
        {forbidden ? <Forbidden /> : notFound || !order ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', fontSize: '20px', lineHeight: 1, cursor: 'pointer' }}>←</button>
              <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Order details</h1>
            </div>
            <p style={{ color: '#666', fontSize: '14px' }}>This order could not be found.</p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', fontSize: '20px', lineHeight: 1, cursor: 'pointer' }}>←</button>
              <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Order details</h1>
            </div>

            <Card>
              {/* Summary */}
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{order.product_name}</div>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
                {orderTypeLabels[order.type] ?? order.type} for{' '}
                <a href={`/dashboard/members/${order.member_id}`} style={{ color: '#085041', fontWeight: 500 }}>
                  {order.member_name}
                </a>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '10px' }}>{fmtMoney(order.amount, order.currency)}</div>
              {pass?.credits_remaining != null && (
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                  {pass.credits_remaining} {pass.credits_remaining === 1 ? 'class' : 'classes'} remaining
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e2e2e2', flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: '#444' }}>
                  <div style={{ color: '#999', fontSize: '12px' }}>Added by</div>
                  {pass && !pass.added_by_admin
                    ? <a href={`/dashboard/members/${order.member_id}`} style={{ color: '#085041', fontWeight: 500 }}>{pass.added_by_name}</a>
                    : <span style={{ fontWeight: 500 }}>{pass?.added_by_name ?? order.member_name}</span>}
                </div>
              </div>

              {pass && (
                <>
                  {divider}
                  <Section title="Validity">
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={rowLabel}>Start date</span><span style={rowValue}>{formatDate(pass.effective_from)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={rowLabel}>End date</span><span style={rowValue}>{formatDate(pass.expires_at)}</span>
                    </div>
                  </Section>
                </>
              )}

              {divider}
              <Section title="Receipt">
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={rowLabel}>Receipt date</span><span style={rowValue}>{formatDate(order.created_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={rowLabel}>Reference</span><span style={{ ...rowValue, fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>{order.receipt_reference}</span>
                </div>
                {receiptDownloadable && (
                  <button
                    onClick={downloadReceipt}
                    disabled={downloading}
                    style={{
                      marginTop: '12px', padding: '8px 16px', backgroundColor: 'white',
                      border: '1px solid #d2d2d2', borderRadius: '8px', fontSize: '13px',
                      fontWeight: 600, color: '#1a1a1a', cursor: downloading ? 'default' : 'pointer',
                    }}
                  >
                    {downloading ? 'Preparing…' : 'Download receipt (PDF)'}
                  </button>
                )}
                {downloadError && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#8b1a1a' }}>{downloadError}</div>
                )}
              </Section>
            </Card>

            {/* Order payment */}
            <Card>
              <Section title="Order payment">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '90px' }}>Amount</th>
                      <th style={th}>Method</th>
                      <th style={{ ...th, width: '110px' }}>Status</th>
                      <th style={{ ...th, width: '110px' }}>Date</th>
                      <th style={{ ...th, width: '28px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    <tr onClick={() => setShowPaymentDetail(v => !v)} style={{ cursor: 'pointer' }}>
                      <td style={td}>{fmtMoney(order.amount, order.currency)}</td>
                      <td style={td}>
                        {order.method}
                        {order.card_brand && (
                          <span style={{ color: '#999' }}>
                            {' '}· {order.card_brand.charAt(0).toUpperCase() + order.card_brand.slice(1)}
                            {order.card_last4 ? ` ···· ${order.card_last4}` : ''}
                          </span>
                        )}
                      </td>
                      <td style={td}><StatusBadge status={order.status} /></td>
                      <td style={td}>{formatDate(order.created_at)}</td>
                      <td style={{ ...td, color: '#999', textAlign: 'right' }}>{showPaymentDetail ? '▾' : '▸'}</td>
                    </tr>
                    {showPaymentDetail && (
                      <tr>
                        <td colSpan={5} style={{ borderTop: 'none', padding: '4px 0 10px' }}>
                          <div style={{ backgroundColor: '#fafafa', borderRadius: '8px', padding: '14px 16px' }}>
                            <Row label="Subtotal" value={fmtMoney(order.subtotal, order.currency)} />
                            {hasTax && (
                              <Row
                                label={`${order.tax_name ?? 'Tax'} (${order.tax_rate}%)`}
                                value={fmtMoney(order.tax_amount, order.currency)}
                              />
                            )}
                            <Row label="Total" value={fmtMoney(order.amount, order.currency)} strong />
                            {order.fee != null && (
                              <>
                                <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
                                <Row label="Stripe processing fee" value={`− ${fmtMoney(order.fee, order.currency)}`} muted />
                                {order.net_amount != null && (
                                  <Row label="Net to studio" value={fmtMoney(order.net_amount, order.currency)} />
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Section>
            </Card>

            {/* Bookings against the pass */}
            {pass && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Booked with this pass</h2>
                  {pass.credits_total != null && pass.credits_remaining != null && (
                    <span style={{ fontSize: '13px', color: '#666' }}>
                      {pass.credits_remaining}/{pass.credits_total} classes remaining
                    </span>
                  )}
                </div>
                {pass.bookings.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#666' }}>No classes booked with this pass yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: '150px' }}>Date</th>
                        <th style={th}>Class</th>
                        <th style={{ ...th, width: '110px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pass.bookings.map((b, i) => (
                        <tr key={`${b.session_occurrence_id}-${i}`}>
                          <td style={td}>{formatDateTime(b.date)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>
                            <a href={`/dashboard/occurrences/${b.session_occurrence_id}`} style={{ color: '#085041' }}>
                              {b.session_name}
                            </a>
                          </td>
                          <td style={td}>{bookingStatusLabel(b.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
      <span style={{ color: muted ? '#999' : '#666', fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ color: muted ? '#999' : '#1a1a1a', fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  )
}
