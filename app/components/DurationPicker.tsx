'use client'

import { useState, type ComponentType, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'

// Class length: common presets plus "Custom…" for any whole number of minutes. Used by the
// new-session and edit-session forms and the onboarding wizard, each passing its own styled
// <select>/<input> so the picker matches the page. `value` is minutes as a string, like the forms'
// other fields.

export const DURATION_PRESETS = [30, 45, 60, 75, 90, 120, 150, 180]
export const MIN_DURATION = 5
export const MAX_DURATION = 720 // 12 hours

// 45 → "45 minutes", 75 → "75 minutes", 60 → "1 hour", 150 → "2.5 hours", 130 → "2 h 10 min"
export function formatDuration(minutes: number): string {
  if (minutes < 60 || (minutes < 120 && minutes % 30 !== 0)) return `${minutes} minutes`
  if (minutes % 30 === 0) {
    const h = minutes / 60
    return `${h} hour${h === 1 ? '' : 's'}`
  }
  const h = Math.floor(minutes / 60)
  return `${h} h ${minutes % 60} min`
}

/** Why `value` can't be saved, or null. */
export function durationProblem(value: string): string | null {
  const n = Number(value)
  if (!value || !Number.isInteger(n)) return 'Enter the class length in whole minutes.'
  if (n < MIN_DURATION || n > MAX_DURATION) return `Class length must be between ${MIN_DURATION} minutes and ${MAX_DURATION / 60} hours.`
  return null
}

const CUSTOM = 'custom'

export default function DurationPicker({ value, onChange, Select, Input, id }: {
  value: string
  onChange: (minutes: string) => void
  Select: ComponentType<SelectHTMLAttributes<HTMLSelectElement>>
  Input: ComponentType<InputHTMLAttributes<HTMLInputElement>>
  id?: string
}) {
  // Custom shows for any non-preset value (including one loaded after mount, on the edit page) and
  // sticks once chosen, even if the typed number happens to match a preset.
  const [chosenCustom, setCustom] = useState(false)
  const n = Number(value)
  const custom = chosenCustom || !DURATION_PRESETS.includes(n)
  const preview = custom && Number.isInteger(n) && n >= 60 && n <= MAX_DURATION ? formatDuration(n) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Select
        id={id}
        value={custom ? CUSTOM : value}
        onChange={e => {
          if (e.target.value === CUSTOM) { setCustom(true); return }
          setCustom(false)
          onChange(e.target.value)
        }}
      >
        {DURATION_PRESETS.map(m => <option key={m} value={String(m)}>{formatDuration(m)}</option>)}
        <option value={CUSTOM}>Custom…</option>
      </Select>
      {custom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={1}
            aria-label="Class length in minutes"
            placeholder="e.g. 50"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ maxWidth: 120 }}
          />
          <span style={{ fontSize: 14, color: '#666' }}>minutes{preview ? ` (${preview})` : ''}</span>
        </div>
      )}
    </div>
  )
}
