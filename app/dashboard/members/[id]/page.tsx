'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers, canManageMemberPasses } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from '@/lib/dates'
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
  payment_type: string | null
  session_occurrence: {
    starts_at: string
    session: { name: string } | null
  } | null
  member_pass: { pass_template: { name: string } | null } | null
}

interface LedgerEntry {
  id: string
  movement_type: string
  credits_delta: number
  credits_after: number
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
  booking: 'Session',
  pass_purchase: 'Pass',
  membership_purchase: 'Membership',
}

const genderLabels: Record<string, string> = {
  male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say',
}
const personTypeLabels: Record<string, string> = {
  adult: 'Adult', child: 'Child', senior: 'Senior', student: 'Student',
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#e8f5ee', color: '#085041', label: 'Active' },
    low: { bg: '#fff3cd', color: '#7a4f00', label: 'Low' },
    frozen: { bg: '#e8eef8', color: '#1B4F8A', label: 'Frozen' },
    expired: { bg: '#f4f4f4', color: '#666', label: 'Expired' },
    exhausted: { bg: '#fdecea', color: '#8b1a1a', label: 'Exhausted' },
    succeeded: { bg: '#e8f5ee', color: '#085041', label: 'Paid' },
    pending: { bg: '#fff3cd', color: '#7a4f00', label: 'Pending' },
    failed: { bg: '#fdecea', color: '#8b1a1a', label: 'Failed' },
    refunded: { bg: '#f4f4f4', color: '#666', label: 'Refunded' },
    partially_refunded: { bg: '#f4f4f4', color: '#666', label: 'Part. refunded' },
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

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e2e2', borderRadius: '8px',
  fontSize: '14px', outline: 'none', backgroundColor: 'white',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }
