'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadStripe, type Appearance } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import styles from './photofirst.module.css'

function InnerForm({ submitLabel, onSuccess, onError }: {
  submitLabel: string
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
      <button onClick={handleSubmit} disabled={!stripe || submitting} className={styles.blockBtn} style={{ marginTop: '16px' }}>
        {submitting ? 'Processing…' : submitLabel}
      </button>
    </div>
  )
}

// Relative luminance (0 = black, 1 = white) of a CSS colour like "#f5f4f1" or "rgb(…)".
function luminance(css: string): number {
  const probe = document.createElement('span')
  probe.style.color = css
  document.body.appendChild(probe)
  const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
  probe.remove()
  const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Stripe can't read CSS variables, so take the studio theme's actual colours from the page and hand
// them to Stripe: the card form then matches the theme, light or dark.
function themeAppearance(el: HTMLElement): Appearance {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const ink = v('--ink', '#1b1a17')
  const dark = luminance(ink) > 0.5 // light text = dark theme
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: v('--accent', ink),
      colorBackground: v('--surface', dark ? '#1b1a17' : '#ffffff'),
      colorText: ink,
      colorDanger: v('--danger', '#a3352f'),
      fontSizeBase: '16px', // 16px stops iOS Safari zooming into the field
      borderRadius: '10px',
    },
  }
}

// Wraps Stripe Elements for a single PaymentIntent client_secret. The studio's connected account id
// must be passed to loadStripe — every PaymentIntent here is a direct charge on that account
// (StripePaymentClient.cs), so confirming it requires Stripe.js to be scoped to the same account.
// Colours follow the studio's theme (see themeAppearance).
export default function StripePaymentForm({ clientSecret, stripeAccountId, submitLabel, onSuccess, onError }: {
  clientSecret: string
  stripeAccountId: string
  submitLabel: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, { stripeAccount: stripeAccountId }),
    [stripeAccountId]
  )
  const ref = useRef<HTMLDivElement>(null)
  const [appearance, setAppearance] = useState<Appearance | null>(null)
  useEffect(() => { if (ref.current) setAppearance(themeAppearance(ref.current)) }, [])

  return (
    <div ref={ref}>
      {appearance && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <InnerForm submitLabel={submitLabel} onSuccess={onSuccess} onError={onError} />
        </Elements>
      )}
    </div>
  )
}
