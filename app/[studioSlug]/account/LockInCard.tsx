'use client'

// The after-class "lock in the next one?" prompt (spec 07 §7.10.10), when the member taps the
// notification itself, or on iPhone, where notifications have no buttons. The link carries a token
// that names the class; the API decides whether it can still be booked and whether their own pass
// or membership covers it. Covered: "Book it" books it here. Not covered: it opens the usual booking
// drawer so they choose how to pay.

import { useEffect, useState } from 'react'
import { formatClock, formatDayLabel, formatShortDate } from '@/lib/dates'

type Info = {
  session_name: string
  starts_at: string
  location_name?: string | null
  occurrence_id: string
  bookable: boolean
  code?: string
  message?: string
  covered_by: 'pass' | 'membership' | null
  pass_name?: string | null
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'ask'; info: Info }
  | { kind: 'busy'; info: Info }
  | { kind: 'done'; text: string; ok: boolean }

export default function LockInCard({ apiUrl, token, brand, timeZone, onBooked, onOpenDrawer, onClose }: {
  apiUrl: string | undefined
  token: string
  brand: string
  timeZone: string | null
  /** A booking was made here: refresh Home. */
  onBooked: () => void
  /** Not covered by their pass or membership: open the booking drawer for this class. */
  onOpenDrawer: (occurrenceId: string) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const endpoint = `${apiUrl}/api/push/actions/lock-in`

  useEffect(() => {
    let cancelled = false
    fetch(`${endpoint}?token=${encodeURIComponent(token)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((info: Info | null) => {
        if (cancelled) return
        if (!info?.occurrence_id) { setPhase({ kind: 'gone' }); return }
        setPhase(info.bookable ? { kind: 'ask', info } : { kind: 'done', ok: false, text: info.message || 'That class can no longer be booked from here.' })
      })
      .catch(() => { if (!cancelled) setPhase({ kind: 'gone' }) })
    return () => { cancelled = true }
  }, [endpoint, token])

  if (phase.kind === 'loading' || phase.kind === 'gone') return null

  const when = (iso: string) => {
    const day = formatDayLabel(iso, timeZone)
    return `${day === 'Today' || day === 'Tomorrow' ? day : formatShortDate(iso, timeZone)} at ${formatClock(iso, timeZone)}`
  }

  const bookIt = async (info: Info) => {
    if (!info.covered_by) { onOpenDrawer(info.occurrence_id); onClose(); return }
    setPhase({ kind: 'busy', info })
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const data = await res.json().catch(() => null)
      if (data?.booked) {
        const paidWith = data.pass_name || data.membership_name
        setPhase({ kind: 'done', ok: true, text: `You're booked for ${info.session_name}, ${when(info.starts_at)}.${paidWith ? ` Used your ${paidWith}.` : ''}` })
        onBooked()
      } else if (data?.code === 'needs_payment') {
        onOpenDrawer(info.occurrence_id); onClose()
      } else {
        setPhase({ kind: 'done', ok: false, text: data?.message || "Couldn't book that class. Try it from the schedule below." })
      }
    } catch {
      setPhase({ kind: 'ask', info })
    }
  }

  const card: React.CSSProperties = { backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)', padding: '16px 18px' }
  const btn: React.CSSProperties = {
    border: 'none', borderRadius: '8px', padding: '0 18px', minHeight: '44px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '15px', fontWeight: 600, background: brand, color: '#fff',
  }
  const ghost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-strong)' }

  if (phase.kind === 'done') {
    return (
      <section style={card} role="status">
        <p style={{ margin: 0, fontSize: '15px', color: phase.ok ? 'var(--ink)' : 'var(--text-meta)' }}>{phase.ok ? '✓ ' : ''}{phase.text}</p>
        <button type="button" onClick={onClose} style={{ ...ghost, marginTop: '12px', minHeight: '40px' }}>Close</button>
      </section>
    )
  }

  const { info } = phase
  const busy = phase.kind === 'busy'
  return (
    <section style={card} aria-labelledby="lock-in-heading">
      <h2 id="lock-in-heading" style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>Lock in the next one?</h2>
      <p style={{ margin: '6px 0 0', fontSize: '15px', color: 'var(--text-meta)' }}>
        {info.session_name}, {when(info.starts_at)}{info.location_name ? ` · ${info.location_name}` : ''}
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
        <button type="button" style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void bookIt(info)}>
          {busy ? 'Booking…' : 'Book it'}
        </button>
        <button type="button" style={ghost} disabled={busy} onClick={onClose}>Not yet</button>
      </div>
    </section>
  )
}
