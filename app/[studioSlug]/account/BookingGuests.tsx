'use client'

import { useRef, useState } from 'react'
import StripePaymentForm from '../StripePaymentForm'
import { formatMoney } from '@/lib/money'

// Guests on one of my upcoming bookings (My bookings): add more, or remove one, without contacting
// the studio. A guest can be paid from any of the member's passes that's valid for the class; when
// none has credits, the member can buy one right here (card, Stripe) and the guest is added
// straight after. The API decides what's allowed and returns it on each booking; this only renders
// those choices. Spec 03 §3.7 "Changing guests after booking".

export interface GuestCancelOption { index: number; can_cancel: boolean; late: boolean; credits_returned: number }
export interface GuestPassOption { member_pass_id: string; name: string; credits_remaining: number | null; credits_per_guest: number; max_guests: number }
export interface GuestPassOffer { pass_template_id: string; name: string; price: number; currency: string; credits: number | null; credits_per_guest: number }

export interface GuestBooking {
  id: string
  guests?: string | null // JSON: [{ first_name, status, credits_used, member_pass_id }]
  can_add_guests?: boolean | null
  max_more_guests?: number | null
  credits_per_guest?: number | null
  add_guests_not_allowed_code?: string | null
  add_guests_not_allowed_reason?: string | null
  add_guests_needs_pass?: boolean | null
  guest_pass_options?: GuestPassOption[] | null
  guest_pass_offers?: GuestPassOffer[] | null
  guest_cancel_options?: GuestCancelOption[] | null
}

interface GuestEntry { first_name?: string | null; status?: string | null }

function parseGuests(json: string | null | undefined): GuestEntry[] {
  if (!json) return []
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : [] } catch { return [] }
}

