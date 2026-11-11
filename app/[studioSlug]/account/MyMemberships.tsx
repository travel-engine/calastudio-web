'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { studioPath } from '@/lib/seo'
import {
  HOLD_NOT_ALLOWED, MEMBERSHIP_STATUS, dateOnlyLabel, periodUnit,
  type CancelPreview, type HoldOptions, type MyMembership,
} from '@/lib/memberships'
import StripePaymentForm from '../StripePaymentForm'

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
const panel: React.CSSProperties = {
  marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px',
  fontSize: '15px', lineHeight: 1.5, color: 'var(--text-body)',
}
const solidBtn: React.CSSProperties = {
  font: 'inherit', fontSize: '15px', fontWeight: 600, padding: '10px 18px', borderRadius: '99px', border: 0, cursor: 'pointer',
  backgroundColor: 'var(--ink)', color: 'var(--surface)', alignSelf: 'flex-start',
}
const errorBox: React.CSSProperties = { padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: '8px', color: 'var(--danger)', fontSize: '15px' }

function Badge({ m }: { m: MyMembership }) {
  const s = MEMBERSHIP_STATUS[m.status]
  if (!s) return null
  const bad = m.status === 'past_due'
  const mute = m.status === 'cancelled' || m.status === 'expired'
  const warn = m.status === 'capped' || m.status === 'pending' || m.status === 'on_hold'
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px', border: '1px solid var(--line-chip)', whiteSpace: 'nowrap',
      fontSize: '14px', fontWeight: 600,
      backgroundColor: bad ? 'var(--danger-bg)' : mute ? 'transparent' : warn ? 'var(--warn-bg)' : 'var(--ok-bg)',
      color: bad ? 'var(--danger)' : mute ? 'var(--text-label)' : warn ? 'var(--text-warn)' : 'var(--ink)',
    }}>
      {s.label}
    </span>
  )
}

type Api = (path: string, init?: RequestInit) => Promise<Response>

