import type { ChipTone } from '@/app/components/admin'
import { formatMoney } from '@/lib/money'

// Memberships v1 (spec 05 §5.2, API PR #68 design.md §3): period-based access, unlike credit passes.
// Wording and shapes only; the API owns every rule (coverage, caps, renewals, dunning).

export type PeriodType = 'rolling_days' | 'rolling_weeks' | 'rolling_months' | 'fixed_dates'

export interface MembershipTemplate {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  tax_rate_override: number | null
  period_type: PeriodType
  period_rolling_value: number | null
  period_fixed_start: string | null
  period_fixed_end: string | null
  is_recurring: boolean
  max_cycles: number | null
  session_cap: number | null
  session_type_restriction: string[] | null // null = every session type
  grace_days: number
  guest_bookings_enabled: boolean
  guest_max_per_booking: number | null
  is_active: boolean
  valid_from: string | null
  valid_until: string | null
  sort_order: number | null
  active_member_count?: number // admin only
  created_at?: string
  updated_at?: string
}

export type MembershipStatus = 'pending' | 'active' | 'past_due' | 'capped' | 'cancelled' | 'expired'

export const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; tone: ChipTone }> = {
  pending: { label: 'Starts soon', tone: 'info' },
  active: { label: 'Active', tone: 'primary' },
  past_due: { label: 'Payment overdue', tone: 'danger' },
  capped: { label: 'Limit reached', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Ended', tone: 'neutral' },
}

const UNIT: Record<Exclude<PeriodType, 'fixed_dates'>, [string, string]> = {
  rolling_days: ['day', 'days'],
  rolling_weeks: ['week', 'weeks'],
  rolling_months: ['month', 'months'],
}

/** "week", "2 weeks", "month"; null for fixed dates. */
export function periodUnit(type: PeriodType, value: number | null): string | null {
  if (type === 'fixed_dates') return null
  const n = value ?? 1
  const [one, many] = UNIT[type]
  return n === 1 ? one : `${n} ${many}`
}

/** "$45.00 a week", "$180.00 every 2 weeks", "$300.00 for the dates". */
export function priceLabel(t: Pick<MembershipTemplate, 'price' | 'currency' | 'period_type' | 'period_rolling_value' | 'is_recurring'>): string {
  const money = formatMoney(t.price, t.currency)
  const unit = periodUnit(t.period_type, t.period_rolling_value)
  if (!unit) return money
  if (!t.is_recurring) return `${money} for ${unit.includes(' ') ? unit : `1 ${unit}`}`
  return unit.includes(' ') ? `${money} every ${unit}` : `${money} a ${unit}`
}

/** "All sessions" or "Classes only", "Classes and workshops". */
export function coverageLabel(types: string[] | null): string {
  if (!types || types.length === 0) return 'All sessions'
  const names = types.map(t => (t === 'class' ? 'classes' : t === 'workshop' ? 'workshops' : `${t}s`))
  const text = names.length === 1 ? `${names[0]} only` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "Unlimited" or "8 a week". */
export function capLabel(cap: number | null, type: PeriodType, value: number | null): string {
  if (cap == null) return 'Unlimited'
  const unit = periodUnit(type, value)
  return unit ? `${cap} ${unit.includes(' ') ? `per ${unit}` : `a ${unit}`}` : `${cap} in total`
}
