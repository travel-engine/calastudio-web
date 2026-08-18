'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewPassTemplates, canManagePassTemplates } from '@/lib/roles'

interface PassTemplate {
  id: string
  name: string
  description: string | null
  pass_type: 'credit' | 'unlimited'
  credit_count: number | null
  expiry_type: 'fixed_date' | 'rolling_days' | 'rolling_months'
  expiry_fixed_date: string | null
  expiry_rolling_value: number | null
  price: number
  currency: string
  is_active: boolean
}

interface Member {
  id: string
  full_name: string
  email: string
}

interface MemberPass {
  id: string
  user_id: string
  pass_template_id: string
  credits_total: number | null
  credits_remaining: number | null
  effective_from: string
  expires_at: string
  status: 'active' | 'low' | 'frozen' | 'expired' | 'exhausted'
  auto_renew_enabled: boolean
  notes: string | null
  user: Member | null
  pass_template: PassTemplate | null
}

interface LedgerEntry {
  id: string
  movement_type: 'purchase' | 'booking_debit' | 'cancel_credit' | 'expired_forfeit' | 'promotion_credit' | 'studio_adjustment'
  credits_delta: number
  credits_after: number
  notes: string | null
  created_at: string
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function expiryRuleLabel(pt: Pick<PassTemplate, 'expiry_type' | 'expiry_fixed_date' | 'expiry_rolling_value'>) {
  if (pt.expiry_type === 'fixed_date') return pt.expiry_fixed_date ? `Fixed: ${pt.expiry_fixed_date}` : 'Fixed date'
  if (pt.expiry_type === 'rolling_days') return `${pt.expiry_rolling_value ?? '?'} days from purchase`
  return `${pt.expiry_rolling_value ?? '?'} months from purchase`
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#e8f5ee', color: '#085041', label: 'Active' },
    low: { bg: '#fff3cd', color: '#7a4f00', label: 'Low' },
    frozen: { bg: '#e8eef8', color: '#1B4F8A', label: 'Frozen' },
    expired: { bg: '#f4f4f4', color: '#666', label: 'Expired' },
    exhausted: { bg: '#fdecea', color: '#8b1a1a', label: 'Exhausted' },
  }
  const s = styles[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

const movementLabels: Record<string, string> = {
  purchase: 'Purchase',
  booking_debit: 'Booking',
  cancel_credit: 'Cancellation credit',
  expired_forfeit: 'Expired',
  promotion_credit: 'Promotion',
  studio_adjustment: 'Studio adjustment',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #e2e2e2',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  backgroundColor: 'white'
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }

export default function PassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [token, setToken] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [tab, setTab] = useState<'templates' | 'issued'>('templates')

  const [templates, setTemplates] = useState<PassTemplate[]>([])
  const [passes, setPasses] = useState<MemberPass[]>([])

  // Issue pass modal
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [issueForm, setIssueForm] = useState({
    userId: '', passTemplateId: '', effectiveFrom: '', autoRenewEnabled: false, notes: ''
  })
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState('')

  // Manage pass modal
  const [managingPass, setManagingPass] = useState<MemberPass | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [manageError, setManageError] = useState('')
  const [manageBusy, setManageBusy] = useState(false)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [extendDate, setExtendDate] = useState('')
  const [extendReason, setExtendReason] = useState('')

  const authedFetch = useCallback((path: string, init?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` }
    }), [orgId, token])

  const reloadTemplates = useCallback(async () => {
    const res = await authedFetch('/pass-templates')
    if (res.ok) setTemplates(await res.json())
  }, [authedFetch])

  const reloadPasses = useCallback(async () => {
    const res = await authedFetch('/member-passes')
    if (res.ok) setPasses(await res.json())
  }, [authedFetch])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const t = session.access_token
      setToken(t)

      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()
      setOrgId(org.id)

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      const myRoles: string[] = roleRes.ok ? (await roleRes.json()).roles : []
      setRoles(myRoles)

      if (!canViewPassTemplates(myRoles)) {
        setForbidden(true)
        setLoading(false)
        return
      }

      const [tplRes, passRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/pass-templates`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/member-passes`, { headers: { Authorization: `Bearer ${t}` } }),
      ])
      if (tplRes.ok) setTemplates(await tplRes.json())
      if (passRes.ok) setPasses(await passRes.json())

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const openIssueModal = async () => {
    setIssueForm({ userId: '', passTemplateId: '', effectiveFrom: '', autoRenewEnabled: false, notes: '' })
    setIssueError('')
    setMemberSearch('')
    setShowIssueModal(true)
    setMembersLoading(true)
    const res = await authedFetch('/members')
    if (res.ok) setMembers(await res.json())
    setMembersLoading(false)
  }

  const handleIssue = async () => {
    if (!issueForm.userId) { setIssueError('Select a member'); return }
    if (!issueForm.passTemplateId) { setIssueError('Select a pass template'); return }

    setIssuing(true)
    setIssueError('')

    try {
      const res = await authedFetch('/member-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: issueForm.userId,
          pass_template_id: issueForm.passTemplateId,
          effective_from: issueForm.effectiveFrom || null,
          auto_renew_enabled: issueForm.autoRenewEnabled,
          notes: issueForm.notes || null,
        })
      })

      if (res.ok) {
        setShowIssueModal(false)
        await reloadPasses()
      } else {
        const data = await res.json().catch(() => null)
        setIssueError(data?.error ?? 'Could not issue this pass.')
      }
    } catch {
      setIssueError('Could not issue this pass.')
    } finally {
      setIssuing(false)
    }
  }

  const openManageModal = async (pass: MemberPass) => {
    setManagingPass(pass)
    setManageError('')
    setAdjustDelta('')
    setAdjustReason('')
    setExtendDate(pass.expires_at)
    setExtendReason('')
    setLedgerLoading(true)
    const res = await authedFetch(`/member-passes/${pass.id}/ledger`)
    if (res.ok) setLedger(await res.json())
    setLedgerLoading(false)
  }

  const refreshManagingPass = async (passId: string) => {
    const res = await authedFetch(`/member-passes/${passId}`)
    if (res.ok) {
      const updated = await res.json()
      setManagingPass(updated)
      setPasses(prev => prev.map(p => p.id === passId ? updated : p))
    }
    const ledgerRes = await authedFetch(`/member-passes/${passId}/ledger`)
    if (ledgerRes.ok) setLedger(await ledgerRes.json())
  }

  const handleFreezeToggle = async () => {
    if (!managingPass) return
    setManageBusy(true)
    setManageError('')
    const action = managingPass.status === 'frozen' ? 'unfreeze' : 'freeze'
    const res = await authedFetch(`/member-passes/${managingPass.id}/${action}`, { method: 'POST' })
    if (res.ok) {
      await refreshManagingPass(managingPass.id)
    } else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? `Could not ${action} this pass.`)
    }
    setManageBusy(false)
  }

  const handleAdjust = async () => {
    if (!managingPass) return
    const delta = parseInt(adjustDelta)
    if (!delta) { setManageError('Enter a non-zero credit adjustment'); return }
    if (!adjustReason.trim()) { setManageError('A reason is required for credit adjustments'); return }

    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/member-passes/${managingPass.id}/adjust-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta, reason: adjustReason })
    })
    if (res.ok) {
      setAdjustDelta('')
      setAdjustReason('')
      await refreshManagingPass(managingPass.id)
    } else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? 'Could not adjust credits.')
    }
    setManageBusy(false)
  }

  const handleExtend = async () => {
    if (!managingPass) return
    if (!extendDate) { setManageError('Choose a new expiry date'); return }
    if (!extendReason.trim()) { setManageError('A reason is required to change the expiry date'); return }

    setManageBusy(true)
    setManageError('')
    const res = await authedFetch(`/member-passes/${managingPass.id}/extend-expiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_expires_at: extendDate, reason: extendReason })
    })
    if (res.ok) {
      setExtendReason('')
      await refreshManagingPass(managingPass.id)
    } else {
      const data = await res.json().catch(() => null)
      setManageError(data?.error ?? 'Could not extend expiry.')
    }
    setManageBusy(false)
  }

  const filteredMembers = members.filter(m => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return true
    return m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })
  const selectedMember = members.find(m => m.id === issueForm.userId)

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="passes" />
        <div style={{ marginLeft: '240px', flex: 1, padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const activeTemplates = templates.filter(t => t.is_active)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <Sidebar active="passes" roles={roles} />

      <div style={{ marginLeft: '240px', flex: 1, padding: '32px' }}>

        {forbidden ? <Forbidden /> : <>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Passes</h1>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
              Manage pass types and the passes you've issued to members
            </p>
          </div>
          {tab === 'templates' ? (
            canManagePassTemplates(roles) && (
              <a href="/dashboard/passes/new" style={{
                padding: '10px 20px', backgroundColor: '#085041', color: 'white', borderRadius: '8px',
                fontSize: '14px', fontWeight: 600, textDecoration: 'none'
              }}>
                + New pass template
              </a>
            )
          ) : (
            <button onClick={openIssueModal} style={{
              padding: '10px 20px', backgroundColor: '#085041', color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer'
            }}>
              + Issue pass
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e2e2e2' }}>
          {[
            { key: 'templates' as const, label: `Pass templates (${templates.length})` },
            { key: 'issued' as const, label: `Issued passes (${passes.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderBottom: `2px solid ${tab === t.key ? '#085041' : 'transparent'}`,
                backgroundColor: 'transparent',
                color: tab === t.key ? '#085041' : '#666',
                fontWeight: tab === t.key ? 600 : 400,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Pass templates tab */}
        {tab === 'templates' && (
          templates.length === 0 ? (
            <div style={{
              backgroundColor: 'white', borderRadius: '12px', padding: '64px', textAlign: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No pass templates yet</h3>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: canManagePassTemplates(roles) ? '24px' : 0 }}>
                {canManagePassTemplates(roles)
                  ? "Create a pass type — like a 10-class pack or monthly unlimited — that members can purchase."
                  : "Your studio hasn't created any pass types yet."}
              </p>
              {canManagePassTemplates(roles) && (
                <a href="/dashboard/passes/new" style={{
                  display: 'inline-block', padding: '10px 24px', backgroundColor: '#085041', color: 'white',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none'
                }}>
                  Create a pass template
                </a>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 90px',
                padding: '12px 24px', backgroundColor: '#f4f4f4', borderBottom: '1px solid #e2e2e2',
                fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                <div>Name</div>
                <div>Type</div>
                <div>Credits</div>
                <div>Expiry</div>
                <div>Price</div>
                <div>Actions</div>
              </div>
              {templates.map((t, i) => (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 90px',
                  padding: '16px 24px', borderBottom: i < templates.length - 1 ? '1px solid #f4f4f4' : 'none',
                  alignItems: 'center', opacity: t.is_active ? 1 : 0.5
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.name}</div>
                    {!t.is_active && <div style={{ fontSize: '12px', color: '#999' }}>Deactivated</div>}
                  </div>
                  <div style={{ fontSize: '13px', textTransform: 'capitalize' }}>{t.pass_type}</div>
                  <div style={{ fontSize: '13px' }}>{t.pass_type === 'unlimited' ? '∞' : t.credit_count ?? '—'}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>{expiryRuleLabel(t)}</div>
                  <div style={{ fontSize: '13px' }}>{formatMoney(t.price, t.currency)}</div>
                  <div>
                    {canManagePassTemplates(roles) ? (
                      <a href={`/dashboard/passes/${t.id}`} style={{
                        padding: '6px 12px', backgroundColor: '#f4f4f4', borderRadius: '6px',
                        fontSize: '12px', color: '#444', textDecoration: 'none', fontWeight: 500
                      }}>
                        Edit
                      </a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#999' }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Issued passes tab */}
        {tab === 'issued' && (
          passes.length === 0 ? (
            <EmptyState
              icon="🎟"
              title="No passes issued yet"
              body="Issue a pass to a member manually, or wait for members to purchase one from your booking page."
              cta="Issue a pass"
              onClick={openIssueModal}
            />
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 90px',
                padding: '12px 24px', backgroundColor: '#f4f4f4', borderBottom: '1px solid #e2e2e2',
                fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                <div>Member</div>
                <div>Pass</div>
                <div>Credits</div>
                <div>Status</div>
                <div>Expires</div>
                <div>Actions</div>
              </div>
              {passes.map((p, i) => (
                <div key={p.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 90px',
                  padding: '16px 24px', borderBottom: i < passes.length - 1 ? '1px solid #f4f4f4' : 'none',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.user?.full_name ?? 'Unknown member'}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{p.user?.email}</div>
                  </div>
                  <div style={{ fontSize: '13px' }}>{p.pass_template?.name ?? '—'}</div>
                  <div style={{ fontSize: '13px' }}>
                    {p.credits_remaining === null ? '∞' : `${p.credits_remaining} / ${p.credits_total}`}
                  </div>
                  <div><StatusBadge status={p.status} /></div>
                  <div style={{ fontSize: '13px', color: '#666' }}>{p.expires_at}</div>
                  <div>
                    <button onClick={() => openManageModal(p)} style={{
                      padding: '6px 12px', backgroundColor: '#f4f4f4', border: 'none', borderRadius: '6px',
                      fontSize: '12px', color: '#444', cursor: 'pointer', fontWeight: 500
                    }}>
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        </>}
      </div>

      {/* Issue pass modal */}
      {showIssueModal && (
        <ModalShell title="Issue a pass" onClose={() => setShowIssueModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Member</label>
              {selectedMember ? (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', border: '1px solid #085041', borderRadius: '8px', backgroundColor: '#e8f5ee'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedMember.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{selectedMember.email}</div>
                  </div>
                  <button
                    onClick={() => setIssueForm(p => ({ ...p, userId: '' }))}
                    style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666' }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search members by name or email..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e2e2', borderRadius: '8px', marginTop: '8px' }}>
                    {membersLoading ? (
                      <div style={{ padding: '12px', fontSize: '13px', color: '#666' }}>Loading members...</div>
                    ) : filteredMembers.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '13px', color: '#666' }}>No members found</div>
                    ) : (
                      filteredMembers.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setIssueForm(p => ({ ...p, userId: m.id }))}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                            border: 'none', borderBottom: '1px solid #f4f4f4', backgroundColor: 'white', cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.full_name}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>{m.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              <label style={labelStyle}>Pass template</label>
              <select
                value={issueForm.passTemplateId}
                onChange={e => setIssueForm(p => ({ ...p, passTemplateId: e.target.value }))}
                style={inputStyle}
              >
                <option value="">Select a pass...</option>
                {activeTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.price, t.currency)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Effective from</label>
              <input
                type="date"
                value={issueForm.effectiveFrom}
                onChange={e => setIssueForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                style={inputStyle}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>Leave blank to start today</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={issueForm.autoRenewEnabled}
                onChange={e => setIssueForm(p => ({ ...p, autoRenewEnabled: e.target.checked }))}
              />
              Enable auto-renew
            </label>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={issueForm.notes}
                onChange={e => setIssueForm(p => ({ ...p, notes: e.target.value }))}
                style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
                placeholder="Optional — internal note about why this pass was issued"
              />
            </div>

            {issueError && <ErrorBanner message={issueError} />}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => setShowIssueModal(false)} style={secondaryButtonStyle}>
                Cancel
              </button>
              <button onClick={handleIssue} disabled={issuing} style={primaryButtonStyle(issuing)}>
                {issuing ? 'Issuing...' : 'Issue pass'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Manage pass modal */}
      {managingPass && (
        <ModalShell title="Manage pass" onClose={() => setManagingPass(null)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{managingPass.user?.full_name}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>{managingPass.user?.email}</div>
                <div style={{ fontSize: '13px', marginTop: '8px' }}>{managingPass.pass_template?.name}</div>
              </div>
              <StatusBadge status={managingPass.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <div style={{ color: '#666' }}>Credits</div>
                <div style={{ fontWeight: 600 }}>
                  {managingPass.credits_remaining === null ? 'Unlimited' : `${managingPass.credits_remaining} / ${managingPass.credits_total}`}
                </div>
              </div>
              <div>
                <div style={{ color: '#666' }}>Expires</div>
                <div style={{ fontWeight: 600 }}>{managingPass.expires_at}</div>
              </div>
            </div>

            {manageError && <ErrorBanner message={manageError} />}

            {/* Freeze / unfreeze */}
            <div style={{ borderTop: '1px solid #e2e2e2', paddingTop: '16px' }}>
              <button
                onClick={handleFreezeToggle}
                disabled={manageBusy || managingPass.status === 'expired' || managingPass.status === 'exhausted'}
                style={secondaryButtonStyle}
              >
                {managingPass.status === 'frozen' ? 'Unfreeze pass' : 'Freeze pass'}
              </button>
            </div>

            {/* Adjust credits */}
            {managingPass.credits_remaining !== null && (
              <div style={{ borderTop: '1px solid #e2e2e2', paddingTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Adjust credits</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="number"
                    placeholder="e.g. -1 or 2"
                    value={adjustDelta}
                    onChange={e => setAdjustDelta(e.target.value)}
                    style={{ ...inputStyle, width: '120px' }}
                  />
                  <input
                    type="text"
                    placeholder="Reason (required)"
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <button onClick={handleAdjust} disabled={manageBusy} style={secondaryButtonStyle}>
                  Apply adjustment
                </button>
              </div>
            )}

            {/* Extend expiry */}
            <div style={{ borderTop: '1px solid #e2e2e2', paddingTop: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Extend expiry</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="date"
                  value={extendDate}
                  onChange={e => setExtendDate(e.target.value)}
                  style={{ ...inputStyle, width: '160px' }}
                />
                <input
                  type="text"
                  placeholder="Reason (required)"
                  value={extendReason}
                  onChange={e => setExtendReason(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <button onClick={handleExtend} disabled={manageBusy} style={secondaryButtonStyle}>
                Update expiry
              </button>
            </div>

            {/* Ledger */}
            <div style={{ borderTop: '1px solid #e2e2e2', paddingTop: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Credit history</div>
              {ledgerLoading ? (
                <div style={{ fontSize: '13px', color: '#666' }}>Loading...</div>
              ) : ledger.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#666' }}>No credit movements yet</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {ledger.slice().reverse().map(entry => (
                    <div key={entry.id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                      borderBottom: '1px solid #f4f4f4', fontSize: '13px'
                    }}>
                      <div>
                        <div>{movementLabels[entry.movement_type] ?? entry.movement_type}</div>
                        {entry.notes && <div style={{ fontSize: '12px', color: '#666' }}>{entry.notes}</div>}
                        <div style={{ fontSize: '11px', color: '#999' }}>{new Date(entry.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600, color: entry.credits_delta < 0 ? '#8b1a1a' : '#085041' }}>
                        {entry.credits_delta > 0 ? `+${entry.credits_delta}` : entry.credits_delta}
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: 400 }}>→ {entry.credits_after}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function EmptyState({ icon, title, body, cta, href, onClick }: {
  icon: string; title: string; body: string; cta: string; href?: string; onClick?: () => void
}) {
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '12px', padding: '64px', textAlign: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{title}</h3>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>{body}</p>
      {href ? (
        <a href={href} style={{
          display: 'inline-block', padding: '10px 24px', backgroundColor: '#085041', color: 'white',
          borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none'
        }}>
          {cta}
        </a>
      ) : (
        <button onClick={onClick} style={{
          padding: '10px 24px', backgroundColor: '#085041', color: 'white', border: 'none',
          borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
        }}>
          {cta}
        </button>
      )}
    </div>
  )
}

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%',
        maxWidth: wide ? '520px' : '480px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>
      {message}
    </div>
  )
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid #e2e2e2',
  borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#444', fontWeight: 500
}

function primaryButtonStyle(busy: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '10px', backgroundColor: busy ? '#9fd6b8' : '#085041', color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer'
  }
}
