'use client'

import { useState } from 'react'

// Guests on one of my upcoming bookings (My bookings): add more, or remove one, without contacting
// the studio. The API decides what's allowed and returns it on each booking (can_add_guests,
// max_more_guests, credits_per_guest, guest_cancel_options), so this only renders those choices.
// Spec 03 §3.7 "Changing guests after booking".

export interface GuestCancelOption { index: number; can_cancel: boolean; late: boolean; credits_returned: number }

export interface GuestBooking {
  id: string
  guests?: string | null // JSON: [{ first_name, last_name, email, status, credits_used }]
  can_add_guests?: boolean | null
  max_more_guests?: number | null
  credits_per_guest?: number | null
  guest_cancel_options?: GuestCancelOption[] | null
}

interface GuestEntry { first_name?: string | null; status?: string | null }

function parseGuests(json: string | null | undefined): GuestEntry[] {
  if (!json) return []
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : [] } catch { return [] }
}

const ERRORS: Record<string, string> = {
  guests_not_allowed: "Guests aren't allowed on this booking.",
  no_spots: "There aren't enough spots left in this class.",
  not_enough_credits: "Your pass doesn't have enough credits left for that many guests.",
  booking_closed: 'Booking has closed for this class.',
  pass_not_usable: "The pass you booked with can't be used right now (it may be frozen or expired).",
  guest_details_required: 'The studio needs more details about your guests. Please contact the studio to add them.',
}

export default function BookingGuests<B extends GuestBooking>({ booking, memberName, api, brand, onUpdated }: {
  booking: B
  memberName: string
  api: (path: string, init?: RequestInit) => Promise<Response>
  brand: string
  onUpdated: (updated: B) => void | Promise<void>
}) {
  const guests = parseGuests(booking.guests)
  const options = booking.guest_cancel_options ?? []
  const maxMore = booking.can_add_guests ? Math.max(0, booking.max_more_guests ?? 0) : 0
  const [adding, setAdding] = useState(false)
  const [count, setCount] = useState(1)
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const active = guests.map((g, i) => ({ g, i })).filter(x => x.g.status !== 'cancelled')
  if (active.length === 0 && maxMore === 0) return null

  const label = (i: number) => `Guest ${i + 1}`
  const perGuest = booking.credits_per_guest ?? 0

  const add = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      // The roster labels guests "<member> - Guest N", numbered after every existing position.
      const start = guests.length
      const res = await api(`/members/me/bookings/${booking.id}/guests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          guests: Array.from({ length: count }, (_, k) => ({ first_name: `${memberName || 'Member'} - Guest ${start + k + 1}`, last_name: null, email: null })),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(ERRORS[data?.code] ?? data?.error ?? "Couldn't add your guest. Please try again."); return }
      setAdding(false); setCount(1)
      setNotice(`${count === 1 ? 'Guest' : `${count} guests`} added.${perGuest ? ` ${count * perGuest} credit${count * perGuest === 1 ? '' : 's'} used from your pass.` : ''}`)
      onUpdated(data as B)
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally { setBusy(false) }
  }

  const remove = async (i: number) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await api(`/members/me/bookings/${booking.id}/guests/${i}/cancel`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(ERRORS[data?.code] ?? (data?.code === 'guest_not_found' ? 'That guest has already been removed.' : data?.error) ?? "Couldn't remove your guest."); return }
      setConfirmIndex(null)
      const n = data?.credits_returned ?? 0
      setNotice(data?.late
        ? `${label(i)} removed. It was a late cancellation, so the credit wasn't returned.`
        : `${label(i)} removed.${n ? ` ${n} credit${n === 1 ? '' : 's'} returned to your pass.` : ''}`)
      if (data?.booking) onUpdated(data.booking as B)
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally { setBusy(false) }
  }

  const btn: React.CSSProperties = {
    minHeight: 44, padding: '0 14px', background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 8,
    fontSize: 14, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer',
  }
  const primary: React.CSSProperties = { ...btn, background: brand, borderColor: brand, color: 'white' }

  return (
    <div style={{ flexBasis: '100%', borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {active.map(({ i }) => {
        const opt = options.find(o => o.index === i)
        const confirming = confirmIndex === i
        return (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 15, color: 'var(--ink)' }}>{label(i)}</span>
            {opt?.can_cancel && !confirming && (
              <button type="button" style={btn} disabled={busy} onClick={() => { setConfirmIndex(i); setError(''); setNotice('') }}>Remove</button>
            )}
            {confirming && opt && (
              <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--surface-2, rgba(0,0,0,0.04))', borderRadius: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--ink)' }}>
                  {opt.late
                    ? `Remove ${label(i)}? It's too close to the class to get the credit back, so this is a late cancellation and the credit won't be returned.`
                    : `Remove ${label(i)}?${opt.credits_returned ? ` ${opt.credits_returned} credit${opt.credits_returned === 1 ? '' : 's'} will go back to your pass.` : ''}`}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...btn, borderColor: 'var(--danger)', color: 'var(--danger)' }} disabled={busy} onClick={() => remove(i)}>
                    {busy ? 'Removing…' : 'Remove guest'}
                  </button>
                  <button type="button" style={btn} disabled={busy} onClick={() => setConfirmIndex(null)}>Keep</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {maxMore > 0 && !adding && (
        <div>
          <button type="button" style={btn} onClick={() => { setAdding(true); setCount(1); setError(''); setNotice('') }}>+ Add a guest</button>
        </div>
      )}
      {maxMore > 0 && adding && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, color: 'var(--text-meta)' }}>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Number of guests to add</span>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              style={{ minHeight: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 15 }}>
              {Array.from({ length: maxMore }, (_, k) => k + 1).map(n => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
            </select>
          </label>
          <button type="button" style={primary} disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add'}</button>
          <button type="button" style={btn} disabled={busy} onClick={() => setAdding(false)}>Cancel</button>
          {perGuest > 0 && (
            <span style={{ flexBasis: '100%', fontSize: 13, color: 'var(--text-meta)' }}>
              Uses {count * perGuest} credit{count * perGuest === 1 ? '' : 's'} from the pass you booked with.
            </span>
          )}
        </div>
      )}

      {error && <div role="alert" style={{ fontSize: 14, color: 'var(--danger)' }}>{error}</div>}
      {notice && <div role="status" style={{ fontSize: 14, color: 'var(--text-meta)' }}>{notice}</div>}
    </div>
  )
}
