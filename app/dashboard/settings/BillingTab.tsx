'use client'

import { useCallback, useEffect, useState } from 'react'
import { PlatformCardForm } from '@/app/components/billing/PlatformCardForm'
import { CreditCard } from 'lucide-react'
import { formatShortDate } from '@/lib/dates'
import { planPrice } from '@/lib/billing'
import InvoiceList, { type PlatformInvoice } from '@/app/components/billing/InvoiceList'
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
  current_period_end: string | null // while a switch is pending: the date it takes effect
  pending_plan?: PlanKey | null // set when leaving Monthly/Annual: the plan that starts at current_period_end
  has_payment_method: boolean
  currency?: string | null
  gst_applies?: boolean // studio is in Australia: Monthly/Annual include GST, Pay as you go adds it
}

const STATUS: Record<BillingPlan['subscription_status'], { label: string; tone: ChipTone }> = {
  none: { label: 'No subscription', tone: 'neutral' },
  active: { label: 'Active', tone: 'primary' },
  past_due: { label: 'Payment overdue', tone: 'danger' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
  incomplete: { label: 'Awaiting first payment', tone: 'warn' },
}

const PLAN_NAME: Record<PlanKey, string> = { percentage: 'Pay as you go', monthly: 'Monthly', annual: 'Annual' }

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
  const [keeping, setKeeping] = useState(false)

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

  const loadInvoices = useCallback(async (): Promise<PlatformInvoice[] | null> => {
    const res = await fetch(`${api}/invoices`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 404) return [] // invoices endpoint not deployed yet
    return res.ok ? res.json() : null
  }, [api, token])

  const cur = (plan?.currency || currency).toUpperCase() // the API sends a lowercase ISO code ("aud")
  const priceOf = (p: PlanKey, pl: BillingPlan) => planPrice(p, pl, cur)

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

  // PUT …/plan. Leaving Monthly/Annual doesn't happen now: the API keeps the paid period running and
  // returns pending_plan + the date. Re-selecting the plan still being billed cancels that pending switch.
  const selectPlan = async (target: PlanKey): Promise<BillingPlan | string> => {
    try {
      const res = await fetch(`${api}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: target }),
      })
      const data = await res.json().catch(() => null)
      return res.ok ? data : (data?.error ?? 'Could not change your plan.')
    } catch {
      return 'Could not reach the server. Please try again.'
    }
  }

  const confirmSwitch = async () => {
    if (!switchTo) return
    setSwitching(true)
    setSwitchError('')
    const result = await selectPlan(switchTo)
    setSwitching(false)
    if (typeof result === 'string') { setSwitchError(result); return }
    setPlan(result)
    setSwitchTo(null)
    setNotice({
      ok: true,
      text: result.pending_plan && result.current_period_end
        ? `You'll move to ${PLAN_NAME[result.pending_plan]} on ${formatShortDate(result.current_period_end)}. You stay on ${PLAN_NAME[result.plan]} until then.`
        : `You're now on the ${PLAN_NAME[result.plan]} plan.`,
    })
  }

  const keepPlan = async () => {
    if (!plan) return
    setKeeping(true)
    setNotice(null)
    const result = await selectPlan(plan.plan)
    setKeeping(false)
    if (typeof result === 'string') { setNotice({ ok: false, text: result }); return }
    setPlan(result)
    setNotice({ ok: true, text: `You're staying on ${PLAN_NAME[result.plan]}. The switch has been cancelled.` })
  }

  if (loadError) return <div style={{ ...cardStyle, padding: '22px 24px', color: color.ink2, fontSize: 15 }}>{loadError}</div>
  if (!plan) return <div style={{ color: color.muted, padding: 24 }}>Loading…</div>

  const subscribed = plan.plan === 'monthly' || plan.plan === 'annual'
  const pending = plan.pending_plan && plan.pending_plan !== plan.plan ? plan.pending_plan : null
  const effectiveDate = plan.current_period_end ? formatShortDate(plan.current_period_end) : null
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
            {effectiveDate && <span style={tabularNums}>{pending ? `Ends ${effectiveDate}` : `Next billing date ${effectiveDate}`}</span>}
          </div>
        )}
        {pending && (
          <div role="status" style={{ ...alertStyle('warn'), display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>
              Switching to <strong>{PLAN_NAME[pending]}</strong>{effectiveDate ? <> on <strong style={tabularNums}>{effectiveDate}</strong></> : ' at the end of this period'}.
              You stay on {PLAN_NAME[plan.plan]} until then.
            </span>
            <Button size="sm" onClick={keepPlan} disabled={keeping}>{keeping ? 'Cancelling…' : `Keep ${PLAN_NAME[plan.plan]}`}</Button>
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
            Leaving Monthly or Annual takes effect at the end of the period you&apos;ve paid for, never part-way through it.
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
                  {pending === p && <Chip tone="warn">{effectiveDate ? `From ${effectiveDate}` : 'Pending'}</Chip>}
                </span>
                <span style={{ fontSize: 15, color: color.ink2, ...tabularNums }}>{priceOf(p, plan)}</span>
                {!current && pending !== p && (
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

      {/* Invoices */}
      <section aria-labelledby="bill-invoices" style={card}>
        <div>
          <h2 id="bill-invoices" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Invoices</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>
            {plan.gst_applies
              ? 'Tax invoices from Travel Engine (CalaStudio), showing GST, for your records and BAS.'
              : 'Invoices from Travel Engine (CalaStudio) for your records.'}
          </p>
        </div>
        <InvoiceList load={loadInvoices} />
      </section>

      {cardSecret && (
        <Modal title={plan.has_payment_method ? 'Replace your card' : 'Add a card'} onClose={() => setCardSecret(null)} width={480}>
          <PlatformCardForm
            clientSecret={cardSecret}
            onCancel={() => setCardSecret(null)}
            onSaved={() => { setCardSecret(null); setNotice({ ok: true, text: 'Card saved.' }); load() }}
          />
        </Modal>
      )}

      {switchTo && (
        <Modal title={`Switch to ${PLAN_NAME[switchTo]}?`} onClose={() => setSwitchTo(null)} width={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.formGap }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
              You&apos;ll move from <strong>{PLAN_NAME[plan.plan]}</strong> ({priceOf(plan.plan, plan)}) to{' '}
              <strong>{PLAN_NAME[switchTo]}</strong> ({priceOf(switchTo, plan)})
              {subscribed && effectiveDate
                ? <>. You stay on {PLAN_NAME[plan.plan]} until <strong style={tabularNums}>{effectiveDate}</strong>, the end of the period you&apos;ve paid for, and the switch happens then.</>
                : '.'}
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
