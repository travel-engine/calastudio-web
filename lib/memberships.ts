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
  hold_allowed?: boolean
  hold_max_periods_per_year?: number | null
  hold_fee?: number | null
  cancel_notice_periods?: number
  is_active: boolean
  valid_from: string | null
  valid_until: string | null
  sort_order: number | null
  active_member_count?: number // admin only
  created_at?: string
  updated_at?: string
}

export type MembershipStatus = 'pending' | 'active' | 'on_hold' | 'past_due' | 'capped' | 'cancelled' | 'expired'

export const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; tone: ChipTone }> = {
  pending: { label: 'Starts soon', tone: 'info' },
  active: { label: 'Active', tone: 'primary' },
  on_hold: { label: 'On hold', tone: 'info' },
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

/** A plan offered for sale where a member can't book otherwise (booking-options). */
export type MembershipOffer = Pick<MembershipTemplate,
  'id' | 'name' | 'description' | 'price' | 'currency' | 'period_type' | 'period_rolling_value' | 'is_recurring' | 'session_cap'
  | 'cancel_notice_periods' | 'hold_allowed' | 'hold_max_periods_per_year'>

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
  hold?: MembershipHold | null
  hold_allowance?: HoldAllowance | null
  cancel_notice_periods?: number
}

/** A hold: whole periods from the day after the paid-up period (API PR #79). */
export interface MembershipHold {
  id: string
  start_date: string
  end_date: string
  periods: number
  fee_per_period: number
  status: 'scheduled' | 'active'
}

export interface HoldAllowance {
  max_periods_per_year: number
  used_this_year: number
  periods_left: number
  fee_per_period: number
  membership_year_start: string
  membership_year_end: string
}

/** GET …/memberships/{id}/hold-options?periods=n (member or staff). */
export interface HoldOptions {
  allowed: boolean
  not_allowed_reason: 'not_allowed' | 'not_renewing' | 'already_on_hold' | 'limit_reached' | null
  starts_on: string
  period_label: string
  fee_per_period: number
  currency: string
  max_periods_per_year: number
  used_this_year: number
  periods_left_this_year: number
  membership_year_start: string
  membership_year_end: string
  ends_on?: string
  resumes_on?: string
  bookings_to_cancel?: { booking_id: string; session_name: string; starts_at: string }[]
}

export const HOLD_NOT_ALLOWED: Record<string, string> = {
  not_allowed: 'This membership can’t be put on hold.',
  not_renewing: 'Only a membership that renews can be put on hold. This one is ending.',
  already_on_hold: 'There’s already a hold on this membership.',
  limit_reached: 'All the hold time for this membership year has been used.',
}

/** GET …/members/me/memberships/{id}/cancel-preview (API PR #80). */
export interface CancelPreview {
  mode: 'notice' | 'period_end' | 'refund_now' | 'end_now' | 'not_possible'
  access_until: string | null
  notice_periods: number
  notice_amount: number
  currency: string
  refund_amount: number
  notice_starts_on: string | null
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

// ── Staff side (API PR #78, spec 05 §5.2 "Staff tools") ───────────────────

/** GET …/member-memberships (paged) and …/members/{id}/memberships. */
export interface StaffMembership extends MyMembership {
  member_id: string
  member_name: string
  notes: string | null
}

/** GET …/member-memberships/{id}: adds the charges taken for it. */
export interface StaffMembershipDetail extends StaffMembership {
  payments: { id: string; period_start: string | null; amount: number; refunded_amount: number; currency: string; status: string; created_at: string }[]
}

/** GET …/member-memberships/{id}/refund-quote. A comp is all zeros with a null payment_id. */
export interface MembershipRefundQuote {
  payment_id: string | null
  amount_paid: number
  refundable: number
  period_start: string | null
  period_end: string | null
  unused_days: number
  period_days: number
  suggested_refund: number
}

/** pending, active, past_due and capped: the ones still running. */
export const isLiveMembership = (s: MembershipStatus) => s !== 'cancelled' && s !== 'expired'

/**
 * The plan's terms in plain words, for buyers: renewal, notice, holds, guests. Each line stands alone,
 * e.g. ["Renews every week", "Cancel with 2 weeks’ notice", "Hold up to 4 weeks a year, free"].
 */
export function membershipTerms(
  t: Pick<MembershipTemplate, 'period_type' | 'period_rolling_value' | 'is_recurring' | 'max_cycles' | 'currency'
    | 'cancel_notice_periods' | 'hold_allowed' | 'hold_max_periods_per_year' | 'hold_fee' | 'guest_bookings_enabled' | 'guest_max_per_booking'>,
  fmt: (amount: number, currency: string) => string = formatMoney,
): string[] {
  const unit = periodUnit(t.period_type, t.period_rolling_value)
  const many = (n: number) => (unit ? `${n} ${unit.includes(' ') ? 'periods' : `${unit}${n === 1 ? '' : 's'}`}` : `${n}`)
  const lines: string[] = []
  if (!t.is_recurring || !unit) {
    lines.push('One payment, doesn’t renew')
  } else {
    lines.push(t.max_cycles ? `Runs for ${many(t.max_cycles)}, then ends` : `Renews every ${unit}`)
    const notice = t.cancel_notice_periods ?? 0
    lines.push(notice > 0 ? `Cancel with ${many(notice)}’ notice` : 'Cancel any time')
    if (t.hold_allowed && t.hold_max_periods_per_year) {
      lines.push(`Hold up to ${many(t.hold_max_periods_per_year)} a year${t.hold_fee ? `, ${fmt(t.hold_fee, t.currency)} a ${unit.includes(' ') ? 'period' : unit}` : ', free'}`)
    }
  }
  if (t.guest_bookings_enabled) {
    const g = t.guest_max_per_booking ?? 1
    lines.push(`Bring up to ${g} guest${g === 1 ? '' : 's'}`)
  }
  return lines
}
