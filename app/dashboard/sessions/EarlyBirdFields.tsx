'use client'

import { CheckRow, FormField as Field, TextInput as Input } from '@/app/components/admin'
import { formatDateTimeWithWeekday, utcToZonedWall, zonedWallToUtc } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color } from '@/lib/ui/tokens'

// Early bird on a one-off session (a workshop): a lower price until a date and time the studio picks
// in its own time zone (sent as studio-local wall time; shown back in the studio's zone), optionally
// only for the first N spots. The API validates and decides the
// price members pay (02 §2.4, 05 §5.3a); this only collects the fields. Recurring sessions can't
// have early bird, so the fields aren't offered there.

export interface EarlyBirdForm {
  enabled: boolean
  price: string
  endsDate: string // studio-local yyyy-mm-dd
  endsTime: string // studio-local HH:mm
  spotLimit: string
}

export const EMPTY_EARLY_BIRD: EarlyBirdForm = { enabled: false, price: '', endsDate: '', endsTime: '23:59', spotLimit: '' }

/** Form state from a session as the API returns it. */
export function earlyBirdFromSession(
  s: { early_bird_price?: number | null; early_bird_ends_at?: string | null; early_bird_spot_limit?: number | null },
  timeZone?: string | null,
): EarlyBirdForm {
  if (s.early_bird_price == null || !s.early_bird_ends_at) return EMPTY_EARLY_BIRD
  const { date, time } = utcToZonedWall(s.early_bird_ends_at, timeZone)
  return {
    enabled: true,
    price: String(s.early_bird_price),
    endsDate: date,
    endsTime: time,
    spotLimit: s.early_bird_spot_limit != null ? String(s.early_bird_spot_limit) : '',
  }
}

/** Fields that must be filled before saving; the API checks the rest (price below full, before the start). */
export function earlyBirdProblem(eb: EarlyBirdForm, recurring: boolean): string | null {
  if (!eb.enabled || recurring) return null
  if (!eb.price.trim()) return 'Enter the early bird price.'
  if (!eb.endsDate) return 'Choose when the early bird price ends.'
  if (eb.spotLimit.trim() && !(parseInt(eb.spotLimit, 10) >= 1)) return 'The early bird spot limit must be at least 1, or left blank.'
  return null
}

/**
 * Request fields. Creating: only sent when on. Editing: off (or recurring) sends explicit nulls,
 * which clear early bird on the session.
 */
export function earlyBirdPayload(eb: EarlyBirdForm, recurring: boolean, mode: 'create' | 'edit') {
  if (!eb.enabled || recurring) {
    return mode === 'edit' ? { early_bird_price: null, early_bird_ends_at: null, early_bird_spot_limit: null } : {}
  }
  return {
    early_bird_price: parseFloat(eb.price),
    // Studio-local wall time with no zone (API #109): the API reads it in the studio's time zone, so
    // an admin whose device is elsewhere still gets the time they picked.
    early_bird_ends_at: `${eb.endsDate}T${eb.endsTime || '23:59'}:00`,
    early_bird_spot_limit: eb.spotLimit.trim() ? parseInt(eb.spotLimit, 10) : null,
  }
}

export default function EarlyBirdFields({ value, onChange, recurring, currency, fullPrice, timeZone }: {
  value: EarlyBirdForm
  onChange: (next: EarlyBirdForm) => void
  recurring: boolean
  currency: string
  fullPrice: string
  timeZone?: string | null
}) {
  if (recurring) {
    return (
      <p style={{ margin: '0 0 16px', fontSize: 14, color: color.muted }}>
        Early bird pricing is available on one-off sessions, such as workshops.
      </p>
    )
  }

  const set = (patch: Partial<EarlyBirdForm>) => onChange({ ...value, ...patch })
  const full = parseFloat(fullPrice)
  const early = parseFloat(value.price)
  const endsLabel = value.endsDate ? formatDateTimeWithWeekday(zonedWallToUtc(value.endsDate, value.endsTime || '23:59', timeZone), timeZone) : ''
  const limit = parseInt(value.spotLimit, 10)

  return (
    <div style={{ marginBottom: 16 }}>
      <CheckRow checked={value.enabled} onChange={v => set({ enabled: v })}>
        Offer an early bird price
      </CheckRow>

      {value.enabled && (
        <div style={{ marginTop: 10, paddingLeft: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0 16px' }}>
            <Field label={`Early bird price (${currency})`}>
              <Input type="number" min="0" step="0.50" inputMode="decimal" value={value.price} onChange={e => set({ price: e.target.value })} />
            </Field>
            <Field label="Ends on">
              <Input type="date" value={value.endsDate} onChange={e => set({ endsDate: e.target.value })} />
            </Field>
            <Field label="At" hint={timeZone ? `Studio time (${timeZone})` : undefined}>
              <Input type="time" value={value.endsTime} onChange={e => set({ endsTime: e.target.value })} />
            </Field>
          </div>
          <Field label="Limit to the first … spots (optional)" hint="Leave blank to offer it to everyone who books before the end date.">
            <Input type="number" min="1" step="1" inputMode="numeric" value={value.spotLimit} onChange={e => set({ spotLimit: e.target.value })} style={{ maxWidth: 160 }} />
          </Field>
          {!Number.isNaN(early) && endsLabel && (
            <p style={{ margin: 0, fontSize: 14, color: color.ink2 }}>
              Members pay {formatMoney(early, currency)} until {endsLabel}
              {limit >= 1 ? ` or until ${limit} early bird spot${limit === 1 ? ' is' : 's are'} taken` : ''}
              {!Number.isNaN(full) ? `, then ${formatMoney(full, currency)}.` : '.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
