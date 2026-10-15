'use client'

import { color, radius, space } from '@/lib/ui/tokens'
import ui from './admin.module.css'

/** A small set of mutually exclusive options as real buttons with aria-pressed. */
export default function Segmented<T extends string>({ options, value, onChange, label, size = 'md' }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group, e.g. "Delivery" */
  label: string
  size?: 'md' | 'sm'
}) {
  return (
    <div role="group" aria-label={label} style={{
      display: 'inline-flex', flexWrap: 'wrap', gap: 4, padding: 4, alignSelf: 'flex-start',
      background: color.bg, border: `1px solid ${color.border}`, borderRadius: radius.control + 2,
    }}>
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`${ui.segment} ${ui.focusable}`}
            style={{
              minHeight: size === 'sm' ? space.targetDense - 4 : space.target - 8, padding: '0 14px',
              border: 0, borderRadius: radius.control - 2, cursor: 'pointer',
              background: on ? color.surface : 'transparent',
              boxShadow: on ? '0 1px 2px rgba(23, 32, 28, 0.12)' : 'none',
              color: on ? color.ink : color.ink2, fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 600 : 500,
              ['--hover-bg' as string]: color.divider,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
