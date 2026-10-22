// CalaStudio's own plans as advertised on the homepage. The API owns the real rates (Settings →
// Plan & billing shows each studio what it actually pays); keep these in step with the backend's
// configuration. Monthly/Annual include GST; Pay as you go is a share of each booking after
// Stripe's fee, with GST on top.

export const PRICING = {
  currency: 'AUD',
  percentage: 5,
  monthly: 45,
  annual: 450,
} as const

export const aud = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

export const annualSaving = () => PRICING.monthly * 12 - PRICING.annual

// Worked example for Pay as you go: a $20 sale with Stripe's standard Australian card fee
// (1.7% + 30c), then CalaStudio's share of what's left, then GST on that share.
export function paygExample() {
  const stripeFee = Math.round((20 * 0.017 + 0.3) * 100) / 100
  const net = Math.round((20 - stripeFee) * 100) / 100
  const fee = Math.round(net * PRICING.percentage) / 100
  return { stripeFee, net, fee, gst: Math.round(fee * 10) / 100 }
}
