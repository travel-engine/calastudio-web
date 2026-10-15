// Shared date formatting. House style for a plain date is dd-mmm-yyyy (e.g. 05-Sep-2026)
// — unambiguous across locales. Time is appended locale-formatted where a timestamp is shown.
//
// Every formatter takes an optional IANA `timeZone`. Pass the studio's timezone for class times
// and anything else tied to the studio's clock: without it the runtime's zone is used, which on
// the server (Vercel) is UTC and in the browser is wherever the visitor is. Omit it for date-only
// values like '2026-09-05' (join dates, expiry dates) — those aren't instants.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type DateInput = string | number | Date

function toDate(input: DateInput): Date | null {
  const d = input instanceof Date ? input : new Date(input)
  return isNaN(d.getTime()) ? null : d
}

// An unknown zone throws in Intl; fall back to the runtime zone rather than crash a page.
export function safeZone(timeZone: string | null | undefined): string | undefined {
  if (!timeZone) return undefined
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return undefined
  }
}

/** Calendar day/month/year of `d` as seen in `timeZone` (runtime zone if omitted). */
function ymd(d: Date, timeZone?: string): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone), year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { y: get('year'), m: get('month'), day: get('day') }
}

/** 05-Sep-2026 */
export function formatDate(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  const { y, m, day } = ymd(d, timeZone ?? undefined)
  return `${String(day).padStart(2, '0')}-${MONTHS[m - 1]}-${y}`
}

/** 9:00 AM */
export function formatTime(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: safeZone(timeZone) })
}

/** 05-Sep-2026 9:00 AM */
export function formatDateTime(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  return `${formatDate(d, timeZone)} ${formatTime(d, timeZone)}`
}

/** Sat 05-Sep-2026 */
export function formatDateWithWeekday(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short', timeZone: safeZone(timeZone) })
  return `${weekday} ${formatDate(d, timeZone)}`
}

/** Sat 05-Sep-2026 9:00 AM */
export function formatDateTimeWithWeekday(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  return `${formatDateWithWeekday(d, timeZone)} ${formatTime(d, timeZone)}`
}

/** '2026-09-05' — the calendar day `input` falls on in `timeZone`. Use to group by day. */
export function dayKey(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  const { y, m, day } = ymd(d, timeZone ?? undefined)
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** "Today", "Tomorrow", else "Sat 05-Sep-2026" — relative to now, in `timeZone`. */
export function formatDayLabel(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  const key = dayKey(d, timeZone)
  const now = Date.now()
  if (key === dayKey(now, timeZone)) return 'Today'
  // +24h lands on tomorrow's date in any zone (DST shifts are ≤1h, never a whole day).
  if (key === dayKey(now + 24 * 60 * 60 * 1000, timeZone)) return 'Tomorrow'
  return formatDateWithWeekday(d, timeZone)
}

// ── Admin redesign formats (design/admin-redesign handoff §3) ─────────────────────────────────
// Locale pinned to en-AU so server and browser render identically (no hydration mismatch) and
// times read "7:00 am". Pass the studio's timezone wherever the value is on the studio's clock.
const ADMIN_LOCALE = 'en-AU'

/** "7:00 am" */
export function formatClock(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  return d.toLocaleTimeString(ADMIN_LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: safeZone(timeZone) })
}

/** "Sat 17 Oct", with the year only when it isn't this year: "Sat 2 Jan 2027" */
export function formatShortDate(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  const zone = safeZone(timeZone)
  const { y } = ymd(d, zone)
  const thisYear = ymd(new Date(), zone).y
  const weekday = d.toLocaleDateString(ADMIN_LOCALE, { weekday: 'short', timeZone: zone })
  const { m, day } = ymd(d, zone)
  return `${weekday} ${day} ${MONTHS[m - 1]}${y === thisYear ? '' : ` ${y}`}`
}

/** "Today, 7:00 am" · "Tomorrow, 7:00 am" · "Sat 17 Oct, 7:00 am" */
export function formatWhen(input: DateInput, timeZone?: string | null): string {
  const d = toDate(input)
  if (!d) return ''
  const label = formatDayLabel(d, timeZone)
  const day = label === 'Today' || label === 'Tomorrow' ? label : formatShortDate(d, timeZone)
  return `${day}, ${formatClock(d, timeZone)}`
}

/** Compact "time since": "just now", "5m ago", "3h ago", "2d ago", then falls back to 05-Sep-2026 */
export function formatRelativeShort(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}
