'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { CreditCard } from 'lucide-react'
import { formatShortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Chip, Modal, alertStyle, cardStyle, type ChipTone } from '@/app/components/admin'

// What CalaStudio charges this studio for the platform (GET/PUT /organisations/{id}/billing/plan).
// Entirely separate from members paying the studio: this runs on CalaStudio's OWN Stripe account,
// so Stripe.js loads the platform key with no `stripeAccount` (contrast StripePaymentForm, which is
// scoped to the studio's connected account). The same publishable key serves both — direct charges
// on a connected account are made with the platform's key plus `stripeAccount`.

type PlanKey = 'percentage' | 'monthly' | 'annual'
interface BillingPlan {
  plan: PlanKey
  percentage_rate: number | null // fraction: 0.05 = 5%
  monthly_amount: number | null
  annual_amount: number | null
  subscription_status: 'none' | 'active' | 'past_due' | 'canceled' | 'incomplete'
  current_period_end: string | null
  has_payment_method: boolean
  currency?: string | null
}

const STATUS: Record<BillingPlan['subscription_status'], { label: string; tone: ChipTone }> = {
  none: { label: 'No subscription', tone: 'neutral' },
  active: { label: 'Active', tone: 'primary' },
  past_due: { label: 'Payment overdue', tone: 'danger' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
  incomplete: { label: 'Awaiting first payment', tone: 'warn' },
}

const PLAN_NAME: Record<PlanKey, string> = { percentage: 'Pay as you go', monthly: 'Monthly', annual: 'Annual' }

let platformStripe: ReturnType<typeof loadStripe> | null = null
const getPlatformStripe = () => (platformStripe ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!))

function CardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!stripe || !elements) return
    setBusy(true)
    setError('')
    const { error: err, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' })
    setBusy(false)
    if (err) { setError(err.message ?? 'Could not save this card.'); return }
    if (setupIntent?.status === 'succeeded' || setupIntent?.status === 'processing') onSaved()
    else setError('The card was not saved. Please try again.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div role="alert" style={alertStyle()}>{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={!stripe || busy}>{busy ? 'Saving…' : 'Save card'}</Button>
      </div>
    </div>
  )
}