// My memberships (API PRs #73, #79, #80): the member's memberships, newest first, with hold,
// cancel (showing any notice charge first) and undo. Everything shown comes from the API as-is.
export default function MyMemberships({ apiBase, token, onLoaded }: {
  apiBase: string // …/api/organisations/{orgId}
  token: string
  onLoaded?: (count: number) => void
}) {
  const studioSlug = useParams().studioSlug as string
  const [items, setItems] = useState<MyMembership[] | null>(null)
  const [openPanel, setOpenPanel] = useState<{ id: string; kind: 'cancel' | 'hold' } | null>(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const api: Api = useCallback((path, init) =>
    fetch(`${apiBase}/members/me/memberships${path}`, {
      ...init, headers: { ...(init?.headers ?? {}), 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }), [apiBase, token])

  const load = useCallback(async () => {
    try {
      const res = await api('')
      const list: MyMembership[] = res.ok ? await res.json() : []
      setItems(list)
      onLoaded?.(list.length)
      return list
    } catch {
      setItems([])
      return []
    }
  }, [api, onLoaded])

  useEffect(() => { load() }, [load])

  const replace = (next: MyMembership) => {
    setItems(prev => prev?.map(x => (x.id === next.id ? next : x)) ?? prev)
    setOpenPanel(null)
  }

  const simple = async (m: MyMembership, path: string) => {
    setBusyId(m.id)
    setError('')
    try {
      const res = await api(`/${m.id}/${path}`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? 'Something went wrong. Please try again.'); return }
      replace(data)
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
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {items.map(m => {
        const unit = periodUnit(m.period_type, m.period_rolling_value)
        const ending = !!m.cancel_at && live(m)
        const busy = busyId === m.id
        const panelKind = openPanel?.id === m.id ? openPanel.kind : null
        const canHold = !!m.hold_allowance && !m.hold && !ending && (m.status === 'active' || m.status === 'capped')
        return (
          <div key={m.id} style={{ ...card, opacity: live(m) ? 1 : 0.75 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', color: 'var(--text-meta)', marginBottom: '4px' }}>
                  {m.name}{m.is_comp ? ' · complimentary' : ''}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>
                  {m.status === 'on_hold'
                    ? 'On hold'
                    : m.sessions_left_this_period == null
                      ? 'Unlimited sessions'
                      : `${m.sessions_left_this_period} of ${m.session_cap} session${m.session_cap === 1 ? '' : 's'} left${unit ? ` this ${unit.includes(' ') ? 'period' : unit}` : ''}`}
                </div>

                {m.status === 'pending' && <div style={meta}>Starts {dateOnlyLabel(m.started_on)}</div>}
                {live(m) && m.status !== 'pending' && m.status !== 'on_hold' && m.current_period_end && !ending && (
                  <div style={meta}>Current period ends {dateOnlyLabel(m.current_period_end)}</div>
                )}
                {m.hold && (
                  <div style={{ ...meta, color: 'var(--text-warn)', fontWeight: 600 }}>
                    {m.hold.status === 'active' ? 'On hold until' : `On hold from ${dateOnlyLabel(m.hold.start_date)} to`} {dateOnlyLabel(m.hold.end_date)}
                    {m.hold.fee_per_period > 0 && <span style={{ fontWeight: 400 }}> · {money(m.hold.fee_per_period, m.currency)} a {unit ?? 'period'}</span>}
                  </div>
                )}
                {ending && <div style={{ ...meta, color: 'var(--text-warn)', fontWeight: 600 }}>Ends {dateOnlyLabel(m.cancel_at!)}</div>}
                {m.next_charge_on && !m.is_comp && m.status !== 'past_due' && !ending && (
                  <div style={meta}>
                    Next payment on {dateOnlyLabel(m.next_charge_on)}
                    {m.card && <> · {m.card.brand} ••{m.card.last4}</>}
                  </div>
                )}
                {m.scheduled_price && live(m) && !ending && (
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
                <div style={{ marginTop: '10px' }}>
                  <Link
                    href={studioPath(studioSlug, `/account/memberships/${m.id}/pay`)}
                    style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '99px', backgroundColor: 'var(--danger)', color: '#fff', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Pay now
                  </Link>
                </div>
              </div>
            )}

            {panelKind === 'hold' ? (
              <HoldPanel m={m} api={api} onClose={() => setOpenPanel(null)} onDone={replace} />
            ) : panelKind === 'cancel' ? (
              <CancelPanel m={m} api={api} apiBase={apiBase} studioSlug={studioSlug} reload={load}
                onClose={() => setOpenPanel(null)} onDone={replace} />
            ) : live(m) && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center' }}>
                {ending ? (
                  <button onClick={() => simple(m, 'resume')} disabled={busy} style={linkBtn}>{busy ? 'Undoing…' : 'Undo cancel'}</button>
                ) : (
                  <>
                    {canHold && <button onClick={() => { setOpenPanel({ id: m.id, kind: 'hold' }); setError('') }} style={linkBtn}>Put on hold</button>}
                    {m.hold && (
                      <button onClick={() => simple(m, 'hold/end')} disabled={busy} style={linkBtn}>
                        {busy ? 'Saving…' : m.hold.status === 'active' ? 'End hold early' : 'Remove hold'}
                      </button>
                    )}
                    <button onClick={() => { setOpenPanel({ id: m.id, kind: 'cancel' }); setError('') }} style={linkBtn}>Cancel membership</button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HoldPanel({ m, api, onClose, onDone }: { m: MyMembership; api: Api; onClose: () => void; onDone: (m: MyMembership) => void }) {
  const [periods, setPeriods] = useState(1)
  const [opts, setOpts] = useState<HoldOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setOpts(null)
    api(`/${m.id}/hold-options?periods=${periods}`)
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (!active) return
        if (res.ok) setOpts(data)
        else setError(data?.error ?? 'Could not load hold options.')
      })
      .catch(() => { if (active) setError('Could not reach the server. Please try again.') })
    return () => { active = false }
  }, [api, m.id, periods])

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api(`/${m.id}/hold`, { method: 'POST', body: JSON.stringify({ periods }) })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? 'Could not put your membership on hold.'); return }
      onDone(data)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const label = opts?.period_label ?? 'week'
  const max = opts ? Math.max(1, opts.periods_left_this_year) : 1

  return (
    <div style={panel}>
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {!opts ? (!error && <div>Loading…</div>) : !opts.allowed ? (
        <div>{HOLD_NOT_ALLOWED[opts.not_allowed_reason ?? ''] ?? 'This membership can’t be put on hold right now.'}</div>
      ) : (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>How long?</span>
            <select value={periods} onChange={e => setPeriods(Number(e.target.value))}
              style={{ font: 'inherit', fontSize: '15px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)' }}>
              {Array.from({ length: max }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {label}{n === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <div>
            {opts.ends_on && <>On hold {dateOnlyLabel(opts.starts_on)} to {dateOnlyLabel(opts.ends_on)}.</>}
            {opts.resumes_on && <> Your membership starts again on {dateOnlyLabel(opts.resumes_on)}.</>}
            {' '}{opts.fee_per_period > 0
              ? <>The hold costs {money(opts.fee_per_period, opts.currency)} a {label} ({money(opts.fee_per_period * periods, opts.currency)} in total), charged instead of your usual payment.</>
              : <>You won&apos;t be charged while it&apos;s on hold.</>}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-meta)' }}>
            You have {opts.periods_left_this_year} {label}{opts.periods_left_this_year === 1 ? '' : 's'} of hold left until {dateOnlyLabel(opts.membership_year_end)}.
          </div>
          {opts.bookings_to_cancel && opts.bookings_to_cancel.length > 0 && (
            <div>
              These bookings will be cancelled:
              <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                {opts.bookings_to_cancel.map(b => <li key={b.booking_id}>{b.session_name}, {dateOnlyLabel(b.starts_at)}</li>)}
              </ul>
            </div>
          )}
          <button onClick={confirm} disabled={busy} style={solidBtn}>{busy ? 'Saving…' : `Put on hold for ${periods} ${label}${periods === 1 ? '' : 's'}`}</button>
        </>
      )}
      <button onClick={onClose} disabled={busy} style={{ ...linkBtn, alignSelf: 'flex-start' }}>Not now</button>
    </div>
  )
}

function CancelPanel({ m, api, apiBase, studioSlug, reload, onClose, onDone }: {
  m: MyMembership
  api: Api
  apiBase: string
  studioSlug: string
  reload: () => Promise<MyMembership[]>
  onClose: () => void
  onDone: (m: MyMembership) => void
}) {
  const [preview, setPreview] = useState<CancelPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // A declined card or 3-D Secure on the notice charge: pay it here, then poll until the cancel lands.
  const [payment, setPayment] = useState<{ client_secret: string; amount: number; currency: string; stripeAccountId: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    api(`/${m.id}/cancel-preview`)
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (res.ok) setPreview(data)
        else setError(data?.error ?? 'Could not load the cancellation details.')
      })
      .catch(() => setError('Could not reach the server. Please try again.'))
  }, [api, m.id])

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api(`/${m.id}/cancel`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (res.status === 202 && data?.payment_required) {
        const orgRes = await fetch(`${apiBase.split('/api/')[0]}/api/public/${studioSlug}`)
        const org = orgRes.ok ? await orgRes.json() : null
        if (!org?.stripe_account_id) { setError("This studio can't take card payments right now."); return }
        setPayment({ client_secret: data.client_secret, amount: data.amount, currency: data.currency, stripeAccountId: org.stripe_account_id })
        return
      }
      if (!res.ok) { setError(data?.error ?? 'Could not cancel your membership.'); return }
      onDone(data)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const pollUntilCancelled = async () => {
    setConfirming(true)
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const list = await reload()
      const next = list.find(x => x.id === m.id)
      if (next?.cancel_at || next?.status === 'cancelled') { onDone(next); return }
    }
    setConfirming(false)
    setPayment(null)
    setError('Payment received. Your cancellation should show here in a few minutes.')
  }

  const unit = periodUnit(m.period_type, m.period_rolling_value) ?? 'period'
  const p = preview

  return (
    <div style={panel}>
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {confirming ? <div>Confirming your payment…</div> : payment ? (
        <>
          <div>Your saved card couldn&apos;t be charged for the notice. Pay {money(payment.amount, payment.currency)} to finish cancelling.</div>
          <StripePaymentForm clientSecret={payment.client_secret} stripeAccountId={payment.stripeAccountId}
            submitLabel={`Pay ${money(payment.amount, payment.currency)}`}
            onSuccess={pollUntilCancelled} onError={msg => { setError(msg); setPayment(null) }} />
        </>
      ) : !p ? (!error && <div>Loading…</div>) : p.mode === 'not_possible' ? (
        <div>This membership can&apos;t be cancelled from here. Please contact the studio.</div>
      ) : (
        <>
          <div>
            {p.mode === 'notice' && <>
              Cancelling charges <strong>{money(p.notice_amount, p.currency)}</strong> now for {p.notice_periods} {unit}{p.notice_periods === 1 ? '' : 's'}&apos; notice
              {p.access_until && <>; you keep access until <strong>{dateOnlyLabel(p.access_until)}</strong></>}. No more payments after that.
              {m.hold?.status === 'active' && <> Your hold ends after the current {unit}.</>}
              {m.hold?.status === 'scheduled' && <> Your planned hold will be removed.</>}
            </>}
            {p.mode === 'period_end' && <>You keep access until {p.access_until ? dateOnlyLabel(p.access_until) : 'the end of this period'} and won&apos;t be charged again.</>}
            {p.mode === 'refund_now' && <>Your membership hasn&apos;t started, so it&apos;s cancelled now with a full refund{p.refund_amount > 0 ? <> of {money(p.refund_amount, p.currency)}</> : null}.</>}
            {p.mode === 'end_now' && <>Your membership ends today.</>}
          </div>
          <button onClick={confirm} disabled={busy} style={{ ...solidBtn, backgroundColor: 'var(--danger)', color: '#fff' }}>
            {busy ? 'Cancelling…' : p.mode === 'notice' ? `Cancel and pay ${money(p.notice_amount, p.currency)}` : 'Yes, cancel'}
          </button>
        </>
      )}
      {!confirming && <button onClick={onClose} disabled={busy} style={{ ...linkBtn, alignSelf: 'flex-start' }}>Keep it</button>}
    </div>
  )
}
