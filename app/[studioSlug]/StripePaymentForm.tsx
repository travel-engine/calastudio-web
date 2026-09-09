'use client'

import { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

function InnerForm({ submitLabel, accentColor, dark, onSuccess, onError }: {
  submitLabel: string
  accentColor: string
  dark: boolean
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
          marginTop: '16px', width: '100%', padding: dark ? '15px' : '12px',
          backgroundColor: submitting ? (dark ? 'rgba(245,244,241,0.55)' : '#9fd6b8') : accentColor,
          color: dark ? '#0e0e0d' : 'white', border: 'none', borderRadius: dark ? '999px' : '8px',
          fontSize: dark ? '15px' : '14px', fontWeight: dark ? 700 : 600,
          cursor: submitting ? 'default' : 'pointer',
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
// `dark` switches the Stripe Element + submit button to the Photo First palette.
export default function StripePaymentForm({ clientSecret, stripeAccountId, submitLabel, accentColor, dark = false, onSuccess, onError }: {
  clientSecret: string
  stripeAccountId: string
  submitLabel: string
  accentColor?: string
  dark?: boolean
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, { stripeAccount: stripeAccountId }),
    [stripeAccountId]
  )

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: dark ? { theme: 'night', variables: { colorPrimary: '#f5f4f1' } } : undefined }}
    >
      <InnerForm
        submitLabel={submitLabel}
        accentColor={accentColor || (dark ? '#f5f4f1' : '#085041')}
        dark={dark}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  )
}
