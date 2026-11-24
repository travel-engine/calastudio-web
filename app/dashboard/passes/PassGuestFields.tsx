'use client'

import { FormField as Field, SelectInput as Select } from '@/app/components/admin'
import type { StudioGuestDefaults } from '../sessions/GuestOverride'

// Guest settings on a pass or membership. Blank means "inherit": whether guests are allowed and how
// many follow the class (which itself follows the studio default); credits per guest follow the
// studio default. Setting a value here wins for members paying with this pass or membership.
export type PassGuestForm = { enabled: '' | 'true' | 'false'; max: string; cost: string }

export const EMPTY_PASS_GUESTS: PassGuestForm = { enabled: '', max: '', cost: '' }

export function passGuestsFrom(t: { guest_bookings_enabled?: boolean | null; guest_max_per_booking?: number | null; guest_credits_cost?: number | null }): PassGuestForm {
  return {
    enabled: t.guest_bookings_enabled == null ? '' : t.guest_bookings_enabled ? 'true' : 'false',
    max: t.guest_max_per_booking?.toString() ?? '',
    cost: t.guest_credits_cost?.toString() ?? '',
  }
}

// null = inherit. Turning guests off makes the number and cost irrelevant, so they're inherited too.
export function passGuestsPayload(g: PassGuestForm, opts: { withCost: boolean }) {
  const off = g.enabled === 'false'
  const num = (v: string, min: number) => (v.trim() === '' ? null : Math.max(min, parseInt(v, 10) || min))
  return {
    guest_bookings_enabled: g.enabled === '' ? null : !off,
    guest_max_per_booking: off ? null : num(g.max, 1),
    ...(opts.withCost ? { guest_credits_cost: off ? null : num(g.cost, 0) } : {}),
  }
}

// The API field names that are back on "inherit" after this save, for update endpoints that need
// clearing spelled out.
export function passGuestsCleared(g: PassGuestForm, opts: { withCost: boolean }) {
  const p = passGuestsPayload(g, opts) as Record<string, unknown>
  return Object.keys(p).filter(k => p[k] === null)
}

export default function PassGuestFields({ value, onChange, defaults, withCost }: {
  value: PassGuestForm
  onChange: (v: PassGuestForm) => void
  defaults: StudioGuestDefaults | null
  withCost: boolean
}) {
  const set = (k: keyof PassGuestForm, v: string) => onChange({ ...value, [k]: v })
  const n = value.max !== '' ? parseInt(value.max, 10) : null
  const numbers = [1, 2, 3, 4, 5]
  if (n != null && !numbers.includes(n)) numbers.push(n)
  const studioCost = defaults?.cost

  return (
    <>
      <Field label="Guests" hint="Same as the class uses each class's own setting, or your studio default from Settings.">
        <Select value={value.enabled} onChange={e => set('enabled', e.target.value)}>
          <option value="">Same as the class</option>
          <option value="true">Allowed</option>
          <option value="false">Not allowed</option>
        </Select>
      </Field>
      {value.enabled !== 'false' && (
        <div style={{ display: 'grid', gridTemplateColumns: withCost ? '1fr 1fr' : '1fr', gap: 16 }}>
          <Field label="Guests per booking">
            <Select value={value.max} onChange={e => set('max', e.target.value)}>
              <option value="">Same as the class</option>
              {numbers.map(k => <option key={k} value={String(k)}>{k} guest{k === 1 ? '' : 's'}</option>)}
            </Select>
          </Field>
          {withCost && (
            <Field label="Credits per guest">
              <Select value={value.cost} onChange={e => set('cost', e.target.value)}>
                <option value="">{studioCost != null ? `Studio default (${studioCost})` : 'Studio default'}</option>
                {[0, 1, 2, 3].concat(value.cost !== '' && !['0', '1', '2', '3'].includes(value.cost) ? [parseInt(value.cost, 10)] : [])
                  .map(k => <option key={k} value={String(k)}>{k === 0 ? 'Free (0)' : String(k)}</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}
    </>
  )
}
