import { formatMoney } from '@/lib/money'

// CalaStudio's own plans — what Travel Engine charges a studio (not what members pay the studio).
// Wording only: the API owns the rates and whether GST applies (gst_applies = the studio is in
// Australia). Monthly/Annual prices include GST; the Pay as you go fee is taken on the booking
// amount after Stripe's fee, with GST added on top.

export type PlanKey = 'percentage' | 'monthly' | 'annual'

export interface PlanPricing {
  percentage_rate: number | null // fraction: 0.05 = 5%
  monthly_amount: number | null
  annual_amount: number | null
  gst_applies?: boolean
}

export const PLAN_NAME: Record<PlanKey, string> = { percentage: 'Pay as you go', monthly: 'Monthly', annual: 'Annual' }

export function planPrice(p: PlanKey, pl: PlanPricing, currency: string): string {
  const gst = pl.gst_applies === true
  if (p === 'percentage') {
    if (pl.percentage_rate == null) return '—'
    return `${+(pl.percentage_rate * 100).toFixed(2)}% of each booking after Stripe fees${gst ? ', + GST' : ''}`
  }
  const amount = p === 'monthly' ? pl.monthly_amount : pl.annual_amount
  if (amount == null) return '—'
  return `${formatMoney(amount, currency)} a ${p === 'monthly' ? 'month' : 'year'}${gst ? ' incl. GST' : ''}`
}
