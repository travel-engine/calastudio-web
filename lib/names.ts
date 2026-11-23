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

/**
 * The name a teacher goes by in the studio: their teacher-profile display name (set in Team →
 * teacher → Display name), else their account name. It's the same name the API puts in
 * `instructor_name` on classes, the booking page and emails — use it wherever a teacher is named,
 * so a rename (typo, new surname, first name only) shows the same everywhere.
 */
export function teacherName(t: (PersonName & { profile?: { display_name?: string | null } | null }) | null | undefined): string {
  return t?.profile?.display_name?.trim() || displayName(t)
}

/**
 * First and last name from a Supabase user's metadata: our own sign-up stores first_name/last_name
 * (older accounts only full_name); Google gives given_name/family_name and name.
 */
export function namesFromMetadata(meta: Record<string, unknown> | null | undefined): { first_name: string; last_name: string } {
  if (!meta) return { first_name: '', last_name: '' }
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string).trim() : '')
  if (str('first_name') || str('last_name')) return { first_name: str('first_name'), last_name: str('last_name') }
  if (str('given_name') || str('family_name')) return { first_name: str('given_name'), last_name: str('family_name') }
  return splitName(str('full_name') || str('name'))
}

/** The register endpoint's 400 when a new person has no first or last name (API, 23 Nov 2026). */
export const isNameRequiredError = (message: string) => /first and last name/i.test(message)
