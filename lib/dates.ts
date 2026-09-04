// Shared date formatting. House style for a plain date is dd-mmm-yyyy (e.g. 05-Sep-2026)
// — unambiguous across locales. Time is appended locale-formatted where a timestamp is shown.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type DateInput = string | number | Date

function toDate(input: DateInput): Date | null {
  const d = input instanceof Date ? input : new Date(input)
  return isNaN(d.getTime()) ? null : d
}

/** 05-Sep-2026 */
export function formatDate(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

/** 05-Sep-2026 9:00 AM */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${formatDate(d)} ${time}`
}

/** Sat 05-Sep-2026 */
export function formatDateWithWeekday(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${formatDate(d)}`
}

/** Sat 05-Sep-2026 9:00 AM */
export function formatDateTimeWithWeekday(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${formatDateWithWeekday(d)} ${time}`
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
