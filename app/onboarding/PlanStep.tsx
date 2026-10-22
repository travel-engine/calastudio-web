'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { planPrice } from '@/lib/billing'
import { PlatformCardForm } from '@/app/components/billing/PlatformCardForm'

// Onboarding: choose what CalaStudio charges the new studio. Runs right after the studio is
// created (the plan endpoints need it to exist) and uses the same endpoints as Settings → Plan &
// billing. Pay as you go needs nothing; Monthly/Annual collect a card on CalaStudio's own Stripe
// account first. The API decides what's allowed — this screen only offers and reports.

type PlanKey = 'percentage' | 'monthly' | 'annual'
interface BillingPlan {
  plan: PlanKey
  percentage_rate: number | null
  monthly_amount: number | null
  annual_amount: number | null
  has_payment_method: boolean
  currency?: string | null
  gst_applies?: boolean
}

const NAME: Record<PlanKey, string> = { percentage: 'Pay as you go', monthly: 'Monthly', annual: 'Annual' }
const BLURB: Record<PlanKey, string> = {
  percentage: 'No fixed fee. CalaStudio takes a small share of each booking.',
  monthly: 'One flat fee each month, whatever you take.',
  annual: 'One flat fee a year — the best value if you run classes all year.',
}

export default function PlanStep({ orgId, currency, onDone }: {
  orgId: string
  currency: string
  onDone: (note?: string) => void
}) {
  const api = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/billing`
  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [choice, setChoice] = useState<PlanKey>('percentage')
  const [cardSecret, setCardSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const token = async () => (await createClient().auth.getSession()).data.session?.access_token ?? ''

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${api}/plan`, { headers: { Authorization: `Bearer ${await token()}` } })
        if (!res.ok) { setUnavailable(true); return }
        const p: BillingPlan = await res.json()
        setPlan(p)
        setChoice(p.plan)
      } catch {
        setUnavailable(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const cur = (plan?.currency || currency).toUpperCase()
  const price = (p: PlanKey) => !plan ? '' : planPrice(p, plan, cur).replace(/^—$/, '')

  const switchPlan = async () => {
    const res = await fetch(`${api}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ plan: choice }),
    })
    if (res.ok) { onDone(`You're on the ${NAME[choice]} plan. You can change it any time in Settings → Plan & billing.`); return }
    const data = await res.json().catch(() => null)
    // The card can take a moment to register with the API after Stripe confirms it.
    onDone(`Your card is saved, but your plan couldn't switch to ${NAME[choice]} yet${data?.error ? ` (${data.error})` : ''}. Finish it in Settings → Plan & billing.`)
  }

  const next = async () => {
    setError('')
    if (!plan || choice === plan.plan) { onDone(); return }
    setBusy(true)
    try {
      if (choice !== 'percentage' && !plan.has_payment_method) {
        const res = await fetch(`${api}/setup-intent`, { method: 'POST', headers: { Authorization: `Bearer ${await token()}` } })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.client_secret) { setError(data?.error ?? 'Could not start adding a card. You can choose your plan later in Settings.'); return }
        setCardSecret(data.client_secret)
        return
      }
      await switchPlan()
    } catch {
      setError('Could not reach the server. You can choose your plan later in Settings.')
    } finally {
      setBusy(false)
    }
  }

  const heading = (
    <>
      <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>Choose your CalaStudio plan</h2>
      <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
        What CalaStudio charges your studio. You can change it any time; changes apply from your next billing cycle.
      </p>
    </>
  )

  if (unavailable) {
    return (
      <div>
        {heading}
        <p style={{ fontSize: '14px', color: '#444', marginBottom: '24px' }}>You&apos;re starting on Pay as you go. You can choose a plan later in Settings → Plan &amp; billing.</p>
        <button onClick={() => onDone()} style={primaryBtn}>Continue &#8594;</button>
      </div>
    )
  }
  if (!plan) return <div style={{ color: '#666', padding: '24px 0' }}>Loading plans…</div>

  if (cardSecret) {
    return (
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>Add a card for the {NAME[choice]} plan</h2>
        <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
          {price(choice)}. Card details go straight to Stripe; CalaStudio never sees them.
        </p>
        <PlatformCardForm
          clientSecret={cardSecret}
          onCancel={() => { setCardSecret(null); setChoice('percentage') }}
          onSaved={async () => { setBusy(true); try { await switchPlan() } finally { setBusy(false) } }}
        />
        {busy && <p style={{ fontSize: '13px', color: '#666', marginTop: '12px' }}>Switching your plan…</p>}
      </div>
    )
  }

  return (
    <div>
      {heading}
      <div role="radiogroup" aria-label="CalaStudio plan" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {(['percentage', 'monthly', 'annual'] as PlanKey[]).map(p => {
          const on = choice === p
          return (
            <label key={p} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 16px', cursor: 'pointer',
              border: `2px solid ${on ? '#085041' : '#e2e2e2'}`, borderRadius: '10px', background: on ? '#f2f8f5' : 'white',
            }}>
              <input type="radio" name="plan" checked={on} onChange={() => setChoice(p)} style={{ marginTop: '3px', accentColor: '#085041' }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '15px' }}>{NAME[p]}</strong>
                  <span style={{ fontSize: '14px', color: '#085041', fontWeight: 600 }}>{price(p)}</span>
                </span>
                <span style={{ display: 'block', fontSize: '13px', color: '#666', marginTop: '3px' }}>
                  {BLURB[p]}{p !== 'percentage' && !plan.has_payment_method ? ' Needs a card.' : ''}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      {error && <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
      <button onClick={next} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
        {busy ? 'One moment…' : choice !== 'percentage' && !plan.has_payment_method ? 'Add a card →' : 'Continue →'}
      </button>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px', backgroundColor: '#085041', color: 'white', border: 'none',
  borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
}
