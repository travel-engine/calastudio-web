'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import StripePaymentForm from './StripePaymentForm'
import type { PassTemplate } from './PricingList'

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) }
  catch { return `${c} ${n.toFixed(2)}` }
}

type Phase = 'loading' | 'pay' | 'confirming' | 'done' | 'error'

// Standalone pass purchase — the same PaymentIntent → PaymentElement → poll-for-issuance flow the
// booking drawer runs, lifted out so it works from the Pricing page (and, later, the account page)
// without an occurrence in scope.
export default function PassPurchaseModal({
  template, orgId, token, studioSlug, stripeAccountId, currency, brandColor, onClose, onPurchased,
}: {
  template: PassTemplate
  orgId: string
  token: string
  studioSlug: string
  stripeAccountId: string
  currency: string
  brandColor: string
  onClose: () => void
  onPurchased: () => void
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const passIdsBefore = useRef<Set<string>>(new Set())
  const price = money(template.price, template.currency || currency)

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        const listRes = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (listRes.ok) {
          const list = await listRes.json()
          passIdsBefore.current = new Set(list.map((p: { id: string }) => p.id))
        }
        const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes/${template.id}/payment-intent`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) {
          setError(res.status === 404
            ? "You're not a member of this studio yet. Join from your account, then come back to buy a pass."
            : data?.error ?? 'Could not start the purchase. Please try again.')
          setPhase('error')
          return
        }
        setClientSecret(data.client_secret)
        setPhase('pay')
      } catch {
        if (!cancelled) { setError('Could not reach the server. Please try again.'); setPhase('error') }
      }
    }
    start()
    return () => { cancelled = true }
  }, [apiUrl, orgId, token, template.id])

  // The webhook issues the pass a beat after the charge confirms — poll briefly, then stop nagging.
  const pollForPass = async () => {
    setPhase('confirming')
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const list = await res.json()
        const fresh = list.find((p: { id: string; pass_template_id: string }) =>
          p.pass_template_id === template.id && !passIdsBefore.current.has(p.id))
        if (fresh) { setPhase('done'); return }
      }
    }
    setPhase('done') // charged and confirmed; issuance is just lagging
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{template.name}</div>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{price}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
        </div>

        {phase === 'loading' && <div style={{ padding: '24px', textAlign: 'center', color: '#666', fontSize: '14px' }}>Setting up…</div>}

        {phase === 'error' && (
          <div>
            <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px' }}>{error}</div>
            {error.startsWith("You're not a member") && (
              <Link
                href={`/${studioSlug}/account`}
                style={{ display: 'inline-block', marginTop: '14px', padding: '9px 18px', backgroundColor: brandColor, color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
              >
                Go to your account
              </Link>
            )}
          </div>
        )}

        {phase === 'pay' && clientSecret && (
          <StripePaymentForm
            clientSecret={clientSecret}
            stripeAccountId={stripeAccountId}
            submitLabel={`Pay ${price}`}
            accentColor={brandColor}
            onSuccess={pollForPass}
            onError={m => { setError(m); setPhase('error') }}
          />
        )}

        {phase === 'confirming' && <div style={{ padding: '24px', textAlign: 'center', color: '#666', fontSize: '14px' }}>Confirming your payment…</div>}

        {phase === 'done' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#085041' }}>Pass added to your account</div>
            <div style={{ fontSize: '13px', color: '#666', margin: '6px 0 16px' }}>You can use it next time you book.</div>
            <button
              onClick={onPurchased}
              style={{ padding: '9px 22px', backgroundColor: brandColor, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
