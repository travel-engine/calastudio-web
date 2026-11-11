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
export function priceLabel(
  t: Pick<MembershipTemplate, 'price' | 'currency' | 'period_type' | 'period_rolling_value' | 'is_recurring'>,
  fmt: (amount: number, currency: string) => string = formatMoney,
): string {
  const money = fmt(t.price, t.currency)
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

// ── Member side (API PR #73) ─────────────────────────────────────────────

/** GET …/members/me/memberships/{templateId}/quote?start_date= */
export interface MembershipQuote {
  start_date: string
  first_period_end: string | null
  next_charge_on: string | null // null = won't renew
  price: number
  subtotal: number
  tax_amount: number
  tax_name: string | null
  currency: string
  renews: boolean
}

/** GET …/members/me/memberships, newest first. */
export interface MyMembership {
  id: string
  template_id: string
  name: string
  status: MembershipStatus
  is_comp: boolean
  price: number
  currency: string
  period_type: PeriodType
  period_rolling_value: number | null
  started_on: string
  current_period_start: string | null
  current_period_end: string | null
  next_charge_on: string | null
  cancel_at: string | null // last day with access, when an end is scheduled
  cancelled_at: string | null
  cancellation_reason: string | null
  session_cap: number | null
  sessions_used_this_period: number
  sessions_left_this_period: number | null // null = no cap
  cycles_completed: number
  max_cycles: number | null
  scheduled_price: { price: number; from: string } | null
  past_due: { since: string; amount: number; attempts: number; next_retry_on: string | null; grace_until: string | null; can_book: boolean } | null
  card: { brand: string; last4: string } | null
}

/** A date-only "YYYY-MM-DD" as "Thu 12 Nov" (or "Thu 12 Nov 2027" outside this year), with no timezone shift. */
export function dateOnlyLabel(d: string): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, day, 12))
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
  if (y !== new Date().getFullYear()) opts.year = 'numeric'
  return new Intl.DateTimeFormat('en-AU', opts).format(date).replace(/,/g, '')
}

/** Today (or today + n days) as "YYYY-MM-DD" in the browser's own calendar. */
export function localDateKey(addDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + addDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