const th: React.CSSProperties = { textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 0 8px' }
const td: React.CSSProperties = { fontSize: '13px', color: '#444', padding: '9px 0', borderTop: '1px solid #f4f4f4' }

function fmtMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

export default function MemberDetailPage() {
  const router = useRouter()
  const memberId = useParams().id as string

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [passes, setPasses] = useState<MemberPass[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingBooking[]>([])

  const [showMoreInfo, setShowMoreInfo] = useState(false)
  const [expandedPassId, setExpandedPassId] = useState<string | null>(null)
  const [passLedgers, setPassLedgers] = useState<Record<string, LedgerEntry[]>>({})

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
  }, [authedFetch, memberId])

  const togglePassHistory = useCallback(async (passId: string) => {
    if (expandedPassId === passId) { setExpandedPassId(null); return }
    setExpandedPassId(passId)
    if (!passLedgers[passId]) {
      const res = await authedFetch(`/member-passes/${passId}/ledger`)
      if (res.ok) {
        const rows: LedgerEntry[] = await res.json()
        setPassLedgers(prev => ({ ...prev, [passId]: rows }))
      }
    }
  }, [authedFetch, expandedPassId, passLedgers])

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
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const activePasses = passes.filter(p => p.status === 'active' || p.status === 'low' || p.status === 'frozen')
  const pricingOptionFor = (b: UpcomingBooking) =>
    b.member_pass?.pass_template?.name
    ?? (b.payment_type === 'card' ? 'Drop-in' : b.payment_type === 'free' || b.payment_type === 'admin_waived' ? 'Free' : '—')

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />
      <div className={styles.main} style={{ maxWidth: '760px' }}>
        {forbidden ? <Forbidden /> : <>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <a href="/dashboard/members" style={{ color: '#666', textDecoration: 'none', fontSize: '20px', lineHeight: 1 }}>←</a>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>{(member && displayName(member)) || 'Member'}</h1>
        </div>

        {/* Profile */}
        <Card title="Profile">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {member?.avatar_url ? (
              <img src={member.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#e2e2e2', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{member && displayName(member)}</div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                {member?.email}{member?.phone ? ` · ${member.phone}` : ''}
              </div>
              <button
                onClick={() => setShowMoreInfo(v => !v)}
                style={{ background: 'none', border: 'none', padding: 0, marginTop: '4px', color: '#085041', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {showMoreInfo ? 'Hide info' : 'Show more info'}
              </button>
            </div>
          </div>

          {showMoreInfo && member && (
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: '8px', columnGap: '12px', fontSize: '13px' }}>
              <div style={{ color: '#999' }}>Person type</div><div>{member.person_type ? personTypeLabels[member.person_type] ?? member.person_type : '—'}</div>
              <div style={{ color: '#999' }}>Gender</div><div>{member.gender ? genderLabels[member.gender] ?? member.gender : '—'}</div>
              <div style={{ color: '#999' }}>Date of birth</div><div>{member.date_of_birth ? fmtDate(member.date_of_birth) : '—'}</div>
              <div style={{ color: '#999' }}>Address</div><div>{member.address || '—'}</div>
              <div style={{ color: '#999' }}>Emergency contact</div><div>{member.emergency_contact_name ? `${member.emergency_contact_name}${member.emergency_contact_phone ? ` · ${member.emergency_contact_phone}` : ''}` : '—'}</div>
              <div style={{ color: '#999' }}>Roles</div><div>{member.roles.join(', ') || '—'}</div>
              <div style={{ color: '#999' }}>Joined</div><div>{fmtDate(member.join_date)} · {member.join_source.replace(/_/g, ' ')}</div>
              <div style={{ color: '#999' }}>Sessions attended</div><div>{member.total_sessions_attended}</div>
              <div style={{ color: '#999' }}>Health notes</div><div style={{ whiteSpace: 'pre-wrap' }}>{member.health_notes || '—'}</div>
              <div style={{ color: '#999' }}>Notes</div><div style={{ whiteSpace: 'pre-wrap' }}>{member.notes || '—'}</div>
            </div>
          )}
        </Card>

        {/* Active passes */}
        <Card
          title="Active memberships and class passes"
          action={canManageMemberPasses(roles) && (
            <button onClick={openIssue} style={{
              padding: '7px 14px', backgroundColor: '#085041', color: 'white', border: 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>
              Add pricing option
            </button>
          )}
        >
          {activePasses.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>No active passes.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={{ ...th, textAlign: 'center', width: '90px' }}>Credits left</th>
                  <th style={{ ...th, textAlign: 'center', width: '120px' }}>Expires</th>
                  <th style={{ ...th, width: '80px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {activePasses.map(p => {
                  const isCredit = p.credits_total !== null
                  const open = expandedPassId === p.id
                  const entries = passLedgers[p.id]
                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        onClick={isCredit ? () => togglePassHistory(p.id) : undefined}
                        style={{ cursor: isCredit ? 'pointer' : 'default' }}
                      >
                        <td style={{ ...td, fontWeight: 600, color: isCredit ? '#085041' : '#444' }}>
                          {isCredit && <span style={{ color: '#999', marginRight: '6px' }}>{open ? '▾' : '▸'}</span>}
                          {p.pass_template?.name ?? 'Pass'}
                          {p.notes ? <span style={{ fontWeight: 400, color: '#999' }}> · {p.notes}</span> : null}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>{p.credits_total === null ? '∞' : p.credits_remaining}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{fmtDate(p.expires_at)}</td>
                        <td style={td}><Badge status={p.status} /></td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={4} style={{ padding: '2px 0 12px 18px', borderTop: 'none' }}>
                            {!entries ? (
                              <p style={{ fontSize: '12px', color: '#999' }}>Loading history…</p>
                            ) : entries.length === 0 ? (
                              <p style={{ fontSize: '12px', color: '#999' }}>No credit movements.</p>
                            ) : (
                              entries.map((e, j) => (
                                <div key={e.id} style={{
                                  display: 'grid', gridTemplateColumns: '150px 1fr 55px 55px', gap: '8px', alignItems: 'center',
                                  padding: '5px 0', fontSize: '12px',
                                  borderBottom: j < entries.length - 1 ? '1px solid #f7f7f7' : 'none',
                                }}>
                                  <div style={{ color: '#444' }}>{fmtDateTime(e.created_at)}</div>
                                  <div style={{ color: '#666' }}>{movementLabels[e.movement_type] ?? e.movement_type}{e.notes ? ` — ${e.notes}` : ''}</div>
                                  <div style={{ textAlign: 'right', fontWeight: 600, color: e.credits_delta < 0 ? '#8b1a1a' : '#085041' }}>
                                    {e.credits_delta > 0 ? '+' : ''}{e.credits_delta}
                                  </div>
                                  <div style={{ textAlign: 'right', color: '#999' }}>{e.credits_after}</div>
                                </div>
                              ))
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* Recent orders */}
        <Card
          title="Recent orders"
          action={orders.length > 0 && (
            <a href={`/dashboard/members/${memberId}/orders`} style={{ fontSize: '13px', fontWeight: 500, color: '#085041' }}>
              All orders
            </a>
          )}
        >
          {orders.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>No orders.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '110px' }}>Date</th>
                  <th style={th}>Name</th>
                  <th style={{ ...th, width: '90px' }}>Type</th>
                  <th style={{ ...th, textAlign: 'right', width: '90px' }}>Amount</th>
                  <th style={{ ...th, width: '90px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 15).map(o => (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={td}>{fmtDate(o.created_at)}</td>
                    <td style={{ ...td, fontWeight: 600, color: '#085041' }}>{o.product_name}</td>
                    <td style={td}>{orderTypeLabels[o.type] ?? o.type}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(o.amount, o.currency)}</td>
                    <td style={td}><Badge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Upcoming bookings */}
        <Card title="Upcoming bookings">
          {upcoming.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>No upcoming bookings.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '150px' }}>Date</th>
                  <th style={th}>Title</th>
                  <th style={{ ...th, width: '160px' }}>Pricing option</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(b => (
                  <tr key={b.id}>
                    <td style={td}>{b.session_occurrence ? fmtDateTime(b.session_occurrence.starts_at) : '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{b.session_occurrence?.session?.name ?? 'Session'}</td>
                    <td style={td}>{pricingOptionFor(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        </>}
      </div>

      {showIssue && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
            maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Add a pass for {(member && displayName(member)) || 'this member'}</h2>
              <button onClick={() => setShowIssue(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>

            {issueError && (
              <div style={{ padding: '10px 12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>
                {issueError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Pass</label>
                <select
                  value={issueForm.passTemplateId}
                  onChange={e => setIssueForm(f => ({ ...f, passTemplateId: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Select a pass template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.pass_type === 'credit' ? `${t.credit_count} credits` : 'unlimited'}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>No active pass templates — create one on the Passes page.</p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Effective from</label>
                <input
                  type="date"
                  value={issueForm.effectiveFrom}
                  onChange={e => setIssueForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                  style={inputStyle}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>Leave blank for today. Expiry is set from the pass template.</p>
              </div>

              <div>
                <label style={labelStyle}>Payment</label>
                <select
                  value={issueForm.paymentMethod}
                  onChange={e => setIssueForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  style={inputStyle}
                >
                  {paymentMethodOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {issueForm.paymentMethod && (() => {
                  const t = templates.find(x => x.id === issueForm.passTemplateId)
                  return (
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                      {t
                        ? `Records a ${fmtMoney(t.price, t.currency)} payment in this member's order history.`
                        : 'Records a payment for the pass price in this member’s order history.'}
                    </p>
                  )
                })()}
              </div>

              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. comp for referral, family member"
                  value={issueForm.notes}
                  onChange={e => setIssueForm(f => ({ ...f, notes: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <button
                onClick={handleIssue}
                disabled={issuing || !issueForm.passTemplateId}
                style={{
                  padding: '11px', backgroundColor: issuing || !issueForm.passTemplateId ? '#9fd6b8' : '#085041',
                  color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  cursor: issuing || !issueForm.passTemplateId ? 'default' : 'pointer', marginTop: '4px',
                }}
              >
                {issuing ? 'Adding…' : 'Add pass'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