export default function BillingTab({ orgId, token, currency }: { orgId: string; token: string; currency: string }) {
  const api = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/billing`
  const [plan, setPlan] = useState<BillingPlan | null>(null)
  const [loadError, setLoadError] = useState('')
  const [cardSecret, setCardSecret] = useState<string | null>(null)
  const [cardBusy, setCardBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [switchTo, setSwitchTo] = useState<PlanKey | null>(null)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${api}/plan`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setLoadError(res.status === 404 ? 'Plan & billing isn’t available yet.' : 'Could not load your plan.'); return }
      setPlan(await res.json())
      setLoadError('')
    } catch {
      setLoadError('Could not reach the server. Please try again.')
    }
  }, [api, token])

  useEffect(() => { load() }, [load])

  const cur = (plan?.currency || currency).toUpperCase() // the API sends a lowercase ISO code ("aud")
  const priceOf = (p: PlanKey, pl: BillingPlan) =>
    p === 'percentage' ? (pl.percentage_rate != null ? `${+(pl.percentage_rate * 100).toFixed(2)}% of each booking` : '—')
      : p === 'monthly' ? (pl.monthly_amount != null ? `${formatMoney(pl.monthly_amount, cur)} a month` : '—')
        : (pl.annual_amount != null ? `${formatMoney(pl.annual_amount, cur)} a year` : '—')

  const openCard = async () => {
    setCardBusy(true)
    setNotice(null)
    try {
      const res = await fetch(`${api}/setup-intent`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.client_secret) { setNotice({ ok: false, text: data?.error ?? 'Could not start adding a card.' }); return }
      setCardSecret(data.client_secret)
    } catch {
      setNotice({ ok: false, text: 'Could not reach the server. Please try again.' })
    } finally {
      setCardBusy(false)
    }
  }

  const confirmSwitch = async () => {
    if (!switchTo) return
    setSwitching(true)
    setSwitchError('')
    try {
      const res = await fetch(`${api}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: switchTo }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setSwitchError(data?.error ?? 'Could not change your plan.'); return }
      setPlan(data)
      setSwitchTo(null)
      setNotice({ ok: true, text: `You're now on the ${PLAN_NAME[switchTo]} plan. It takes effect from your next billing cycle.` })
    } catch {
      setSwitchError('Could not reach the server. Please try again.')
    } finally {
      setSwitching(false)
    }
  }

  const stripeOptions = useMemo(() => (cardSecret ? { clientSecret: cardSecret } : undefined), [cardSecret])

  if (loadError) return <div style={{ ...cardStyle, padding: '22px 24px', color: color.ink2, fontSize: 15 }}>{loadError}</div>
  if (!plan) return <div style={{ color: color.muted, padding: 24 }}>Loading…</div>

  const subscribed = plan.plan === 'monthly' || plan.plan === 'annual'
  const st = STATUS[plan.subscription_status] ?? STATUS.none
  const card: React.CSSProperties = { ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: space.formGap }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
      {notice && <div role={notice.ok ? 'status' : 'alert'} style={alertStyle(notice.ok ? 'ok' : 'danger')}>{notice.text}</div>}

      {/* Current plan */}
      <section aria-labelledby="bill-current" style={card}>
        <div>
          <h2 id="bill-current" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Your CalaStudio plan</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>
            What CalaStudio charges your studio. Separate from what your members pay you.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 14px' }}>
          <span style={{ fontSize: 26, fontWeight: 600 }}>{PLAN_NAME[plan.plan]}</span>
          <span style={{ fontSize: 16, color: color.ink2, ...tabularNums }}>{priceOf(plan.plan, plan)}</span>
        </div>
        {subscribed && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 15, color: color.ink2 }}>
            <Chip tone={st.tone}>{st.label}</Chip>
            {plan.current_period_end && <span style={tabularNums}>Next billing date {formatShortDate(plan.current_period_end)}</span>}
          </div>
        )}
        {plan.subscription_status === 'past_due' && (
          <div role="alert" style={alertStyle()}>Your last payment didn&apos;t go through. Update your card below to keep your plan.</div>
        )}
      </section>

      {/* Card */}
      <section aria-labelledby="bill-card" style={card}>
        <div>
          <h2 id="bill-card" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Payment card</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>
            Needed for the Monthly and Annual plans. Card details go straight to Stripe; CalaStudio never sees them.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, color: color.ink2 }}>
            <CreditCard size={20} strokeWidth={1.8} aria-hidden />
            {plan.has_payment_method ? 'A card is saved for your plan.' : 'No card saved yet.'}
          </span>
          <Button onClick={openCard} disabled={cardBusy}>{cardBusy ? 'Opening…' : plan.has_payment_method ? 'Replace card' : 'Add a card'}</Button>
        </div>
      </section>

      {/* Plans */}
      <section aria-labelledby="bill-plans" style={card}>
        <div>
          <h2 id="bill-plans" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Change plan</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>
            A change takes effect from your next billing cycle, never part-way through one.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
          {(['percentage', 'monthly', 'annual'] as PlanKey[]).map(p => {
            const current = plan.plan === p
            const needsCard = p !== 'percentage' && !plan.has_payment_method
            return (
              <div key={p} style={{
                border: `${current ? 2 : 1}px solid ${current ? color.primary : color.border}`, borderRadius: radius.card,
                padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: current ? '#F7FAF8' : color.surface,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 16, fontWeight: 600 }}>{PLAN_NAME[p]}</strong>
                  {current && <Chip tone="primary">Current</Chip>}
                </span>
                <span style={{ fontSize: 15, color: color.ink2, ...tabularNums }}>{priceOf(p, plan)}</span>
                {!current && (
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Button size="sm" onClick={() => { setSwitchError(''); setSwitchTo(p) }} disabled={needsCard}>Switch to {PLAN_NAME[p]}</Button>
                    {needsCard && <span style={{ fontSize: 13, color: color.muted }}>Add a card first.</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {cardSecret && stripeOptions && (
        <Modal title={plan.has_payment_method ? 'Replace your card' : 'Add a card'} onClose={() => setCardSecret(null)} width={480}>
          <Elements stripe={getPlatformStripe()} options={stripeOptions}>
            <CardForm
              onCancel={() => setCardSecret(null)}
              onSaved={() => { setCardSecret(null); setNotice({ ok: true, text: 'Card saved.' }); load() }}
            />
          </Elements>
        </Modal>
      )}

      {switchTo && (
        <Modal title={`Switch to ${PLAN_NAME[switchTo]}?`} onClose={() => setSwitchTo(null)} width={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
              You&apos;ll move from <strong>{PLAN_NAME[plan.plan]}</strong> ({priceOf(plan.plan, plan)}) to{' '}
              <strong>{PLAN_NAME[switchTo]}</strong> ({priceOf(switchTo, plan)}), starting from your next billing cycle.
            </p>
            {switchError && <div role="alert" style={alertStyle()}>{switchError}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Button onClick={() => setSwitchTo(null)} style={{ flex: '1 1 140px' }}>Keep my plan</Button>
              <Button variant="primary" onClick={confirmSwitch} disabled={switching} style={{ flex: '1 1 140px' }}>{switching ? 'Switching…' : `Switch to ${PLAN_NAME[switchTo]}`}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
