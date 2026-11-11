'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { MEMBERSHIP_STATUS, dateOnlyLabel, type MembershipTemplate, type StaffMembership } from '@/lib/memberships'
import { formatMoney } from '@/lib/money'
import { color, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, controlStyle } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'

const PAGE_SIZE = 25

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'live', label: 'Current (active, overdue, starting soon)' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Payment overdue' },
  { value: 'pending', label: 'Starts soon' },
  { value: 'capped', label: 'Limit reached' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Ended' },
  { value: '', label: 'All' },
]

// What's next for this membership, in a few words: the date that matters for its status.
export function membershipWhen(m: StaffMembership): string {
  if (m.status === 'pending') return `Starts ${dateOnlyLabel(m.started_on)}`
  if (m.status === 'past_due' && m.past_due) return `Overdue since ${dateOnlyLabel(m.past_due.since)}`
  if (m.status === 'cancelled') return m.cancelled_at ? `Cancelled ${dateOnlyLabel(m.cancelled_at)}` : 'Cancelled'
  if (m.status === 'expired') return m.current_period_end ? `Ended ${dateOnlyLabel(m.current_period_end)}` : 'Ended'
  if (m.cancel_at) return `Ends ${dateOnlyLabel(m.cancel_at)}`
  if (m.next_charge_on && !m.is_comp) return `Renews ${dateOnlyLabel(m.next_charge_on)}`
  return m.current_period_end ? `Until ${dateOnlyLabel(m.current_period_end)}` : ''
}

// Memberships → Members: everyone's memberships, filtered by status and plan (GET …/member-memberships).
export default function MemberMembershipList({ orgId, token, templates }: {
  orgId: string
  token: string
  templates: MembershipTemplate[]
}) {
  const [status, setStatus] = useState('live')
  const [templateId, setTemplateId] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: StaffMembership[]; total: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    if (status) qs.set('status', status)
    if (templateId) qs.set('template_id', templateId)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/member-memberships?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (!active) return
        if (!res.ok) { setError('Could not load members’ memberships.'); setData({ items: [], total: 0 }); return }
        setData(await res.json())
      })
      .catch(() => { if (active) { setError('Could not reach the server. Please try again.'); setData({ items: [], total: 0 }) } })
    return () => { active = false }
  }, [orgId, token, status, templateId, page])

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <select aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={{ ...controlStyle, width: 'auto', minWidth: 220 }}>
          {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {templates.length > 1 && (
          <select aria-label="Plan" value={templateId} onChange={e => { setTemplateId(e.target.value); setPage(1) }} style={{ ...controlStyle, width: 'auto', minWidth: 200 }}>
            <option value="">All plans</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_active ? '' : ' (hidden)'}</option>)}
          </select>
        )}
      </div>

      {error && <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, color: color.dangerInk, borderRadius: 8 }}>{error}</div>}

      {data == null ? (
        <div style={{ color: color.muted }}>Loading…</div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Users size={28} aria-hidden />}
          message={status === 'live' && !templateId ? 'No one has a membership yet. Members join from your Pricing page, or you can give one from a member’s page.' : 'No memberships match these filters.'} />
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.items.map((m, i) => {
              const s = MEMBERSHIP_STATUS[m.status]
              return (
                <li key={m.id} style={{ borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
                  <Link href={`/dashboard/member-memberships/${m.id}`} className={`${ui.rowLink} ${ui.focusable}`}
                    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '14px 20px', color: 'inherit', textDecoration: 'none', ['--hover-bg' as string]: '#F7F8F5' }}>
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{m.member_name}</div>
                      <div style={{ fontSize: 14, color: color.muted, marginTop: 2 }}>
                        {m.name}
                        {m.is_comp ? ' · free' : ` · ${formatMoney(m.price, m.currency)}`}
                        {m.session_cap != null && m.sessions_left_this_period != null && ` · ${m.sessions_left_this_period} of ${m.session_cap} left`}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: m.status === 'past_due' ? color.dangerInk : color.ink2, minWidth: 150, ...tabularNums }}>{membershipWhen(m)}</div>
                    {s && <Chip tone={s.tone}>{s.label}</Chip>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {data && pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Button size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Previous</Button>
          <span style={{ fontSize: 14, color: color.ink2, ...tabularNums }}>Page {page} of {pages} · {data.total} memberships</span>
          <Button size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= pages}>Next</Button>
        </div>
      )}
    </>
  )
}
