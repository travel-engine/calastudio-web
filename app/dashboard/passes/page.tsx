'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Ticket, X } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import ManagePassModal from '@/app/components/ManagePassModal'
import { canViewPassTemplates, canManagePassTemplates } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { formatDayMonth } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color, font, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, PageHeader, buttonStyle, cardStyle, controlStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

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
  first_name: string
  last_name: string
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

function expiryRuleLabel(pt: Pick<PassTemplate, 'expiry_type' | 'expiry_fixed_date' | 'expiry_rolling_value'>) {
  if (pt.expiry_type === 'fixed_date') return pt.expiry_fixed_date ? `Expires ${formatDayMonth(pt.expiry_fixed_date)}` : 'Fixed expiry date'
  if (pt.expiry_type === 'rolling_days') return `Expires ${pt.expiry_rolling_value ?? '?'} days after purchase`
  return `Expires ${pt.expiry_rolling_value ?? '?'} months after purchase`
}

const passStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  active: { label: 'Active', tone: 'primary' },
  low: { label: 'Running low', tone: 'warn' },
  frozen: { label: 'Frozen', tone: 'info' },
  expired: { label: 'Expired', tone: 'neutral' },
  exhausted: { label: 'Used up', tone: 'neutral' },
}

function StatusBadge({ status }: { status: string }) {
  const s = passStatusChip[status] ?? { label: status, tone: 'neutral' as const }
  return <Chip tone={s.tone}>{s.label}</Chip>
}

const inputStyle: React.CSSProperties = { ...controlStyle, padding: '10px 12px' }

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: color.ink }

