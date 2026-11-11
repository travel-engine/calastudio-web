// CalaStudio's own plans as advertised on the homepage. The API owns the real rates (Settings →
// Plan & billing shows each studio what it actually pays); keep these in step with the backend's
// configuration. Monthly/Annual include GST; Pay as you go is a share of each booking (the full
// amount), with GST on top. Stripe's own fee is separate.

export const PRICING = {
  currency: 'AUD',
  percentage: 2,
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
