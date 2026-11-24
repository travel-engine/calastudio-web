'use client'

import { useEffect, useState } from 'react'

// A class's guest setting: '' follows the studio default (Settings → Guests), 'none' turns guests
// off for this class, a number allows that many per booking. The API resolves the chain
// (studio → class → pass/membership); this only says which level the class sets.
export type GuestOverride = '' | 'none' | `${number}`

export type StudioGuestDefaults = { enabled: boolean; max: number; cost?: number }

export function guestOverrideFrom(s: { guest_bookings_enabled?: boolean | null; guest_max_per_booking?: number | null }): GuestOverride {
  if (s.guest_bookings_enabled === false || s.guest_max_per_booking === 0) return 'none'
  if (s.guest_max_per_booking != null) return String(s.guest_max_per_booking) as GuestOverride
  return ''
}

// Explicit nulls: on a session PATCH they clear the override back to the studio default.
export function guestOverridePayload(v: GuestOverride) {
  if (v === '') return { guest_bookings_enabled: null, guest_max_per_booking: null }
  if (v === 'none') return { guest_bookings_enabled: false, guest_max_per_booking: null }
  return { guest_bookings_enabled: true, guest_max_per_booking: parseInt(v, 10) }
}

const guestsText = (n: number) => `${n} guest${n === 1 ? '' : 's'}`

export function describeStudioGuests(d: StudioGuestDefaults | null) {
  if (!d) return 'Studio default'
  return d.enabled ? `Studio default (${guestsText(d.max)})` : 'Studio default (no guests)'
}

export function useStudioGuestDefaults(orgId: string, token: string) {
  const [defaults, setDefaults] = useState<StudioGuestDefaults | null>(null)
  useEffect(() => {
    if (!orgId || !token) return
    let cancelled = false
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(org => {
        if (cancelled || !org) return
        setDefaults({ enabled: !!org.guest_bookings_enabled, max: org.guest_max_per_booking ?? 1, cost: org.guest_credits_cost ?? 1 })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [orgId, token])
  return defaults
}

export function GuestOverrideOptions({ defaults, current }: { defaults: StudioGuestDefaults | null; current: GuestOverride }) {
  const numbers = [1, 2, 3, 4, 5]
  const n = current !== '' && current !== 'none' ? parseInt(current, 10) : null
  if (n != null && !numbers.includes(n)) numbers.push(n)
  return (
    <>
      <option value="">{describeStudioGuests(defaults)}</option>
      <option value="none">No guests</option>
      {numbers.map(k => <option key={k} value={String(k)}>{guestsText(k)}</option>)}
    </>
  )
}
