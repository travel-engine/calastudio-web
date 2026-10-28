'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { space } from '@/lib/ui/tokens'
import { Button, alertStyle } from '@/app/components/admin'

// Card capture for what CalaStudio charges a studio (a SetupIntent on CalaStudio's OWN Stripe
// account). Stripe.js loads the platform key with no `stripeAccount` — the opposite of the member
// payment form, which is scoped to the studio's connected account. Used by Settings → Plan &
// billing and by onboarding's plan step.

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


/** Wraps the card form in Elements for one SetupIntent client_secret. */
export function PlatformCardForm({ clientSecret, onSaved, onCancel }: { clientSecret: string; onSaved: () => void; onCancel: () => void }) {
  return (
    <Elements stripe={getPlatformStripe()} options={{ clientSecret }}>
      <CardForm onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  )
}
