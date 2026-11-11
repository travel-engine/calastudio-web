'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MEMBERSHIP_STATUS, isLiveMembership, localDateKey, periodUnit, type MembershipTemplate, type StaffMembership } from '@/lib/memberships'
import { membershipWhen } from '@/app/dashboard/memberships/MemberMembershipList'
import { formatMoney } from '@/lib/money'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, Field, Modal, alertStyle, controlStyle } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'

// Member page → Memberships: this member's memberships (GET …/members/{id}/memberships), each linking
// to its own page for cancel / refund / price, plus "Give membership" (a comp: POST …/member-memberships).
export default function MemberMembershipsCard({ orgId, token, memberId, memberName, onChanged }: {
  orgId: string
  token: string
  memberId: string
  memberName: string
  onChanged: () => void
}) {
  const base = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}`
  const [items, setItems] = useState<StaffMembership[] | null>(null)
  const [showEnded, setShowEnded] = useState(false)
  const [giving, setGiving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`${base}/members/${memberId}/memberships`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    setItems(res?.ok ? await res.json() : [])
  }, [base, memberId, token])

  useEffect(() => { load() }, [load])

  const live = items?.filter(m => isLiveMembership(m.status)) ?? []
  const ended = items?.filter(m => !isLiveMembership(m.status)) ?? []
  const shown = showEnded ? [...live, ...ended] : live

  return (
    <Card style={{ overflow: 'hidden' }} aria-labelledby="memberships-heading">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px 12px' }}>
        <h2 id="memberships-heading" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Memberships</h2>
        <Button size="sm" onClick={() => setGiving(true)}>Give membership</Button>
      </div>
      {items == null ? (
        <p style={{ margin: 0, padding: '4px 20px 18px', fontSize: 15, color: color.muted }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p style={{ margin: 0, padding: '4px 20px 18px', fontSize: 15, color: color.muted }}>No current membership.</p>
      ) : shown.map(m => {
        const s = MEMBERSHIP_STATUS[m.status]
        return (
          <Link key={m.id} href={`/dashboard/member-memberships/${m.id}`} className={`${ui.rowLink} ${ui.focusable}`}
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '14px 20px', borderTop: `1px solid ${color.divider}`,
              color: color.ink, textDecoration: 'none', opacity: isLiveMembership(m.status) ? 1 : 0.7, ['--hover-bg' as string]: '#F7F8F5',
            }}>
            <span style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{m.name}{m.is_comp ? <span style={{ fontWeight: 400, color: color.muted }}> · free</span> : null}</span>
              <span style={{ fontSize: 14, color: color.ink2, ...tabularNums }}>
                {m.session_cap == null ? 'Unlimited' : `${m.sessions_left_this_period ?? 0} of ${m.session_cap} left`}
                {!m.is_comp && ` · ${formatMoney(m.price, m.currency)}`}
              </span>
            </span>
            <span style={{ fontSize: 14, color: m.status === 'past_due' ? color.dangerInk : color.ink2, ...tabularNums }}>{membershipWhen(m)}</span>
            {s && <Chip tone={s.tone}>{s.label}</Chip>}
          </Link>
        )
      })}
      {ended.length > 0 && (
        <div style={{ padding: '10px 20px 14px', borderTop: `1px solid ${color.divider}` }}>
          <button type="button" onClick={() => setShowEnded(v => !v)} className={ui.focusable}
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: 14, fontWeight: 600, color: color.primary, cursor: 'pointer' }}>
            {showEnded ? 'Hide ended memberships' : `Show ended memberships (${ended.length})`}
          </button>
        </div>
      )}

      {giving && (
        <GiveMembershipDialog base={base} token={token} memberId={memberId} memberName={memberName}
          onClose={() => setGiving(false)}
          onDone={() => { setGiving(false); load(); onChanged() }} />
      )}
    </Card>
  )
}

function GiveMembershipDialog({ base, token, memberId, memberName, onClose, onDone }: {
  base: string
  token: string
  memberId: string
  memberName: string
  onClose: () => void
  onDone: () => void
}) {
  const [templates, setTemplates] = useState<MembershipTemplate[] | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [startDate, setStartDate] = useState(localDateKey())
  const [periods, setPeriods] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${base}/membership-templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => setTemplates(res.ok ? await res.json() : []))
      .catch(() => setTemplates([]))
  }, [base, token])

  const t = templates?.find(x => x.id === templateId)
  const unit = t ? periodUnit(t.period_type, t.period_rolling_value) : null
  const n = Number(periods)
  const badPeriods = !!unit && (!Number.isInteger(n) || n < 1 || n > 52)

  const go = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${base}/member-memberships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_id: memberId, template_id: templateId, start_date: startDate || null, periods: unit ? n : null, note: note.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Could not give this membership.')
        return
      }
      onDone()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Give ${memberName} a membership`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
        {error && <div role="alert" style={alertStyle()}>{error}</div>}
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
          Free of charge, with no card and no renewal. It ends by itself and we email {memberName} to say it’s been added.
        </p>
        <Field label="Membership" htmlFor="give-template" hint={templates?.length === 0 ? 'No memberships on sale. Create one on the Memberships page.' : undefined}>
          <select id="give-template" value={templateId} onChange={e => setTemplateId(e.target.value)} style={controlStyle}>
            <option value="">Choose a membership…</option>
            {templates?.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Starts" htmlFor="give-start">
          <input id="give-start" type="date" min={localDateKey()} value={startDate} onChange={e => setStartDate(e.target.value)} style={controlStyle} />
        </Field>
        {unit && (
          <Field label={`How many ${unit.includes(' ') ? 'periods' : `${unit}s`}`} htmlFor="give-periods" hint={`Each period is ${unit.includes(' ') ? unit : `a ${unit}`}. Up to 52.`}>
            <input id="give-periods" type="number" min="1" max="52" step="1" value={periods} onChange={e => setPeriods(e.target.value)} aria-describedby="give-periods-hint" style={controlStyle} />
          </Field>
        )}
        <Field label="Note (optional)" htmlFor="give-note" hint="Staff only.">
          <input id="give-note" type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Instructor trade, prize winner" aria-describedby="give-note-hint" style={controlStyle} />
        </Field>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="primary" onClick={go} disabled={busy || !templateId || badPeriods} style={{ flex: 1 }}>{busy ? 'Adding…' : 'Give membership'}</Button>
        </div>
      </div>
    </Modal>
  )
}