const th: React.CSSProperties = {
  textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
  color: color.muted, background: '#FAFAF8', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '12px 16px', borderTop: `1px solid ${color.divider}`, fontSize: 15, verticalAlign: 'middle' }

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

  // Manage pass modal (shared with the member profile)
  const [managingPassId, setManagingPassId] = useState<string | null>(null)

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
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }

      const t = ctx.token
      setToken(t)
      const org = ctx.org
      setOrgId(org.id)
      const myRoles: string[] = ctx.roles
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

  const filteredMembers = members.filter(m => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return true
    return displayName(m).toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })
  const selectedMember = members.find(m => m.id === issueForm.userId)

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="passes" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  const activeTemplates = templates.filter(t => t.is_active)
  const nowMs = Date.now()
  const tabs = [
    { key: 'templates' as const, label: `Pass types (${templates.length})` },
    { key: 'issued' as const, label: `Issued to members (${passes.length})` },
  ]

  return (
    <div className={styles.shell}>
      <Sidebar active="passes" roles={roles} />

      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: space.pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <PageHeader
              eyebrow="Revenue"
              title="Passes"
              actions={tab === 'templates'
                ? canManagePassTemplates(roles) && (
                  <Button href="/dashboard/passes/new" variant="primary" icon={<Plus size={18} strokeWidth={2} aria-hidden />}>New pass type</Button>
                )
                : <Button variant="primary" onClick={openIssueModal} icon={<Plus size={18} strokeWidth={2} aria-hidden />}>Issue a pass</Button>}
            />

            <div role="tablist" aria-label="View" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${color.border}` }}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={ui.focusable}
                  style={{
                    minHeight: space.target, padding: '0 12px', marginBottom: -1, border: 'none', background: 'transparent', cursor: 'pointer',
                    borderBottom: `2px solid ${tab === t.key ? color.primary : 'transparent'}`,
                    color: tab === t.key ? color.primaryInk : color.muted, fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Pass types: a card each */}
            {tab === 'templates' && (
              templates.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Ticket size={22} strokeWidth={1.8} />}
                    message={canManagePassTemplates(roles)
                      ? 'Create a pass type, like a 10-class pack, that members can buy from your booking page.'
                      : "Your studio hasn't created any pass types yet."}
                    action={canManagePassTemplates(roles) ? <Button href="/dashboard/passes/new" variant="primary">Create a pass type</Button> : undefined}
                  />
                </Card>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {templates.map(t => {
                    // Only worth showing when it differs from the price (a single-credit pass is its own per-class price).
                    const perClass = t.pass_type === 'credit' && t.credit_count && t.credit_count > 1 ? t.price / t.credit_count : null
                    return (
                      <article key={t.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 22px', opacity: t.is_active ? 1 : 0.6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{t.name}</h2>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <Chip>{t.pass_type === 'unlimited' ? 'Unlimited classes' : `${t.credit_count ?? '?'} credit${t.credit_count === 1 ? '' : 's'}`}</Chip>
                            <Chip>{expiryRuleLabel(t)}</Chip>
                            {!t.is_active && <Chip tone="warn">Not on sale</Chip>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTop: `1px solid ${color.divider}` }}>
                          <span style={{ fontSize: 28, fontWeight: 600, ...tabularNums }}>{formatMoney(t.price, t.currency)}</span>
                          {perClass != null && <span style={{ fontSize: 14, color: color.muted, ...tabularNums }}>{formatMoney(perClass, t.currency)} per class</span>}
                        </div>
                        {canManagePassTemplates(roles) && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button size="sm" href={`/dashboard/passes/${t.id}`}>Edit<span className={styles.srOnly}> {t.name}</span></Button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )
            )}

            {/* Issued to members */}
            {tab === 'issued' && (
              passes.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Ticket size={22} strokeWidth={1.8} />}
                    message="No passes issued yet. Issue one to a member here, or wait for members to buy one from your booking page."
                    action={<Button variant="primary" onClick={openIssueModal}>Issue a pass</Button>}
                  />
                </Card>
              ) : (
                <Card style={{ overflow: 'hidden' }} aria-label="Issued passes">
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Member</th><th style={th}>Pass</th><th style={th}>Credits left</th><th style={th}>Expires</th><th style={th}>Status</th>
                          <th style={th}><span className={styles.srOnly}>Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {passes.map(p => {
                          const credit = p.credits_total !== null
                          const ratio = credit && p.credits_total ? (p.credits_remaining ?? 0) / p.credits_total : 1
                          const daysLeft = Math.ceil((Date.parse(p.expires_at) - nowMs) / 864e5)
                          const expiringSoon = (p.status === 'active' || p.status === 'low') && daysLeft >= 0 && daysLeft <= 7
                          const member = displayName(p.user) || 'Unknown member'
                          return (
                            <tr key={p.id}>
                              <td style={td}>
                                <span style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600 }}>{member}</span>
                                  {p.user?.email && <span style={{ fontSize: 13, color: color.muted }}>{p.user.email}</span>}
                                </span>
                              </td>
                              <td style={{ ...td, color: color.ink2 }}>{p.pass_template?.name ?? '—'}</td>
                              <td style={td}>
                                {credit ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                                    <span aria-hidden style={{ width: 80, height: 6, borderRadius: 3, background: color.track, overflow: 'hidden' }}>
                                      <span style={{ display: 'block', width: `${Math.round(Math.min(ratio, 1) * 100)}%`, height: '100%', background: ratio <= 0.2 ? color.lowBar : color.primary }} />
                                    </span>
                                    <span style={{ fontSize: 14, whiteSpace: 'nowrap', ...tabularNums }}>{p.credits_remaining} / {p.credits_total}</span>
                                  </span>
                                ) : <span style={{ fontSize: 14, color: color.ink2 }}>Unlimited</span>}
                              </td>
                              <td style={{ ...td, ...tabularNums, whiteSpace: 'nowrap', color: expiringSoon ? color.warnInk : color.ink2, fontWeight: expiringSoon ? 600 : 400 }}>
                                {formatDayMonth(p.expires_at)}
                              </td>
                              <td style={td}>
                                {expiringSoon ? <Chip tone="warn">Expiring soon</Chip> : <StatusBadge status={p.status} />}
                              </td>
                              <td style={{ ...td, textAlign: 'right' }}>
                                <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                                  <button type="button" onClick={() => setManagingPassId(p.id)} aria-label={`Manage ${member}'s pass`}
                                    className={`${ui.button} ${ui.focusable}`} style={buttonStyle('secondary', 'sm')}>
                                    Manage
                                  </button>
                                  <Link href={`/dashboard/members/${p.user_id}`} className={ui.focusable}
                                    style={{ fontSize: 14, fontWeight: 600, color: color.primary, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                    View member
                                  </Link>
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            )}
          </div>
        )}
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
                  padding: '10px 14px', border: `1px solid ${color.primary}`, borderRadius: radius.control, backgroundColor: color.primarySoft
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{displayName(selectedMember)}</div>
                    <div style={{ fontSize: '12px', color: color.muted }}>{selectedMember.email}</div>
                  </div>
                  <button
                    onClick={() => setIssueForm(p => ({ ...p, userId: '' }))}
                    style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: color.muted }}
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
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: `1px solid ${color.border}`, borderRadius: '8px', marginTop: '8px' }}>
                    {membersLoading ? (
                      <div style={{ padding: '12px', fontSize: '13px', color: color.muted }}>Loading members...</div>
                    ) : filteredMembers.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '13px', color: color.muted }}>No members found</div>
                    ) : (
                      filteredMembers.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setIssueForm(p => ({ ...p, userId: m.id }))}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                            border: 'none', borderBottom: `1px solid ${color.divider}`, backgroundColor: 'white', cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{displayName(m)}</div>
                          <div style={{ fontSize: '12px', color: color.muted }}>{m.email}</div>
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
              <p style={{ fontSize: '12px', color: color.muted, marginTop: '6px' }}>Leave blank to start today</p>
            </div>

            {/* "Enable auto-renew" is hidden until the API acts on it (nothing renews or charges yet). */}

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

      {managingPassId && (
        <ManagePassModal orgId={orgId} token={token} passId={managingPassId}
          onClose={() => setManagingPassId(null)}
          onChanged={reloadPasses} />
      )}
    </div>
  )
}

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(23, 32, 28, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24,
    }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{
        background: color.surface, borderRadius: radius.card, padding: 28, width: '100%',
        maxWidth: wide ? 560 : 480, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: font.body,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className={ui.focusable}
            style={{ ...buttonStyle('secondary', 'sm'), width: 36, padding: 0 }}>
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, borderRadius: radius.control, color: color.dangerInk, fontSize: 15 }}>
      {message}
    </div>
  )
}

const secondaryButtonStyle: React.CSSProperties = buttonStyle('secondary')

function primaryButtonStyle(busy: boolean): React.CSSProperties {
  return { ...buttonStyle('primary'), flex: 1, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }
}
