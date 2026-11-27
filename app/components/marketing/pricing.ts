// CalaStudio's own plans as advertised on the homepage. The API owns the real rates (Settings →
// Plan & billing shows each studio what it actually pays); keep these in step with the backend's
// configuration. Monthly/Annual include GST; Pay as you go is a share of each booking (the full
// amount), with GST on top. Stripe's own fee is separate.

export const PRICING = {
  currency: 'AUD',
  percentage: 1,
  monthly: 46,
  annual: 500,
} as const

export const aud = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

export const annualSaving = () => PRICING.monthly * 12 - PRICING.annual

// Worked example for Pay as you go: a $20 sale, CalaStudio's share of it plus GST on that share,
// and Stripe's standard Australian card fee (1.7% + 30c) alongside.
export function paygExample() {
  const sale = 20
  const stripeFee = Math.round((sale * 0.017 + 0.3) * 100) / 100
  const fee = Math.round(sale * PRICING.percentage) / 100
  return { sale, stripeFee, fee, gst: Math.round(fee * 10) / 100 }
}

// Black Friday 2026 (user decision 27 Nov): sign up by 11:59 pm Mon 30 Nov, Brisbane time (UTC+10,
// no daylight saving) → 6 months free, then Pay as you go locked at this rate for life. The API
// enforces the window; this only drives the banner (BlackFridayBanner), which hides at endsAt.
export const BLACK_FRIDAY = {
  endsAt: '2026-11-30T23:59:59+10:00',
  endsLabel: 'Monday 30 November',
  freeMonths: 6,
  rateAfter: PRICING.percentage,
} as const