const ERRORS: Record<string, string> = {
  guests_not_allowed: "Guests aren't allowed with that pass on this booking.",
  no_spots: "There aren't enough spots left in this class.",
  not_enough_credits: "Your pass doesn't have enough credits left for that many guests.",
  booking_closed: 'Booking has closed for this class.',
  pass_not_usable: "That pass can't be used for this class right now.",
  guest_details_required: 'The studio needs more details about your guests. Please contact the studio to add them.',
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : word.endsWith('s') ? `${word}es` : `${word}s`}`

type Mode = 'idle' | 'add' | 'buy' | 'issuing'

export default function BookingGuests<B extends GuestBooking>({ booking, memberName, api, studioSlug, brand, onUpdated }: {
  booking: B
  memberName: string
  api: (path: string, init?: RequestInit) => Promise<Response>
  studioSlug: string
  brand: string
  onUpdated: (updated: B) => void | Promise<void>
}) {
  const guests = parseGuests(booking.guests)
  const cancelOptions = booking.guest_cancel_options ?? []
  const passOptions = booking.guest_pass_options ?? []
  const offers = booking.guest_pass_offers ?? []
  const needsPass = !!booking.can_add_guests && !!booking.add_guests_needs_pass
  const canAdd = !!booking.can_add_guests && (needsPass ? offers.length > 0 : (booking.max_more_guests ?? 0) > 0)

  const [mode, setMode] = useState<Mode>('idle')
  const [count, setCount] = useState(1)
  const [passId, setPassId] = useState('')
  const [buying, setBuying] = useState<{ offer: GuestPassOffer; clientSecret: string; account: string } | null>(null)
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const passesBefore = useRef<Set<string>>(new Set())

  const active = guests.map((g, i) => ({ g, i })).filter(x => x.g.status !== 'cancelled')
  // Say why "Add a guest" is missing only when the member would expect it (class full, nothing left
  // to pay with); not for classes or passes that simply don't take guests.
  const whyNot = !booking.can_add_guests && (booking.add_guests_not_allowed_code === 'not_enough_credits' || booking.add_guests_not_allowed_code === 'no_spots')
    ? booking.add_guests_not_allowed_reason : null
  if (active.length === 0 && !canAdd && !whyNot) return null

  const label = (i: number) => `Guest ${i + 1}`
  const chosen = passOptions.find(p => p.member_pass_id === passId) ?? passOptions[0]
  const maxForChosen = Math.max(0, chosen?.max_guests ?? booking.max_more_guests ?? 0)
  const reset = () => { setError(''); setNotice('') }

  const postGuests = async (n: number, memberPassId?: string) => {
    const start = guests.length // numbered after every existing position, cancelled ones included
    const res = await api(`/members/me/bookings/${booking.id}/guests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: n,
        guests: Array.from({ length: n }, (_, k) => ({ first_name: `${memberName || 'Member'} - Guest ${start + k + 1}`, last_name: null, email: null })),
        ...(memberPassId ? { member_pass_id: memberPassId } : {}),
      }),
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, data }
  }

  const add = async () => {
    setBusy('add'); reset()
    try {
      const { ok, data } = await postGuests(count, chosen?.member_pass_id)
      if (!ok) { setError(ERRORS[data?.code] ?? data?.error ?? "Couldn't add your guest. Please try again."); return }
      setMode('idle'); setCount(1)
      const used = count * (chosen?.credits_per_guest ?? booking.credits_per_guest ?? 0)
      setNotice(`${count === 1 ? 'Guest' : `${count} guests`} added.${used ? ` ${plural(used, 'credit')} used from ${chosen ? `your ${chosen.name}` : 'your pass'}.` : ''}`)
      await onUpdated(data as B)
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally { setBusy('') }
  }

  const startBuy = async (offer: GuestPassOffer) => {
    setBusy(offer.pass_template_id); reset()
    try {
      const [orgRes, res, existing] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`),
        api(`/members/me/passes/${offer.pass_template_id}/payment-intent`, { method: 'POST' }),
        api('/members/me/passes').catch(() => null),
      ])
      const org = orgRes.ok ? await orgRes.json() : null
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.client_secret) { setError(data?.error ?? "Couldn't start the payment. Please try again."); return }
      if (!org?.stripe_account_id) { setError("Card payments aren't available right now. Please contact the studio."); return }
      // Remember the passes held now, so the one this payment issues can be told apart.
      if (existing?.ok) passesBefore.current = new Set((await existing.json()).map((p: { id: string }) => p.id))
      setBuying({ offer, clientSecret: data.client_secret, account: org.stripe_account_id })
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally { setBusy('') }
  }

  // After the card payment: wait for the webhook to issue the pass, then add the guest with it.
  const afterPayment = async (offer: GuestPassOffer) => {
    setMode('issuing'); setBuying(null); reset()
    for (let i = 0; i < 14; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const r = await api('/members/me/passes').catch(() => null)
      if (!r?.ok) continue
      const list: { id: string; pass_template_id: string; status: string }[] = await r.json()
      const fresh = list.find(p => p.pass_template_id === offer.pass_template_id && !passesBefore.current.has(p.id) && (p.status === 'active' || p.status === 'low'))
      if (!fresh) continue
      const { ok, data } = await postGuests(1, fresh.id)
      setMode('idle')
      if (!ok) { setError(`Your ${offer.name} is ready, but the guest couldn't be added: ${ERRORS[data?.code] ?? data?.error ?? 'please try again.'}`); await onUpdated(booking); return }
      setNotice(`Your ${offer.name} is ready and your guest is added.`)
      await onUpdated(data as B)
      return
    }
    setMode('idle')
    setNotice("Payment received. Your pass is still being set up; it'll appear in My passes shortly, then you can add your guest.")
  }

  const remove = async (i: number) => {
    setBusy('remove'); reset()
    try {
      const res = await api(`/members/me/bookings/${booking.id}/guests/${i}/cancel`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(ERRORS[data?.code] ?? (data?.code === 'guest_not_found' ? 'That guest has already been removed.' : data?.error) ?? "Couldn't remove your guest."); return }
      setConfirmIndex(null)
      const n = data?.credits_returned ?? 0
      setNotice(data?.late
        ? `${label(i)} removed. It was a late cancellation, so the credit wasn't returned.`
        : `${label(i)} removed.${n ? ` ${plural(n, 'credit')} returned to your pass.` : ''}`)
      if (data?.booking) await onUpdated(data.booking as B)
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally { setBusy('') }
  }

  const btn: React.CSSProperties = {
    minHeight: 44, padding: '0 14px', background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 8,
    fontSize: 14, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer',
  }
  const primary: React.CSSProperties = { ...btn, background: brand, borderColor: brand, color: 'white' }
  const select: React.CSSProperties = { minHeight: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 15, maxWidth: '100%' }
  const panel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'var(--surface-2, rgba(0,0,0,0.04))', borderRadius: 10 }
  const meta: React.CSSProperties = { fontSize: 13, color: 'var(--text-meta)' }

  return (
    <div style={{ flexBasis: '100%', borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {active.map(({ i }) => {
        const opt = cancelOptions.find(o => o.index === i)
        const confirming = confirmIndex === i
        return (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 15, color: 'var(--ink)' }}>{label(i)}</span>
            {opt?.can_cancel && !confirming && (
              <button type="button" style={btn} disabled={!!busy} onClick={() => { setConfirmIndex(i); reset() }}>Remove</button>
            )}
            {confirming && opt && (
              <div style={{ ...panel, flexBasis: '100%' }}>
                <span style={{ fontSize: 14, color: 'var(--ink)' }}>
                  {opt.late
                    ? `Remove ${label(i)}? It's too close to the class to get the credit back, so this is a late cancellation and the credit won't be returned.`
                    : `Remove ${label(i)}?${opt.credits_returned ? ` ${plural(opt.credits_returned, 'credit')} will go back to your pass.` : ''}`}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...btn, borderColor: 'var(--danger)', color: 'var(--danger)' }} disabled={!!busy} onClick={() => remove(i)}>
                    {busy === 'remove' ? 'Removing…' : 'Remove guest'}
                  </button>
                  <button type="button" style={btn} disabled={!!busy} onClick={() => setConfirmIndex(null)}>Keep</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {canAdd && mode === 'idle' && (
        <div>
          <button type="button" style={btn} onClick={() => { setMode(needsPass ? 'buy' : 'add'); setCount(1); setPassId(passOptions[0]?.member_pass_id ?? ''); reset() }}>
            + Add a guest
          </button>
        </div>
      )}

      {/* A pass that can pay: choose how many, and which pass if there's more than one. */}
      {mode === 'add' && (
        <div style={panel}>
          {passOptions.length > 1 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--ink)' }}>
              Pay with
              <select value={chosen?.member_pass_id ?? ''} onChange={e => { setPassId(e.target.value); setCount(1) }} style={select}>
                {passOptions.map(p => (
                  <option key={p.member_pass_id} value={p.member_pass_id}>
                    {p.name}{p.credits_remaining != null ? ` · ${p.credits_remaining} left` : ' · unlimited'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <label>
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Number of guests to add</span>
              <select value={count} onChange={e => setCount(Number(e.target.value))} style={select}>
                {Array.from({ length: Math.max(1, maxForChosen) }, (_, k) => k + 1).map(n => <option key={n} value={n}>{plural(n, 'guest')}</option>)}
              </select>
            </label>
            <button type="button" style={primary} disabled={!!busy || maxForChosen < 1} onClick={add}>{busy === 'add' ? 'Adding…' : 'Add'}</button>
            <button type="button" style={btn} disabled={!!busy} onClick={() => setMode('idle')}>Cancel</button>
          </div>
          {chosen && chosen.credits_per_guest > 0 && (
            <span style={meta}>{`Uses ${plural(count * chosen.credits_per_guest, 'credit')} from your ${chosen.name}.`}</span>
          )}
        </div>
      )}

      {/* No pass can pay: buy one here, then the guest is added with it. */}
      {mode === 'buy' && (
        <div style={panel}>
          <span style={{ fontSize: 14, color: 'var(--ink)' }}>
            Your passes don&rsquo;t have a credit left for a guest. Buy a pass to bring them:
          </span>
          {offers.map(o => {
            const open = buying?.offer.pass_template_id === o.pass_template_id
            return (
              <div key={o.pass_template_id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 15, color: 'var(--ink)' }}>
                    <strong style={{ fontWeight: 600 }}>{o.name}</strong>
                    <span style={{ display: 'block', ...meta }}>
                      {formatMoney(o.price, o.currency)} · {o.credits == null ? 'unlimited classes' : plural(o.credits, 'class')}
                      {o.credits_per_guest > 1 ? ` · a guest uses ${o.credits_per_guest} credits` : ''}
                    </span>
                  </span>
                  {!open && (
                    <button type="button" style={primary} disabled={!!busy || !!buying} onClick={() => startBuy(o)}>
                      {busy === o.pass_template_id ? 'Starting…' : 'Buy'}
                    </button>
                  )}
                </div>
                {open && buying && (
                  <StripePaymentForm key={buying.clientSecret} clientSecret={buying.clientSecret} stripeAccountId={buying.account}
                    submitLabel={`Pay ${formatMoney(o.price, o.currency)} and add guest`}
                    onSuccess={() => afterPayment(o)} onError={m => setError(m)} />
                )}
              </div>
            )
          })}
          <div>
            <button type="button" style={btn} disabled={!!busy} onClick={() => { setMode('idle'); setBuying(null) }}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'issuing' && <div role="status" style={{ fontSize: 14, color: 'var(--text-meta)' }}>Payment received. Setting up your pass and adding your guest…</div>}

      {whyNot && !notice && mode === 'idle' && <div style={{ fontSize: 14, color: 'var(--text-meta)' }}>{whyNot}</div>}
      {error && <div role="alert" style={{ fontSize: 14, color: 'var(--danger)' }}>{error}</div>}
      {notice && <div role="status" style={{ fontSize: 14, color: 'var(--text-meta)' }}>{notice}</div>}
    </div>
  )
}
