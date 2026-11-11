'use client'

import { useCallback, useEffect, useState } from 'react'
import { dateOnlyLabel, MEMBERSHIP_STATUS, periodUnit, type MyMembership } from '@/lib/memberships'

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c }).format(n) }
  catch { return `${c} ${n.toFixed(2)}` }
}

const card: React.CSSProperties = { backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', padding: '18px 20px' }
const meta: React.CSSProperties = { fontSize: '15px', color: 'var(--text-meta)', marginTop: '4px' }
const linkBtn: React.CSSProperties = {
  font: 'inherit', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', background: 'none', border: 0, padding: 0,
  cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px',
}

function Badge({ m }: { m: MyMembership }) {
  const s = MEMBERSHIP_STATUS[m.status]
  if (!s) return null
  const bad = m.status === 'past_due'
  const mute = m.status === 'cancelled' || m.status === 'expired'
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px', border: '1px solid var(--line-chip)', whiteSpace: 'nowrap',
      fontSize: '14px', fontWeight: 600,
      backgroundColor: bad ? 'var(--danger-bg)' : mute ? 'transparent' : m.status === 'capped' || m.status === 'pending' ? 'var(--warn-bg)' : 'var(--ok-bg)',
      color: bad ? 'var(--danger)' : mute ? 'var(--text-label)' : m.status === 'capped' || m.status === 'pending' ? 'var(--text-warn)' : 'var(--ink)',
    }}>
      {s.label}
    </span>
  )
}

// My memberships (API PR #73): the member's memberships, newest first, with cancel / undo.
// Everything shown (status, dates, sessions left, overdue state) comes from the API as-is.
export default function MyMemberships({ apiBase, token, onLoaded }: {
  apiBase: string // …/api/organisations/{orgId}
  token: string
  onLoaded?: (count: number) => void
}) {
  const [items, setItems] = useState<MyMembership[] | null>(null)
  const [confirmId, setConfirmId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/members/me/memberships`, { headers: { Authorization: `Bearer ${token}` } })
      const list: MyMembership[] = res.ok ? await res.json() : []
      setItems(list)
      onLoaded?.(list.length)
    } catch {
      setItems([])
    }
  }, [apiBase, token, onLoaded])

  useEffect(() => { load() }, [load])

  const act = async (m: MyMembership, action: 'cancel' | 'resume') => {
    setBusyId(m.id)
    setError('')
    try {
      const res = await fetch(`${apiBase}/members/me/memberships/${m.id}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? 'Something went wrong. Please try again.'); return }
      setItems(prev => prev?.map(x => (x.id === m.id ? data : x)) ?? prev)
      setConfirmId('')
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  if (!items || items.length === 0) return null

  const live = (m: MyMembership) => m.status !== 'cancelled' && m.status !== 'expired'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>Memberships</h2>
      {error && (
        <div role="alert" style={{ padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px' }}>{error}</div>
      )}
      {items.map(m => {
        const unit = periodUnit(m.period_type, m.period_rolling_value)
        const ending = !!m.cancel_at && live(m)
        const confirming = confirmId === m.id
        const busy = busyId === m.id
        return (
          <div key={m.id} style={{ ...card, opacity: live(m) ? 1 : 0.75 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', color: 'var(--text-meta)', marginBottom: '4px' }}>
                  {m.name}{m.is_comp ? ' · complimentary' : ''}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>
                  {m.sessions_left_this_period == null
                    ? 'Unlimited sessions'
                    : `${m.sessions_left_this_period} of ${m.session_cap} session${m.session_cap === 1 ? '' : 's'} left${unit ? ` this ${unit.includes(' ') ? 'period' : unit}` : ''}`}
                </div>

                {m.status === 'pending' && <div style={meta}>Starts {dateOnlyLabel(m.started_on)}</div>}
                {live(m) && m.status !== 'pending' && m.current_period_end && !ending && (
                  <div style={meta}>Current period ends {dateOnlyLabel(m.current_period_end)}</div>
                )}
                {ending && <div style={{ ...meta, color: 'var(--text-warn)', fontWeight: 600 }}>Ends {dateOnlyLabel(m.cancel_at!)}</div>}
                {m.next_charge_on && !m.is_comp && m.status !== 'past_due' && (
                  <div style={meta}>
                    Next payment on {dateOnlyLabel(m.next_charge_on)}
                    {m.card && <> · {m.card.brand} ••{m.card.last4}</>}
                  </div>
                )}
                {m.scheduled_price && live(m) && (
                  <div style={meta}>Price changes to {money(m.scheduled_price.price, m.currency)} from {dateOnlyLabel(m.scheduled_price.from)}</div>
                )}
                {m.status === 'cancelled' && m.cancelled_at && <div style={meta}>Cancelled {dateOnlyLabel(m.cancelled_at)}</div>}
                {m.status === 'expired' && m.current_period_end && <div style={meta}>Ended {dateOnlyLabel(m.current_period_end)}</div>}
              </div>
              <Badge m={m} />
            </div>

            {m.past_due && (
              <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '15px', lineHeight: 1.5 }}>
                Your payment of {money(m.past_due.amount, m.currency)} didn&apos;t go through.
                {m.past_due.next_retry_on && <> We&apos;ll try your card again on {dateOnlyLabel(m.past_due.next_retry_on)}.</>}
                {m.past_due.grace_until && (m.past_due.can_book
                  ? <> You can keep booking until {dateOnlyLabel(m.past_due.grace_until)}.</>
                  : <> Booking is paused until it&apos;s paid.</>)}
                {' '}Check your email for a link to pay now.
              </div>
            )}

            {live(m) && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                {ending ? (
                  <button onClick={() => act(m, 'resume')} disabled={busy} style={linkBtn}>{busy ? 'Undoing…' : 'Undo cancel'}</button>
                ) : confirming ? (
                  <>
                    <span style={{ fontSize: '15px', color: 'var(--text-body)', flex: '1 1 220px' }}>
                      {m.status === 'pending'
                        ? 'Cancel before it starts? You’ll get a full refund.'
                        : m.status === 'past_due'
                          ? 'Cancel now? Your membership ends today.'
                          : `Cancel? You keep access until ${m.current_period_end ? dateOnlyLabel(m.current_period_end) : 'the end of this period'} and won’t be charged again.`}
                    </span>
                    <button onClick={() => act(m, 'cancel')} disabled={busy} style={{ ...linkBtn, color: 'var(--danger)' }}>{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
                    <button onClick={() => setConfirmId('')} disabled={busy} style={linkBtn}>Keep it</button>
                  </>
                ) : (
                  <button onClick={() => { setConfirmId(m.id); setError('') }} style={linkBtn}>Cancel membership</button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
