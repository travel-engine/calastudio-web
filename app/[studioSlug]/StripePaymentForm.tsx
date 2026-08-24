'use client'

import { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

function InnerForm({ submitLabel, accentColor, onSuccess, onError }: {
  submitLabel: string
  accentColor: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    setSubmitting(false)

    if (error) { onError(error.message ?? 'Payment failed. Please try again.'); return }
    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      onSuccess()
    } else {
      onError('Payment was not completed. Please try again.')
    }
  }

  return (
    <div>
      <PaymentElement />
      <button
        onClick={handleSubmit}
        disabled={!stripe || submitting}
        style={{
          marginTop: '16px', width: '100%', padding: '12px', backgroundColor: submitting ? '#9fd6b8' : accentColor,
          color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
          cursor: submitting ? 'default' : 'pointer'
        }}
      >
        {submitting ? 'Processing...' : submitLabel}
      </button>
    </div>
  )
}

// Wraps Stripe Elements for a single PaymentIntent client_secret. The studio's connected account id
// must be passed to loadStripe — every PaymentIntent here is a direct charge on that account
// (StripePaymentClient.cs), so confirming it requires Stripe.js to be scoped to the same account.
export default function StripePaymentForm({ clientSecret, stripeAccountId, submitLabel, accentColor, onSuccess, onError }: {
  clientSecret: string
  stripeAccountId: string
  submitLabel: string
  accentColor?: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, { stripeAccount: stripeAccountId }),
    [stripeAccountId]
  )

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <InnerForm submitLabel={submitLabel} accentColor={accentColor || '#085041'} onSuccess={onSuccess} onError={onError} />
    </Elements>
  )
}
