// The API split the old `full_name` field into `first_name` + `last_name` on every DTO. Raw entity
// responses (a booking's `user`, a member-pass's `user`) still carry a computed `full_name`, so
// those call sites keep reading it directly — this helper is for the DTO shapes.

export interface PersonName {
  first_name?: string | null
  last_name?: string | null
}

/** "First Last", collapsing a missing half. Empty string when nothing is set. */
export function displayName(p: PersonName | null | undefined): string {
  if (!p) return ''
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
}

/** Up to two uppercase initials from a display name, for avatar fallbacks. "" when nothing usable. */
export function initials(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Split a single free-text name on the first space — for form inputs that still collect one field. */
export function splitName(full: string): { first_name: string; last_name: string } {
  const trimmed = full.trim()
  const i = trimmed.indexOf(' ')
  if (i === -1) return { first_name: trimmed, last_name: '' }
  return { first_name: trimmed.slice(0, i), last_name: trimmed.slice(i + 1).trim() }
}
