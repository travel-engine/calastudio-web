'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers, canManageMemberPasses } from '@/lib/roles'
import styles from '@/app/dashboard/dashboard.module.css'

interface Member { id: string; full_name: string; email: string }

interface PassTemplate {
  id: string
  name: string
  pass_type: 'credit' | 'unlimited'
  credit_count: number | null
  price: number
  currency: string
  is_active: boolean
}

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

interface Booking {
  id: string
  status: string
  payment_type: string | null
  booked_at: string
  guest_count: number
  session_occurrence: {
    starts_at: string
    session: { name: string } | null
  } | null
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#e8f5ee', color: '#085041', label: 'Active' },
    low: { bg: '#fff3cd', color: '#7a4f00', label: 'Low' },
    frozen: { bg: '#e8eef8', color: '#1B4F8A', label: 'Frozen' },
    expired: { bg: '#f4f4f4', color: '#666', label: 'Expired' },
    exhausted: { bg: '#fdecea', color: '#8b1a1a', label: 'Exhausted' },
    confirmed: { bg: '#e8f5ee', color: '#085041', label: 'Confirmed' },
    attended: { bg: '#e8f5ee', color: '#085041', label: 'Attended' },
    no_show: { bg: '#fff3cd', color: '#7a4f00', label: 'No-show' },
    cancelled: { bg: '#fdecea', color: '#8b1a1a', label: 'Cancelled' },
    late_cancel: { bg: '#fdecea', color: '#8b1a1a', label: 'Late cancel' },
    waitlisted: { bg: '#fff3cd', color: '#7a4f00', label: 'Waitlisted' },
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MemberDetailPage() {
  const router = useRouter()
  const memberId = useParams().id as string

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])

  const [member, setMember] = useState<Member | null>(null)
  const [passes, setPasses] = useState<MemberPass[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  // Credit history is per-pass — fetched lazily when a pass row is expanded.
  const [expandedPassId, setExpandedPassId] = useState<string | null>(null)
  const [passLedgers, setPassLedgers] = useState<Record<string, LedgerEntry[]>>({})

  const [showIssue, setShowIssue] = useState(false)
  const [templates, setTemplates] = useState<PassTemplate[]>([])
  const [issueForm, setIssueForm] = useState({ passTemplateId: '', effectiveFrom: '', notes: '' })
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState('')
  const [issued, setIssued] = useState(false)

  const authedFetch = useCallback((path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    }), [orgId, token])

  const reloadPasses = useCallback(async () => {
    const p = await authedFetch(`/members/${memberId}/passes`)
    if (p.ok) setPasses(await p.json())
    setPassLedgers({}) // drop cached histories so an expand re-fetches
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
      const [membersRes, passesRes, bookingsRes] = await Promise.all([
        fetch(`${base}/members`, { headers: h }),
        fetch(`${base}/members/${memberId}/passes`, { headers: h }),
        fetch(`${base}/members/${memberId}/bookings`, { headers: h }),
      ])
      if (membersRes.ok) {
        const all: Member[] = await membersRes.json()
        setMember(all.find(m => m.id === memberId) ?? null)
      }
      if (passesRes.ok) setPasses(await passesRes.json())
      if (bookingsRes.ok) setBookings(await bookingsRes.json())
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, memberId])

  const openIssue = async () => {
    setIssueForm({ passTemplateId: '', effectiveFrom: '', notes: '' })
    setIssueError('')
    setIssued(false)
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
        }),
      })
      if (res.ok) {
        setIssued(true)
        setIssueForm({ passTemplateId: '', effectiveFrom: '', notes: '' })
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

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />
      <div className={styles.main} style={{ maxWidth: '820px' }}>
        {forbidden ? <Forbidden /> : <>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
          <a href="/dashboard/members" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>← Members</a>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{member?.full_name ?? 'Member'}</h1>
            {member?.email && <p style={{ color: '#666', fontSize: '14px', marginTop: '2px' }}>{member.email}</p>}
          </div>
        </div>

        <Card
          title="Passes"
          action={canManageMemberPasses(roles) && (
            <button onClick={openIssue} style={{
              padding: '7px 14px', backgroundColor: '#085041', color: 'white', border: 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>
              Issue pass
            </button>
          )}
        >
          {passes.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>No passes.</p>
          ) : (
            <div>
              {passes.map((p, i) => {
                const isCredit = p.credits_total !== null
                const open = expandedPassId === p.id
                const entries = passLedgers[p.id]
                return (
                  <div key={p.id} style={{ borderBottom: i < passes.length - 1 ? '1px solid #f4f4f4' : 'none' }}>
                    <div
                      onClick={isCredit ? () => togglePassHistory(p.id) : undefined}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0', cursor: isCredit ? 'pointer' : 'default',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>
                          {isCredit && <span style={{ color: '#999', marginRight: '6px' }}>{open ? '▾' : '▸'}</span>}
                          {p.pass_template?.name ?? 'Pass'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {p.credits_total === null ? 'Unlimited' : `${p.credits_remaining} / ${p.credits_total} credits`}
                          {' · '}{fmtDate(p.effective_from)} – {fmtDate(p.expires_at)}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </div>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>

                    {open && (
                      <div style={{ padding: '4px 0 14px 18px' }}>
                        {!entries ? (
                          <p style={{ fontSize: '12px', color: '#999' }}>Loading history…</p>
                        ) : entries.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#999' }}>No credit movements.</p>
                        ) : (
                          entries.map((e, j) => (
                            <div key={e.id} style={{
                              display: 'grid', gridTemplateColumns: '150px 1fr 60px 60px', gap: '8px', alignItems: 'center',
                              padding: '6px 0', fontSize: '12px',
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
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card title="Bookings">
          {bookings.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>No bookings.</p>
          ) : (
            <div>
              {bookings.slice(0, 25).map((b, i) => (
                <div key={b.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: i < Math.min(bookings.length, 25) - 1 ? '1px solid #f4f4f4' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.session_occurrence?.session?.name ?? 'Session'}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {b.session_occurrence ? fmtDateTime(b.session_occurrence.starts_at) : '—'}
                      {b.payment_type ? ` · ${b.payment_type}` : ''}
                      {b.guest_count > 0 ? ` · +${b.guest_count} guest${b.guest_count > 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
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
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Issue a pass to {member?.full_name ?? 'this member'}</h2>
              <button onClick={() => setShowIssue(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>

            {issued && (
              <div style={{ padding: '10px 12px', backgroundColor: '#e8f5ee', borderRadius: '8px', color: '#085041', fontSize: '13px', marginBottom: '16px' }}>
                Pass issued. Add another below, or close.
              </div>
            )}
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
                <label style={labelStyle}>Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. paid by bank transfer, comp for referral"
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
                {issuing ? 'Issuing…' : 'Issue pass'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
